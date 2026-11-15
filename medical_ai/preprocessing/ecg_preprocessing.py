"""
ecg_preprocessing.py
─────────────────────
Data loading, validation and preprocessing for the ECG image dataset.

ECG-specific augmentation guidelines
──────────────────────────────────────
ECG images encode clinically relevant features (waveform morphology, amplitude,
interval durations) that must not be destroyed by aggressive augmentation.
The following are intentionally EXCLUDED:
  • Large rotations (>5°) – distort waveform slope
  • Horizontal flips    – reverse time axis, clinically nonsensical
  • Vertical flips      – inverts polarity
  • Strong colour jitter – ECG grids carry information
  • Elastic distortions  – deform waveform shapes

Safe augmentations applied only to training data:
  • Very small rotations (≤5°) to simulate scan tilt
  • Tiny translations (≤2%) for alignment variance
  • Minimal zoom (≤5%) for scale variance
  • Subtle brightness (±5%) for scanner exposure variation
"""

from __future__ import annotations

import os
import random
import warnings
from pathlib import Path
from typing import Tuple, Dict, List

import numpy as np
from PIL import Image, UnidentifiedImageError

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.config import (
    ECG_DATASET_PATH,
    IMAGE_SIZE,
    BATCH_SIZE,
    VALIDATION_SPLIT,
    TEST_SPLIT,
    RANDOM_SEED,
    ECG_AUG,
    IMAGE_MODEL_NAME,
)

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}


# ──────────────────────────────────────────────────────────────────────────────
# Dataset discovery  (identical interface to retinal, independent module)
# ──────────────────────────────────────────────────────────────────────────────

def discover_dataset(dataset_path: str) -> Tuple[List[str], List[int], List[str]]:
    root = Path(dataset_path)
    if not root.exists():
        raise FileNotFoundError(
            f"ECG dataset path does not exist: {dataset_path}\n"
            "Please set ECG_DATASET_PATH in utils/config.py."
        )

    class_dirs = sorted([d for d in root.iterdir() if d.is_dir()])
    if not class_dirs:
        raise ValueError(
            f"No class subdirectories found in {dataset_path}.\n"
            "Expected structure:\n"
            "  ecg/\n"
            "      Normal/\n"
            "      Abnormal_Heartbeat/\n"
            "      ..."
        )

    class_names = [d.name for d in class_dirs]
    file_paths: List[str] = []
    labels: List[int] = []

    for label_idx, cls_dir in enumerate(class_dirs):
        found = 0
        for fp in cls_dir.rglob("*"):
            if fp.suffix.lower() in SUPPORTED_EXTENSIONS:
                file_paths.append(str(fp))
                labels.append(label_idx)
                found += 1
        if found == 0:
            warnings.warn(f"ECG class directory '{cls_dir.name}' has no images.")

    if not file_paths:
        raise ValueError(f"No ECG images found under {dataset_path}.")

    return file_paths, labels, class_names


def validate_images(
    file_paths: List[str], labels: List[int]
) -> Tuple[List[str], List[int]]:
    valid_paths, valid_labels = [], []
    n_bad = 0
    for fp, lbl in zip(file_paths, labels):
        try:
            with Image.open(fp) as img:
                img.verify()
            valid_paths.append(fp)
            valid_labels.append(lbl)
        except Exception as exc:
            warnings.warn(f"Skipping corrupt ECG image {fp}: {exc}")
            n_bad += 1
    if n_bad:
        print(f"[ecg_prep] Removed {n_bad} corrupt image(s).")
    return valid_paths, valid_labels


def stratified_split(
    file_paths: List[str],
    labels: List[int],
    val_split: float = VALIDATION_SPLIT,
    test_split: float = TEST_SPLIT,
    seed: int = RANDOM_SEED,
) -> Tuple[List[str], List[str], List[str], List[int], List[int], List[int]]:
    rng = random.Random(seed)
    label_to_paths: Dict[int, List[str]] = {}
    for fp, lbl in zip(file_paths, labels):
        label_to_paths.setdefault(lbl, []).append(fp)

    train_p, val_p, test_p = [], [], []
    train_l, val_l, test_l = [], [], []

    for lbl, paths in label_to_paths.items():
        ps = paths[:]
        rng.shuffle(ps)
        n = len(ps)
        n_test = max(1, int(n * test_split))
        n_val  = max(1, int(n * val_split))
        test_p.extend(ps[:n_test]);              test_l.extend([lbl] * n_test)
        val_p.extend(ps[n_test: n_test+n_val]);  val_l.extend([lbl] * n_val)
        tr = ps[n_test+n_val:]
        train_p.extend(tr);                      train_l.extend([lbl] * len(tr))

    return train_p, val_p, test_p, train_l, val_l, test_l


def compute_class_weights(labels: List[int]) -> Dict[int, float]:
    counts = np.bincount(labels)
    n_samples = len(labels)
    n_classes = len(counts)
    return {
        c: n_samples / (n_classes * cnt) if cnt > 0 else 1.0
        for c, cnt in enumerate(counts)
    }


def print_class_distribution(
    labels: List[int], class_names: List[str], split_name: str = "ECG Dataset"
) -> None:
    counts = np.bincount(labels, minlength=len(class_names))
    total = counts.sum()
    print(f"\n  {split_name} class distribution ({total} samples):")
    for i, name in enumerate(class_names):
        pct = 100.0 * counts[i] / total if total > 0 else 0
        print(f"    [{i}] {name:35s}  {counts[i]:6d}  ({pct:.1f} %)")


def build_data_generators(
    train_paths, val_paths, test_paths,
    train_labels, val_labels, test_labels,
    class_names,
    image_size=IMAGE_SIZE,
    batch_size=BATCH_SIZE,
):
    """
    Build Keras ImageDataGenerators for train / val / test splits.

    ECG-safe augmentation (defined in config.ECG_AUG) is applied ONLY
    to the training generator.  Val and test generators use rescale only.
    This prevents any clinically-dangerous distortions from reaching
    evaluation or inference.
    """
    from tensorflow.keras.preprocessing.image import ImageDataGenerator  # type: ignore
    import pandas as pd

    def _make_df(paths, labels):
        return pd.DataFrame({
            "filepath": paths,
            "label":    [class_names[l] for l in labels],
        })

    train_df = _make_df(train_paths, train_labels)
    val_df   = _make_df(val_paths,   val_labels)
    test_df  = _make_df(test_paths,  test_labels)

    # Very conservative ECG augmentation
    rescale = None if IMAGE_MODEL_NAME.startswith("EfficientNet") else 1.0 / 255.0
    datagen_args = {} if rescale is None else {"rescale": rescale}
    train_datagen = ImageDataGenerator(**datagen_args, **ECG_AUG)
    infer_datagen = ImageDataGenerator(**datagen_args)

    common_kw = dict(
        x_col="filepath",
        y_col="label",
        target_size=image_size,
        batch_size=batch_size,
        class_mode="categorical",
        classes=class_names,
    )

    train_gen = train_datagen.flow_from_dataframe(
        train_df, **common_kw, shuffle=True, seed=RANDOM_SEED
    )
    val_gen  = infer_datagen.flow_from_dataframe(val_df,  **common_kw, shuffle=False)
    test_gen = infer_datagen.flow_from_dataframe(test_df, **common_kw, shuffle=False)

    steps_train = int(np.ceil(len(train_paths) / batch_size))
    steps_val   = int(np.ceil(len(val_paths)   / batch_size))
    steps_test  = int(np.ceil(len(test_paths)  / batch_size))

    return train_gen, val_gen, test_gen, steps_train, steps_val, steps_test


def load_and_prepare(dataset_path: str = ECG_DATASET_PATH) -> Dict:
    """Full preprocessing pipeline for ECG images."""
    print("\n" + "═" * 60)
    print("  ECG Dataset – Loading & Preprocessing")
    print("═" * 60)

    file_paths, labels, class_names = discover_dataset(dataset_path)
    print(f"  Found {len(file_paths)} images across {len(class_names)} classes.")

    file_paths, labels = validate_images(file_paths, labels)
    print_class_distribution(labels, class_names, "Full ECG")

    (train_p, val_p, test_p,
     train_l, val_l, test_l) = stratified_split(file_paths, labels)

    print_class_distribution(train_l, class_names, "Train")
    print_class_distribution(val_l,   class_names, "Validation")
    print_class_distribution(test_l,  class_names, "Test")

    class_weights = compute_class_weights(train_l)
    print(f"\n  Class weights: {class_weights}")

    (train_gen, val_gen, test_gen,
     steps_train, steps_val, steps_test) = build_data_generators(
        train_p, val_p, test_p,
        train_l, val_l, test_l,
        class_names,
    )

    return {
        "train_gen":     train_gen,
        "val_gen":       val_gen,
        "test_gen":      test_gen,
        "steps_train":   steps_train,
        "steps_val":     steps_val,
        "steps_test":    steps_test,
        "class_names":   class_names,
        "n_classes":     len(class_names),
        "class_weights": class_weights,
        "test_paths":    test_p,
        "test_labels":   test_l,
    }
