"""
train_diabetes.py
──────────────────
Standalone training script for tabular diabetes classification.

Usage
─────
  python train_diabetes.py
  python train_diabetes.py --csv /path/to/diabetes.csv --target Outcome
  python train_diabetes.py --model RandomForest
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

# ── Reproducibility ────────────────────────────────────────────────────────────
from utils.config import RANDOM_SEED
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)
os.environ["PYTHONHASHSEED"] = str(RANDOM_SEED)

import joblib

from utils.config import (
    DIABETES_CSV_PATH,
    DIABETES_TARGET_COLUMN,
    TABULAR_MODEL_NAME,
    DIABETES_MODEL_PATH,
    DIABETES_PREP_PATH,
    DIABETES_HISTORY_PATH,
    RESULTS_DIR,
    METRICS_AVERAGE,
    ensure_dirs,
)
from utils.metrics import compute_metrics, print_metrics
from utils.visualization import (
    plot_confusion_matrix,
    plot_roc_curve,
    plot_class_distribution,
    plot_feature_importance,
    save_history,
)
from preprocessing.diabetes_preprocessing import (
    load_and_prepare,
    save_preprocessor,
)
from models.diabetes_model import build_model


# ──────────────────────────────────────────────────────────────────────────────
# Argument parser
# ──────────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train diabetes tabular classifier")
    parser.add_argument("--csv",    default=DIABETES_CSV_PATH,
                        help="Path to the diabetes CSV file")
    parser.add_argument("--target", default=DIABETES_TARGET_COLUMN,
                        help="Name of the target column in the CSV")
    parser.add_argument("--model",  default=TABULAR_MODEL_NAME,
                        help="Model type: XGBoost | RandomForest | MLP | LogisticRegression")
    parser.add_argument("--output", default=DIABETES_MODEL_PATH,
                        help="Path to save the trained model")
    parser.add_argument("--no-smote", action="store_true",
                        help="Disable SMOTE oversampling")
    return parser.parse_args()


# ──────────────────────────────────────────────────────────────────────────────
# Pipeline functions
# ──────────────────────────────────────────────────────────────────────────────

def load_data(csv_path: str, target_col: str, apply_smote: bool = True) -> dict:
    """Load and preprocess the diabetes CSV."""
    return load_and_prepare(
        csv_path=csv_path,
        target_col=target_col,
        apply_smote_flag=apply_smote,
    )


def train_model(data: dict, model_name: str) -> tuple:
    """
    Fit the tabular model.

    For sklearn-compatible models: model.fit(X_train, y_train).
    For KerasMLP: model.fit(X_train, y_train, validation_data=(X_val, y_val)).

    Returns (fitted_model, history_dict).
    """
    model = build_model(
        n_classes=data["n_classes"],
        n_features=data["n_features"],
        model_name=model_name,
        class_weights=data["class_weights"],
    )

    X_train, y_train = data["X_train"], data["y_train"]
    X_val,   y_val   = data["X_val"],   data["y_val"]

    print(f"\n  Fitting {model_name} on {X_train.shape[0]} training samples …")

    history: dict = {}

    if hasattr(model, "history_"):       # KerasMLP
        model.fit(X_train, y_train, validation_data=(X_val, y_val))
        history = getattr(model, "history_", {})
    elif hasattr(model, "fit"):          # sklearn / XGBoost
        eval_set = [(X_val, y_val)]
        try:
            model.fit(
                X_train, y_train,
                eval_set=eval_set,
                verbose=100,
            )
            # XGBoost stores its evaluation log
            try:
                history = {
                    k: v
                    for k, v in model.evals_result().items()
                }
            except AttributeError:
                history = {}
        except TypeError:
            # RandomForest / LogisticRegression don't accept eval_set
            model.fit(X_train, y_train)
    else:
        raise RuntimeError(f"Model {model_name} has no fit() method.")

    print(f"  Fitting complete.")
    return model, history


def evaluate_model(model, data: dict) -> dict:
    """Compute all medical classification metrics on the test set."""
    print("\n  Evaluating on test set …")
    X_test, y_test = data["X_test"], data["y_test"]

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)

    metrics = compute_metrics(
        y_test, y_pred, y_prob,
        average=METRICS_AVERAGE,
        class_names=data["class_names"],
    )
    print_metrics(metrics, "Diabetes")
    return metrics


def save_outputs(
    model,
    preprocessor: dict,
    history: dict,
    metrics: dict,
    data: dict,
    model_path: str,
) -> None:
    """Persist model artefacts and generate plots."""
    ensure_dirs()

    # ── Model ─────────────────────────────────────────────────────────────
    os.makedirs(Path(model_path).parent, exist_ok=True)
    if hasattr(model, "_model"):          # KerasMLP – save inner Keras model
        keras_path = str(Path(model_path).with_suffix(".keras"))
        model._model.save(keras_path)
        print(f"  Keras MLP saved → {keras_path}")
    else:
        joblib.dump(model, model_path)
        print(f"  Model saved → {model_path}")

    # ── Preprocessor ──────────────────────────────────────────────────────
    save_preprocessor(preprocessor, DIABETES_PREP_PATH)

    # ── History ───────────────────────────────────────────────────────────
    if history:
        save_history(history, DIABETES_HISTORY_PATH)

    # ── Class distribution ────────────────────────────────────────────────
    from collections import Counter
    dist = {data["class_names"][k]: v
            for k, v in sorted(Counter(data["y_test"].tolist()).items())}
    plot_class_distribution(
        dist,
        save_path=os.path.join(RESULTS_DIR, "diabetes_class_distribution.png"),
        title="Diabetes – Test Set Class Distribution",
    )

    # ── Confusion matrix ──────────────────────────────────────────────────
    plot_confusion_matrix(
        metrics["confusion_matrix"],
        class_names=data["class_names"],
        save_path=os.path.join(RESULTS_DIR, "diabetes_confusion_matrix.png"),
        title="Diabetes – Confusion Matrix",
    )

    # ── ROC curve ─────────────────────────────────────────────────────────
    y_prob = model.predict_proba(data["X_test"])
    plot_roc_curve(
        data["y_test"], y_prob,
        save_path=os.path.join(RESULTS_DIR, "diabetes_roc_curve.png"),
        title="Diabetes – ROC Curve",
        class_names=data["class_names"],
    )

    # ── Feature importance (tree-based models only) ───────────────────────
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
        feature_names = data.get("feature_names", [f"f{i}" for i in range(len(importances))])
        plot_feature_importance(
            feature_names, importances,
            save_path=os.path.join(RESULTS_DIR, "diabetes_feature_importance.png"),
            title="Diabetes – Feature Importance",
        )


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    args = parse_args()
    ensure_dirs()

    print("\n" + "═" * 60)
    print("  DIABETES TABULAR CLASSIFIER – TRAINING")
    print(f"  Model    : {args.model}")
    print(f"  CSV      : {args.csv}")
    print(f"  Target   : {args.target}")
    print("═" * 60)

    # 1. Load & preprocess
    data = load_data(
        csv_path=args.csv,
        target_col=args.target,
        apply_smote=not args.no_smote,
    )

    # 2. Train
    model, history = train_model(data, args.model)

    # 3. Evaluate
    metrics = evaluate_model(model, data)

    # 4. Save
    save_outputs(
        model,
        data["preprocessor"],
        history,
        metrics,
        data,
        args.output,
    )

    print("\n  ✓ Diabetes training complete.\n")


if __name__ == "__main__":
    main()
