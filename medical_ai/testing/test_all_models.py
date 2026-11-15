"""
test_all_models.py
───────────────────
Unified evaluation script that loads all three trained models, runs them on
their respective test datasets, and produces a consolidated clinical report.

Usage – Option 1 (explicit paths)
──────────────────────────────────
  python test_all_models.py \
      --retinal_data  /path/to/retinal \
      --ecg_data      /path/to/ecg \
      --diabetes_data /path/to/diabetes.csv

Usage – Option 2 (use defaults from config.py)
───────────────────────────────────────────────
  python test_all_models.py

Run from project root or testing/ directory.

Output
──────
  results/
  ├── retinal_confusion_matrix.png
  ├── ecg_confusion_matrix.png
  ├── diabetes_confusion_matrix.png
  ├── retinal_roc_curve.png
  ├── ecg_roc_curve.png
  ├── diabetes_roc_curve.png
  └── final_results.csv
"""

from __future__ import annotations

import argparse
import os
import sys
import warnings
from pathlib import Path

import numpy as np

# ── Path setup ─────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from utils.config import (
    RETINAL_DATASET_PATH,
    ECG_DATASET_PATH,
    DIABETES_CSV_PATH,
    DIABETES_TARGET_COLUMN,
    RETINAL_MODEL_PATH,
    ECG_MODEL_PATH,
    ECG_ABNORMAL_THRESHOLD,
    DIABETES_MODEL_PATH,
    DIABETES_PREP_PATH,
    RESULTS_DIR,
    METRICS_AVERAGE,
    IMAGE_MODEL_NAME,
    TABULAR_MODEL_NAME,
    ensure_dirs,
)
from utils.metrics import compute_metrics, print_metrics, build_summary_dataframe
from utils.visualization import plot_confusion_matrix, plot_roc_curve


# ──────────────────────────────────────────────────────────────────────────────
# Argument parser
# ──────────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Test all three medical AI models and produce a combined report."
    )
    parser.add_argument("--retinal_data",  default=RETINAL_DATASET_PATH,
                        help="Path to retinal image dataset")
    parser.add_argument("--ecg_data",      default=ECG_DATASET_PATH,
                        help="Path to ECG image dataset")
    parser.add_argument("--diabetes_data", default=DIABETES_CSV_PATH,
                        help="Path to diabetes CSV file")
    parser.add_argument("--diabetes_target", default=DIABETES_TARGET_COLUMN)
    parser.add_argument("--retinal_model",  default=RETINAL_MODEL_PATH)
    parser.add_argument("--ecg_model",      default=ECG_MODEL_PATH)
    parser.add_argument("--diabetes_model", default=DIABETES_MODEL_PATH)
    parser.add_argument("--diabetes_prep",  default=DIABETES_PREP_PATH)
    parser.add_argument("--output_dir",     default=RESULTS_DIR)
    return parser.parse_args()


# ──────────────────────────────────────────────────────────────────────────────
# Model loaders
# ──────────────────────────────────────────────────────────────────────────────

def load_keras_model(model_path: str, label: str):
    """Load a saved Keras model from disk."""
    if not Path(model_path).exists():
        raise FileNotFoundError(
            f"{label} model not found at: {model_path}\n"
            "Please run the corresponding training script first."
        )
    import tensorflow as tf
    model = tf.keras.models.load_model(model_path)
    print(f"  [✓] {label} model loaded from {model_path}")
    return model


def load_sklearn_model(model_path: str, label: str):
    """Load a saved sklearn / XGBoost model."""
    if not Path(model_path).exists():
        raise FileNotFoundError(
            f"{label} model not found at: {model_path}\n"
            "Please run train_diabetes.py first."
        )
    import joblib
    model = joblib.load(model_path)
    print(f"  [✓] {label} model loaded from {model_path}")
    return model


def load_preprocessor(prep_path: str):
    """Load the diabetes preprocessing pipeline."""
    if not Path(prep_path).exists():
        raise FileNotFoundError(
            f"Diabetes preprocessor not found at: {prep_path}\n"
            "Please run train_diabetes.py first."
        )
    import joblib
    prep = joblib.load(prep_path)
    print(f"  [✓] Diabetes preprocessor loaded from {prep_path}")
    return prep


# ──────────────────────────────────────────────────────────────────────────────
# Per-modality test functions
# ──────────────────────────────────────────────────────────────────────────────

def test_retinal(
    model,
    dataset_path: str,
    output_dir: str,
) -> dict:
    """Evaluate the retinal model on its test split."""
    print("\n" + "─" * 60)
    print("  Testing: RETINAL model")
    print("─" * 60)

    from preprocessing.retinal_preprocessing import load_and_prepare
    data = load_and_prepare(dataset_path)

    test_gen     = data["test_gen"]
    steps_test   = data["steps_test"]
    class_names  = data["class_names"]
    y_true       = np.array(data["test_labels"])

    test_gen.reset()
    y_prob = model.predict(test_gen, steps=steps_test, verbose=1)
    y_pred = np.argmax(y_prob, axis=1)
    n = len(y_true)
    y_prob = y_prob[:n]; y_pred = y_pred[:n]

    metrics = compute_metrics(y_true, y_pred, y_prob,
                               average=METRICS_AVERAGE,
                               class_names=class_names)
    print_metrics(metrics, "Retinal")

    plot_confusion_matrix(
        metrics["confusion_matrix"],
        class_names=class_names,
        save_path=os.path.join(output_dir, "retinal_confusion_matrix.png"),
        title="Retinal – Confusion Matrix (Test)",
    )
    plot_roc_curve(
        y_true, y_prob,
        save_path=os.path.join(output_dir, "retinal_roc_curve.png"),
        title="Retinal – ROC Curve (Test)",
        class_names=class_names,
    )
    return metrics


def test_ecg(
    model,
    dataset_path: str,
    output_dir: str,
) -> dict:
    """Evaluate the ECG model on its test split."""
    print("\n" + "─" * 60)
    print("  Testing: ECG model")
    print("─" * 60)

    from preprocessing.ecg_preprocessing import load_and_prepare
    data = load_and_prepare(dataset_path)

    test_gen    = data["test_gen"]
    steps_test  = data["steps_test"]
    class_names = data["class_names"]
    y_true      = np.array(data["test_labels"])

    test_gen.reset()
    y_prob = model.predict(test_gen, steps=steps_test, verbose=1)
    y_pred = np.where(y_prob[:, 0] >= ECG_ABNORMAL_THRESHOLD, 0, 1)
    n = len(y_true)
    y_prob = y_prob[:n]; y_pred = y_pred[:n]

    metrics = compute_metrics(y_true, y_pred, y_prob,
                               average=METRICS_AVERAGE,
                               class_names=class_names)
    print_metrics(metrics, "ECG")

    plot_confusion_matrix(
        metrics["confusion_matrix"],
        class_names=class_names,
        save_path=os.path.join(output_dir, "ecg_confusion_matrix.png"),
        title="ECG – Confusion Matrix (Test)",
    )
    plot_roc_curve(
        y_true, y_prob,
        save_path=os.path.join(output_dir, "ecg_roc_curve.png"),
        title="ECG – ROC Curve (Test)",
        class_names=class_names,
    )
    return metrics


def test_diabetes(
    model,
    preprocessor: dict,
    csv_path: str,
    target_col: str,
    output_dir: str,
) -> dict:
    """Evaluate the diabetes model on its test split."""
    print("\n" + "─" * 60)
    print("  Testing: DIABETES model")
    print("─" * 60)

    from preprocessing.diabetes_preprocessing import load_and_prepare, apply_preprocessor
    data = load_and_prepare(csv_path, target_col, apply_smote_flag=False)

    # load_and_prepare already returns the leakage-free transformed test split.
    X_test  = data["X_test"]
    y_test  = data["y_test"]
    class_names = data["class_names"]

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)

    metrics = compute_metrics(y_test, y_pred, y_prob,
                               average=METRICS_AVERAGE,
                               class_names=class_names)
    print_metrics(metrics, "Diabetes")

    plot_confusion_matrix(
        metrics["confusion_matrix"],
        class_names=class_names,
        save_path=os.path.join(output_dir, "diabetes_confusion_matrix.png"),
        title="Diabetes – Confusion Matrix (Test)",
    )
    plot_roc_curve(
        y_test, y_prob,
        save_path=os.path.join(output_dir, "diabetes_roc_curve.png"),
        title="Diabetes – ROC Curve (Test)",
        class_names=class_names,
    )
    return metrics


# ──────────────────────────────────────────────────────────────────────────────
# Final report
# ──────────────────────────────────────────────────────────────────────────────

def generate_final_report(
    all_metrics: dict,
    output_dir: str,
    model_names: dict,
) -> None:
    """Print the consolidated table and save it as CSV."""
    import pandas as pd

    df = build_summary_dataframe(all_metrics)

    # Insert model name column
    df.insert(1, "Model", [model_names.get(m, "N/A") for m in df["Modality"]])

    csv_path = os.path.join(output_dir, "final_results.csv")
    df.to_csv(csv_path, index=False)

    # ── Pretty table ──────────────────────────────────────────────────────
    print("\n" + "═" * 80)
    print("  FINAL CONSOLIDATED EVALUATION REPORT")
    print("═" * 80)
    col_widths = {
        "Modality":    10, "Model": 18, "Accuracy": 10, "Precision": 10,
        "Recall": 8, "F1": 8, "Sensitivity": 13, "Specificity": 13, "ROC-AUC": 9,
    }
    header = " | ".join(f"{c:>{w}}" for c, w in col_widths.items())
    sep    = "-+-".join("-" * w for w in col_widths.values())
    print(header)
    print(sep)
    for _, row in df.iterrows():
        cells = []
        for col, w in col_widths.items():
            val = row.get(col, "N/A")
            if isinstance(val, float):
                cells.append(f"{val:>{w}.4f}")
            else:
                cells.append(f"{str(val):>{w}}")
        print(" | ".join(cells))
    print("═" * 80)
    print(f"\n  Results saved → {csv_path}")


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    args = parse_args()
    ensure_dirs()
    os.makedirs(args.output_dir, exist_ok=True)

    print("\n" + "═" * 60)
    print("  MULTIMODAL MEDICAL AI – UNIFIED EVALUATION")
    print("═" * 60)

    all_metrics: dict = {}
    model_names: dict = {}
    errors: list = []

    # ── 1. Retinal ─────────────────────────────────────────────────────────
    try:
        retinal_model = load_keras_model(args.retinal_model, "Retinal")
        metrics = test_retinal(retinal_model, args.retinal_data, args.output_dir)
        all_metrics["Retinal"] = metrics
        model_names["Retinal"] = IMAGE_MODEL_NAME
    except Exception as exc:
        warnings.warn(f"Retinal evaluation failed: {exc}")
        errors.append(f"Retinal: {exc}")

    # ── 2. ECG ─────────────────────────────────────────────────────────────
    try:
        ecg_model = load_keras_model(args.ecg_model, "ECG")
        metrics = test_ecg(ecg_model, args.ecg_data, args.output_dir)
        all_metrics["ECG"] = metrics
        model_names["ECG"] = IMAGE_MODEL_NAME
    except Exception as exc:
        warnings.warn(f"ECG evaluation failed: {exc}")
        errors.append(f"ECG: {exc}")

    # ── 3. Diabetes ────────────────────────────────────────────────────────
    try:
        diabetes_model = load_sklearn_model(args.diabetes_model, "Diabetes")
        preprocessor   = load_preprocessor(args.diabetes_prep)
        metrics = test_diabetes(
            diabetes_model, preprocessor,
            args.diabetes_data, args.diabetes_target,
            args.output_dir,
        )
        all_metrics["Diabetes"] = metrics
        model_names["Diabetes"] = TABULAR_MODEL_NAME
    except Exception as exc:
        warnings.warn(f"Diabetes evaluation failed: {exc}")
        errors.append(f"Diabetes: {exc}")

    # ── Final report ───────────────────────────────────────────────────────
    if all_metrics:
        generate_final_report(all_metrics, args.output_dir, model_names)
    else:
        print("\n  ✗ No models were successfully evaluated.")

    if errors:
        print("\n  Errors encountered:")
        for e in errors:
            print(f"    • {e}")

    print("\n  ✓ Evaluation complete.\n")


if __name__ == "__main__":
    main()
