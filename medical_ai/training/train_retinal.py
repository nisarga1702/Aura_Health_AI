"""
train_retinal.py
─────────────────
Standalone training script for the retinal fundus image classification model.

Usage
─────
  python train_retinal.py
  python train_retinal.py --dataset /path/to/retinal --epochs 30
  python train_retinal.py --model EfficientNetB3

Run from the project root or the training/ directory – sys.path is adjusted
automatically.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
from pathlib import Path

import numpy as np

# ── Path setup ─────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# ── Reproducibility (before any TF / keras import) ────────────────────────────
from utils.config import RANDOM_SEED
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)
os.environ["PYTHONHASHSEED"] = str(RANDOM_SEED)

import tensorflow as tf
tf.random.set_seed(RANDOM_SEED)

from utils.config import (
    RETINAL_DATASET_PATH,
    IMAGE_MODEL_NAME,
    IMAGE_SIZE,
    BATCH_SIZE,
    EPOCHS,
    LEARNING_RATE,
    EARLY_STOPPING_PATIENCE,
    REDUCE_LR_PATIENCE,
    REDUCE_LR_FACTOR,
    MIN_LR,
    RETINAL_MODEL_PATH,
    RETINAL_HISTORY_PATH,
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
from preprocessing.retinal_preprocessing import load_and_prepare
from models.retinal_model import build_model, unfreeze_for_finetuning


# ──────────────────────────────────────────────────────────────────────────────
# Argument parser
# ──────────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train retinal image classifier")
    parser.add_argument("--dataset", default=RETINAL_DATASET_PATH,
                        help="Path to retinal dataset directory")
    parser.add_argument("--model",   default=IMAGE_MODEL_NAME,
                        help="Backbone model name (e.g. EfficientNetB0)")
    parser.add_argument("--epochs",  type=int, default=EPOCHS)
    parser.add_argument("--batch",   type=int, default=BATCH_SIZE)
    parser.add_argument("--lr",      type=float, default=LEARNING_RATE)
    parser.add_argument("--output",  default=RETINAL_MODEL_PATH,
                        help="Where to save the trained model")
    return parser.parse_args()


# ──────────────────────────────────────────────────────────────────────────────
# Pipeline functions
# ──────────────────────────────────────────────────────────────────────────────

def load_data(dataset_path: str) -> dict:
    """Load and preprocess the retinal dataset."""
    return load_and_prepare(dataset_path)


def build_callbacks(model_path: str) -> list:
    """Construct Keras training callbacks."""
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
            log_dir=os.path.join(LOGS_DIR, "retinal"),
            histogram_freq=0,
        ),
    ]


def train_model(
    data: dict,
    model_name: str,
    epochs: int,
    learning_rate: float,
    model_path: str,
) -> tuple:
    """
    Two-phase training:
      Phase 1 – Feature extraction (frozen backbone, ~10 epochs warm-up).
      Phase 2 – Fine-tuning (partial unfreeze, lower lr, remaining epochs).
    """
    n_classes   = data["n_classes"]
    class_weights = data["class_weights"]

    # ── Phase 1: feature extraction ───────────────────────────────────────
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

    # ── Phase 2: fine-tuning ──────────────────────────────────────────────
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
        # Merge histories
        combined = {}
        for k in set(list(h1.history.keys()) + list(h2.history.keys())):
            combined[k] = h1.history.get(k, []) + h2.history.get(k, [])
    else:
        combined = h1.history

    return model, combined


def evaluate_model(model, data: dict, class_names: list) -> dict:
    """Run the model on the test generator and compute full metrics."""
    print("\n  Evaluating on test set …")
    test_gen  = data["test_gen"]
    steps     = data["steps_test"]

    test_gen.reset()
    y_prob = model.predict(test_gen, steps=steps, verbose=1)
    y_pred = np.argmax(y_prob, axis=1)
    y_true = np.array(data["test_labels"])

    # Trim to actual number of test samples (generators may over-batch)
    n = len(y_true)
    y_prob = y_prob[:n]
    y_pred = y_pred[:n]

    metrics = compute_metrics(
        y_true, y_pred, y_prob,
        average=METRICS_AVERAGE,
        class_names=class_names,
    )
    print_metrics(metrics, "Retinal")
    return metrics


def save_outputs(model, history: dict, metrics: dict, data: dict, model_path: str) -> None:
    """Persist model, history, and visualisation plots."""
    ensure_dirs()
    save_history(history, RETINAL_HISTORY_PATH)

    # Training curves
    plot_training_history(
        history,
        save_path=os.path.join(RESULTS_DIR, "retinal_training_curves.png"),
        title=f"Retinal – {IMAGE_MODEL_NAME} Training History",
    )

    # Class distribution
    from collections import Counter
    label_counts = Counter(data["test_labels"])
    class_names  = data["class_names"]
    dist = {class_names[k]: v for k, v in sorted(label_counts.items())}
    plot_class_distribution(
        dist,
        save_path=os.path.join(RESULTS_DIR, "retinal_class_distribution.png"),
        title="Retinal – Test Set Class Distribution",
    )

    # Confusion matrix
    plot_confusion_matrix(
        metrics["confusion_matrix"],
        class_names=class_names,
        save_path=os.path.join(RESULTS_DIR, "retinal_confusion_matrix.png"),
        title="Retinal – Confusion Matrix",
    )

    # ROC curve (re-run test_gen for probabilities)
    test_gen = data["test_gen"]
    test_gen.reset()
    y_prob = model.predict(test_gen, steps=data["steps_test"], verbose=0)
    y_true = np.array(data["test_labels"])
    n = len(y_true)
    plot_roc_curve(
        y_true, y_prob[:n],
        save_path=os.path.join(RESULTS_DIR, "retinal_roc_curve.png"),
        title="Retinal – ROC Curve",
        class_names=class_names,
    )
    print(f"\n  Model saved → {model_path}")


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    args = parse_args()
    ensure_dirs()

    print("\n" + "═" * 60)
    print("  RETINAL FUNDUS IMAGE CLASSIFIER – TRAINING")
    print(f"  Backbone : {args.model}")
    print(f"  Dataset  : {args.dataset}")
    print(f"  Epochs   : {args.epochs}")
    print("═" * 60)

    # 1. Load data
    data = load_data(args.dataset)

    # 2. Train (two-phase)
    model, history = train_model(
        data,
        model_name=args.model,
        epochs=args.epochs,
        learning_rate=args.lr,
        model_path=args.output,
    )

    # 3. Evaluate
    metrics = evaluate_model(model, data, data["class_names"])

    # 4. Save everything
    save_outputs(model, history, metrics, data, args.output)

    print("\n  ✓ Retinal training complete.\n")


if __name__ == "__main__":
    main()
