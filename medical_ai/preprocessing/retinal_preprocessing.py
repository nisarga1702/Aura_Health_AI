"""
retinal_preprocessing.py
─────────────────────────
Data loading, validation and preprocessing for the retinal fundus image dataset.

Expected dataset layout
───────────────────────
  <RETINAL_DATASET_PATH>/
      <class_name_1>/
          img001.jpg
          img002.png
          ...
      <class_name_2>/
          ...

Classes are inferred automatically from sub-directory names so no hard-coding
is required.  Change RETINAL_DATASET_PATH in config.py to point at your data.
"""

from __future__ import annotations

import os
import random
import warnings
from pathlib import Path
from typing import Tuple, Dict, List, Optional

import numpy as np
from PIL import Image, UnidentifiedImageError

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.config import (
    RETINAL_DATASET_PATH,
    IMAGE_SIZE,
    BATCH_SIZE,
    VALIDATION_SPLIT,
    TEST_SPLIT,
    RANDOM_SEED,
    RETINAL_AUG,
)

# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}


# ──────────────────────────────────────────────────────────────────────────────
# Dataset discovery
# ──────────────────────────────────────────────────────────────────────────────

def discover_dataset(dataset_path: str) -> Tuple[List[str], List[int], List[str]]:
    """
    Walk a class-subdirectory dataset and return parallel lists of
    (file_paths, integer_labels, class_names).

    Raises
    ------
    FileNotFoundError  – if dataset_path does not exist.
    ValueError         – if no valid class subdirectories are found.
    """
    root = Path(dataset_path)
    if not root.exists():
        raise FileNotFoundError(
            f"Retinal dataset path does not exist: {dataset_path}\n"
            "Please set RETINAL_DATASET_PATH in utils/config.py."
        )

    class_dirs = sorted([d for d in root.iterdir() if d.is_dir()])
    if not class_dirs:
        raise ValueError(
            f"No class subdirectories found in {dataset_path}.\n"
            "Expected structure:\n"
            "  retinal/\n"
            "      class_0/\n"
            "      class_1/\n"
            "      ..."
        )

    class_names: List[str] = [d.name for d in class_dirs]
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
            warnings.warn(f"Class directory '{cls_dir.name}' has no valid images.")

    if not file_paths:
        raise ValueError(f"No images found under {dataset_path}.")

    return file_paths, labels, class_names


# ──────────────────────────────────────────────────────────────────────────────
# Image validation
# ──────────────────────────────────────────────────────────────────────────────

def validate_images(
    file_paths: List[str],
    labels: List[int],
) -> Tuple[List[str], List[int]]:
    """
    Remove corrupt or unreadable images from the dataset.

    Returns
    -------
    Filtered (file_paths, labels) with bad files removed.
    """
    valid_paths, valid_labels = [], []
    n_bad = 0
    for fp, lbl in zip(file_paths, labels):
        try:
            with Image.open(fp) as img:
                img.verify()          # lightweight header check
            valid_paths.append(fp)
            valid_labels.append(lbl)
        except (UnidentifiedImageError, OSError, Exception) as exc:
            warnings.warn(f"Skipping corrupt image {fp}: {exc}")
            n_bad += 1

    if n_bad > 0:
        print(f"[retinal_prep] Removed {n_bad} corrupt image(s).")
    return valid_paths, valid_labels


# ──────────────────────────────────────────────────────────────────────────────
# Train / val / test split  (no data leakage – purely index-based)
# ──────────────────────────────────────────────────────────────────────────────

def stratified_split(
    file_paths: List[str],
    labels: List[int],
    val_split: float = VALIDATION_SPLIT,
    test_split: float = TEST_SPLIT,
    seed: int = RANDOM_SEED,
) -> Tuple[List[str], List[str], List[str], List[int], List[int], List[int]]:
    """
    Stratified train / val / test split without using sklearn to avoid
    any accidental import of test statistics into the training pipeline.

    Returns
    -------
    (train_paths, val_paths, test_paths,
     train_labels, val_labels, test_labels)
    """
    rng = random.Random(seed)
    label_to_paths: Dict[int, List[str]] = {}
    for fp, lbl in zip(file_paths, labels):
        label_to_paths.setdefault(lbl, []).append(fp)

    train_p, val_p, test_p = [], [], []
    train_l, val_l, test_l = [], [], []

    for lbl, paths in label_to_paths.items():
        paths_shuffled = paths[:]
        rng.shuffle(paths_shuffled)
        n = len(paths_shuffled)
        n_test = max(1, int(n * test_split))
        n_val  = max(1, int(n * val_split))
        test_paths  = paths_shuffled[:n_test]
        val_paths   = paths_shuffled[n_test: n_test + n_val]
        train_paths = paths_shuffled[n_test + n_val:]
        train_p.extend(train_paths); train_l.extend([lbl] * len(train_paths))
        val_p.extend(val_paths);     val_l.extend([lbl] * len(val_paths))
        test_p.extend(test_paths);   test_l.extend([lbl] * len(test_paths))

    return train_p, val_p, test_p, train_l, val_l, test_l


# ──────────────────────────────────────────────────────────────────────────────
# Class distribution & imbalance handling
# ──────────────────────────────────────────────────────────────────────────────

def compute_class_weights(labels: List[int]) -> Dict[int, float]:
    """
    Compute balanced class weights using the sklearn formula:
      weight_c = n_samples / (n_classes * count_c)

    These weights are passed to model.fit(class_weight=...) so the loss
    function penalises the majority class more, addressing imbalance
    WITHOUT generating synthetic images (which can introduce artefacts
    in medical imaging).
    """
    counts = np.bincount(labels)
    n_samples = len(labels)
    n_classes = len(counts)
    weights = {}
    for c, cnt in enumerate(counts):
        weights[c] = n_samples / (n_classes * cnt) if cnt > 0 else 1.0
    return weights


def print_class_distribution(
    labels: List[int],
    class_names: List[str],
    split_name: str = "Dataset",
) -> None:
    """Print a readable class distribution summary."""
    counts = np.bincount(labels, minlength=len(class_names))
    total  = counts.sum()
    print(f"\n  {split_name} class distribution ({total} samples):")
    for i, name in enumerate(class_names):
        pct = 100.0 * counts[i] / total if total > 0 else 0
        print(f"    [{i}] {name:30s}  {counts[i]:6d}  ({pct:.1f} %)")


# ──────────────────────────────────────────────────────────────────────────────
# Keras data generators (training vs inference)
# ──────────────────────────────────────────────────────────────────────────────

def build_data_generators(
    train_paths: List[str],
    val_paths: List[str],
    test_paths: List[str],
    train_labels: List[int],
    val_labels: List[int],
    test_labels: List[int],
    class_names: List[str],
    image_size: Tuple[int, int] = IMAGE_SIZE,
    batch_size: int = BATCH_SIZE,
):
    """
    Build TensorFlow/Keras ImageDataGenerators for all three splits.

    Augmentation is applied ONLY to the training generator.
    Validation and test generators use only rescaling.

    Data-leakage notes
    ──────────────────
    • Augmentation uses only the training split.
    • Normalisation (rescale 1/255) is a fixed transform; it does not
      "learn" any statistics from data, so it is safe to apply to all splits.
    • The test generator is built here but is only called from test_all_models.py.

    Returns
    -------
    (train_gen, val_gen, test_gen, steps_per_epoch, val_steps, test_steps)
    """
    import tensorflow as tf
    from tensorflow.keras.preprocessing.image import ImageDataGenerator  # type: ignore
    import pandas as pd

    # DataFrames used by flow_from_dataframe
    def _make_df(paths, labels):
        return pd.DataFrame({
            "filepath": paths,
            "label":    [class_names[l] for l in labels],
        })

    train_df = _make_df(train_paths, train_labels)
    val_df   = _make_df(val_paths,   val_labels)
    test_df  = _make_df(test_paths,  test_labels)

    train_datagen = ImageDataGenerator(rescale=1.0 / 255.0, **RETINAL_AUG)
    infer_datagen = ImageDataGenerator(rescale=1.0 / 255.0)

    common_kwargs = dict(
        x_col="filepath",
        y_col="label",
        target_size=image_size,
        batch_size=batch_size,
        class_mode="categorical",
        classes=class_names,
    )

    train_gen = train_datagen.flow_from_dataframe(
        train_df, **common_kwargs, shuffle=True, seed=RANDOM_SEED
    )
    val_gen = infer_datagen.flow_from_dataframe(
        val_df, **common_kwargs, shuffle=False
    )
    test_gen = infer_datagen.flow_from_dataframe(
        test_df, **common_kwargs, shuffle=False
    )

    steps_train = int(np.ceil(len(train_paths) / batch_size))
    steps_val   = int(np.ceil(len(val_paths)   / batch_size))
    steps_test  = int(np.ceil(len(test_paths)  / batch_size))

    return train_gen, val_gen, test_gen, steps_train, steps_val, steps_test


# ──────────────────────────────────────────────────────────────────────────────
# Public convenience wrapper
# ──────────────────────────────────────────────────────────────────────────────

def load_and_prepare(
    dataset_path: str = RETINAL_DATASET_PATH,
) -> Dict:
    """
    Full preprocessing pipeline.  Returns a dict with all generators,
    class metadata, and class-weight information ready for training.
    """
    print("\n" + "═" * 60)
    print("  Retinal Dataset – Loading & Preprocessing")
    print("═" * 60)

    file_paths, labels, class_names = discover_dataset(dataset_path)
    print(f"  Found {len(file_paths)} images across {len(class_names)} classes.")

    file_paths, labels = validate_images(file_paths, labels)

    print_class_distribution(labels, class_names, "Full")

    (train_p, val_p, test_p,
     train_l, val_l, test_l) = stratified_split(file_paths, labels)

    print_class_distribution(train_l, class_names, "Train")
    print_class_distribution(val_l,   class_names, "Validation")
    print_class_distribution(test_l,  class_names, "Test")

    class_weights = compute_class_weights(train_l)
    print(f"\n  Class weights (for imbalance correction): {class_weights}")

    (train_gen, val_gen, test_gen,
     steps_train, steps_val, steps_test) = build_data_generators(
        train_p, val_p, test_p,
        train_l, val_l, test_l,
        class_names,
    )

    return {
        "train_gen":    train_gen,
        "val_gen":      val_gen,
        "test_gen":     test_gen,
        "steps_train":  steps_train,
        "steps_val":    steps_val,
        "steps_test":   steps_test,
        "class_names":  class_names,
        "n_classes":    len(class_names),
        "class_weights": class_weights,
        "test_paths":   test_p,
        "test_labels":  test_l,
    }
