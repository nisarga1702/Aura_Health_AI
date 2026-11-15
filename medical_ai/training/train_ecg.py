"""
train_ecg.py
─────────────
Standalone training script for ECG image classification (chronic heart disease).

Usage
─────
  python train_ecg.py
  python train_ecg.py --dataset /path/to/ecg --epochs 40
  python train_ecg.py --model ResNet50

The ECG module is completely independent from the retinal module.
"""

from __future__ import annotations

import argparse
import os
import random
import sys
from pathlib import Path

import numpy as np

# ── Path setup ─────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# ── Reproducibility ────────────────────────────────────────────────────────────
from utils.config import RANDOM_SEED
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)
os.environ["PYTHONHASHSEED"] = str(RANDOM_SEED)

import tensorflow as tf
tf.random.set_seed(RANDOM_SEED)

from utils.config import (
    ECG_DATASET_PATH,
    IMAGE_MODEL_NAME,
    BATCH_SIZE,
    EPOCHS,
    LEARNING_RATE,
    EARLY_STOPPING_PATIENCE,
    REDUCE_LR_PATIENCE,
    REDUCE_LR_FACTOR,
    MIN_LR,
    ECG_MODEL_PATH,
    ECG_ABNORMAL_THRESHOLD,
    ECG_HISTORY_PATH,
    RESULTS_DIR,
    LOGS_DIR,
    METRICS_AVERAGE,
    ensure_dirs,
)
from utils.metrics import compute_metrics, print_metrics
from utils.visualization import (
    plot_training_history,
    plot_confusion_matrix,
    plot_roc_curve,
    plot_class_distribution,
    save_history,
)
from preprocessing.ecg_preprocessing import load_and_prepare
from models.ecg_model import build_model, unfreeze_for_finetuning


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train ECG image classifier")
    parser.add_argument("--dataset", default=ECG_DATASET_PATH)
    parser.add_argument("--model",   default=IMAGE_MODEL_NAME)
    parser.add_argument("--epochs",  type=int, default=EPOCHS)
    parser.add_argument("--batch",   type=int, default=BATCH_SIZE)
    parser.add_argument("--lr",      type=float, default=LEARNING_RATE)
    parser.add_argument("--output",  default=ECG_MODEL_PATH)
    return parser.parse_args()


def load_data(dataset_path: str) -> dict:
    return load_and_prepare(dataset_path)


def build_callbacks(model_path: str) -> list:
    os.makedirs(Path(model_path).parent, exist_ok=True)
    return [
        tf.keras.callbacks.ModelCheckpoint(
            filepath=model_path,
            monitor="val_auc",
            save_best_only=True,
            mode="max",
            verbose=1,
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_auc",
            patience=EARLY_STOPPING_PATIENCE,
            restore_best_weights=True,
            mode="max",
            verbose=1,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=REDUCE_LR_FACTOR,
            patience=REDUCE_LR_PATIENCE,
            min_lr=MIN_LR,
            verbose=1,
        ),
        tf.keras.callbacks.TensorBoard(
            log_dir=os.path.join(LOGS_DIR, "ecg"),
        ),
    ]


def train_model(
    data: dict,
    model_name: str,
    epochs: int,
    learning_rate: float,
    model_path: str,
) -> tuple:
    """Two-phase training identical to the retinal pipeline."""
    n_classes     = data["n_classes"]
    class_weights = data["class_weights"]
    warmup_epochs = min(10, epochs // 4)

    print(f"\n{'─'*60}")
    print(f"  Phase 1 – Feature Extraction  ({warmup_epochs} epochs)")
    print(f"{'─'*60}")

    model = build_model(
        n_classes=n_classes,
        model_name=model_name,
        learning_rate=learning_rate,
        freeze_backbone=True,
    )
    callbacks = build_callbacks(model_path)

    h1 = model.fit(
        data["train_gen"],
        steps_per_epoch=data["steps_train"],
        validation_data=data["val_gen"],
        validation_steps=data["steps_val"],
        epochs=warmup_epochs,
        class_weight=class_weights,
        callbacks=callbacks,
        verbose=1,
    )

    remaining = epochs - warmup_epochs
    if remaining > 0:
        print(f"\n{'─'*60}")
        print(f"  Phase 2 – Fine-Tuning  ({remaining} epochs)")
        print(f"{'─'*60}")
        model = unfreeze_for_finetuning(model, learning_rate / 10, n_classes)
        h2 = model.fit(
            data["train_gen"],
            steps_per_epoch=data["steps_train"],
            validation_data=data["val_gen"],
            validation_steps=data["steps_val"],
            epochs=remaining,
            class_weight=class_weights,
            callbacks=callbacks,
            verbose=1,
        )
        combined = {}
        for k in set(list(h1.history.keys()) + list(h2.history.keys())):
            combined[k] = h1.history.get(k, []) + h2.history.get(k, [])
    else:
        combined = h1.history

    return model, combined


def evaluate_model(model, data: dict, class_names: list) -> dict:
    print("\n  Evaluating on test set …")
    test_gen = data["test_gen"]
    steps    = data["steps_test"]
    test_gen.reset()
    y_prob = model.predict(test_gen, steps=steps, verbose=1)
    y_pred = np.where(y_prob[:, 0] >= ECG_ABNORMAL_THRESHOLD, 0, 1)
    y_true = np.array(data["test_labels"])
    n = len(y_true)
    y_prob = y_prob[:n]; y_pred = y_pred[:n]

    metrics = compute_metrics(
        y_true, y_pred, y_prob,
        average=METRICS_AVERAGE,
        class_names=class_names,
    )
    print_metrics(metrics, "ECG")
    return metrics


def save_outputs(model, history: dict, metrics: dict, data: dict, model_path: str) -> None:
    ensure_dirs()
    save_history(history, ECG_HISTORY_PATH)

    plot_training_history(
        history,
        save_path=os.path.join(RESULTS_DIR, "ecg_training_curves.png"),
        title=f"ECG – {IMAGE_MODEL_NAME} Training History",
    )

    from collections import Counter
    dist = {data["class_names"][k]: v
            for k, v in sorted(Counter(data["test_labels"]).items())}
    plot_class_distribution(
        dist,
        save_path=os.path.join(RESULTS_DIR, "ecg_class_distribution.png"),
        title="ECG – Test Set Class Distribution",
    )

    plot_confusion_matrix(
        metrics["confusion_matrix"],
        class_names=data["class_names"],
        save_path=os.path.join(RESULTS_DIR, "ecg_confusion_matrix.png"),
        title="ECG – Confusion Matrix",
    )

    test_gen = data["test_gen"]
    test_gen.reset()
    y_prob = model.predict(test_gen, steps=data["steps_test"], verbose=0)
    y_true = np.array(data["test_labels"])
    plot_roc_curve(
        y_true, y_prob[:len(y_true)],
        save_path=os.path.join(RESULTS_DIR, "ecg_roc_curve.png"),
        title="ECG – ROC Curve",
        class_names=data["class_names"],
    )
    print(f"\n  Model saved → {model_path}")


def main() -> None:
    args = parse_args()
    ensure_dirs()

    print("\n" + "═" * 60)
    print("  ECG IMAGE CLASSIFIER – TRAINING")
    print(f"  Backbone : {args.model}")
    print(f"  Dataset  : {args.dataset}")
    print(f"  Epochs   : {args.epochs}")
    print("═" * 60)

    data            = load_data(args.dataset)
    model, history  = train_model(data, args.model, args.epochs,
                                   args.lr, args.output)
    metrics         = evaluate_model(model, data, data["class_names"])
    save_outputs(model, history, metrics, data, args.output)

    print("\n  ✓ ECG training complete.\n")


if __name__ == "__main__":
    main()
