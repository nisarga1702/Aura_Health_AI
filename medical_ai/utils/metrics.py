"""
metrics.py
──────────
Medical-grade classification metrics for binary and multiclass problems.

For binary classification every metric is derived from the confusion-matrix
quadrant counts (TP, TN, FP, FN) and reported alongside sklearn wrappers.
For multiclass classification macro/weighted averages are used and the
binary-specific quantities (sensitivity, specificity) are computed per-class
then averaged.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Dict, Any, Optional, Tuple

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report,
)


# ──────────────────────────────────────────────────────────────────────────────
# Core helpers
# ──────────────────────────────────────────────────────────────────────────────

def _binary_cm_parts(cm: np.ndarray) -> Tuple[int, int, int, int]:
    """Extract (TN, FP, FN, TP) from a 2×2 confusion matrix."""
    if cm.shape != (2, 2):
        raise ValueError(
            f"Expected a 2×2 confusion matrix for binary classification, "
            f"got shape {cm.shape}."
        )
    tn, fp, fn, tp = cm.ravel()
    return int(tn), int(fp), int(fn), int(tp)


def sensitivity(tn: int, fp: int, fn: int, tp: int) -> float:
    """Sensitivity = TP / (TP + FN)  (a.k.a. Recall for the positive class)."""
    denom = tp + fn
    return tp / denom if denom > 0 else 0.0


def specificity(tn: int, fp: int, fn: int, tp: int) -> float:
    """Specificity = TN / (TN + FP)."""
    denom = tn + fp
    return tn / denom if denom > 0 else 0.0


# ──────────────────────────────────────────────────────────────────────────────
# Main entry-point
# ──────────────────────────────────────────────────────────────────────────────

def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: Optional[np.ndarray] = None,
    average: str = "weighted",
    class_names: Optional[list] = None,
) -> Dict[str, Any]:
    """
    Compute the full set of medical classification metrics.

    Parameters
    ----------
    y_true  : 1-D array of ground-truth integer labels.
    y_pred  : 1-D array of predicted integer labels.
    y_prob  : Probability scores.
                – Binary: 1-D array of P(positive class).
                – Multiclass: 2-D array of shape (n_samples, n_classes).
              Pass None to skip ROC-AUC.
    average : Averaging strategy for multiclass metrics.
    class_names : Optional list of class name strings (for the report).

    Returns
    -------
    dict with keys: accuracy, precision, recall, f1, sensitivity,
                    specificity, roc_auc, confusion_matrix,
                    classification_report, n_classes,
                    TP, TN, FP, FN  (binary only)
    """
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    n_classes = len(np.unique(y_true))
    is_binary = n_classes == 2

    acc       = accuracy_score(y_true, y_pred)
    prec      = precision_score(y_true, y_pred, average=average, zero_division=0)
    rec       = recall_score(y_true, y_pred, average=average, zero_division=0)
    f1        = f1_score(y_true, y_pred, average=average, zero_division=0)
    cm        = confusion_matrix(y_true, y_pred)
    cr        = classification_report(
        y_true, y_pred,
        target_names=class_names,
        zero_division=0,
    )

    result: Dict[str, Any] = {
        "accuracy":               round(acc, 4),
        "precision":              round(prec, 4),
        "recall":                 round(rec, 4),
        "f1":                     round(f1, 4),
        "confusion_matrix":       cm,
        "classification_report":  cr,
        "n_classes":              n_classes,
    }

    # ── Sensitivity / Specificity ──────────────────────────────────────────
    if is_binary:
        tn, fp, fn, tp = _binary_cm_parts(cm)
        sens = sensitivity(tn, fp, fn, tp)
        spec = specificity(tn, fp, fn, tp)
        result.update({
            "sensitivity": round(sens, 4),
            "specificity": round(spec, 4),
            "TP": tp, "TN": tn, "FP": fp, "FN": fn,
        })
    else:
        # Per-class sensitivity and specificity, then averaged
        sens_list, spec_list = [], []
        for i in range(n_classes):
            tp_i = cm[i, i]
            fn_i = cm[i, :].sum() - tp_i
            fp_i = cm[:, i].sum() - tp_i
            tn_i = cm.sum() - tp_i - fn_i - fp_i
            sens_list.append(sensitivity(int(tn_i), int(fp_i), int(fn_i), int(tp_i)))
            spec_list.append(specificity(int(tn_i), int(fp_i), int(fn_i), int(tp_i)))
        result["sensitivity"] = round(float(np.mean(sens_list)), 4)
        result["specificity"] = round(float(np.mean(spec_list)), 4)

    # ── ROC-AUC ───────────────────────────────────────────────────────────
    if y_prob is not None:
        try:
            if is_binary:
                prob_1d = y_prob[:, 1] if y_prob.ndim == 2 else y_prob
                auc = roc_auc_score(y_true, prob_1d)
            else:
                auc = roc_auc_score(
                    y_true, y_prob,
                    multi_class="ovr",
                    average=average,
                )
            result["roc_auc"] = round(float(auc), 4)
        except Exception as exc:
            print(f"[metrics] ROC-AUC could not be computed: {exc}")
            result["roc_auc"] = None
    else:
        result["roc_auc"] = None

    return result


def print_metrics(metrics: Dict[str, Any], modality: str = "") -> None:
    """Pretty-print a metrics dictionary to stdout."""
    header = f"{'─'*60}"
    tag = f"  {modality} Evaluation Results  " if modality else "  Evaluation Results  "
    print(f"\n{header}")
    print(tag)
    print(header)
    print(f"  Accuracy    : {metrics['accuracy']:.4f}")
    print(f"  Precision   : {metrics['precision']:.4f}")
    print(f"  Recall      : {metrics['recall']:.4f}")
    print(f"  F1-Score    : {metrics['f1']:.4f}")
    print(f"  Sensitivity : {metrics['sensitivity']:.4f}")
    print(f"  Specificity : {metrics['specificity']:.4f}")
    if metrics.get("roc_auc") is not None:
        print(f"  ROC-AUC     : {metrics['roc_auc']:.4f}")
    if metrics["n_classes"] == 2:
        print(f"\n  TP={metrics['TP']}  TN={metrics['TN']}  "
              f"FP={metrics['FP']}  FN={metrics['FN']}")
    print(f"\n{metrics['classification_report']}")
    print(header)


def build_summary_dataframe(results: Dict[str, Dict[str, Any]]) -> pd.DataFrame:
    """
    Build the consolidated summary table shown in the final report.

    Parameters
    ----------
    results : {modality_name: metrics_dict, ...}

    Returns
    -------
    pd.DataFrame with one row per modality.
    """
    rows = []
    for modality, m in results.items():
        rows.append({
            "Modality":    modality,
            "Accuracy":    m.get("accuracy"),
            "Precision":   m.get("precision"),
            "Recall":      m.get("recall"),
            "F1":          m.get("f1"),
            "Sensitivity": m.get("sensitivity"),
            "Specificity": m.get("specificity"),
            "ROC-AUC":     m.get("roc_auc"),
        })
    return pd.DataFrame(rows)
