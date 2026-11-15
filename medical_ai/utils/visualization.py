"""
visualization.py
────────────────
All plotting functions used across the three modalities.

Every function saves to disk and optionally returns the figure object.
No plt.show() calls are made so the code runs cleanly in headless / CI
environments.
"""

from __future__ import annotations

import os
import json
from pathlib import Path
from typing import Dict, Any, Optional, List

import numpy as np
import matplotlib
matplotlib.use("Agg")          # non-interactive backend safe for servers
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.metrics import roc_curve, auc
from sklearn.preprocessing import label_binarize


# ──────────────────────────────────────────────────────────────────────────────
# Style
# ──────────────────────────────────────────────────────────────────────────────
PALETTE = "Blues"
FONT_SIZE = 12
plt.rcParams.update({
    "font.size":       FONT_SIZE,
    "axes.titlesize":  FONT_SIZE + 2,
    "axes.labelsize":  FONT_SIZE,
    "xtick.labelsize": FONT_SIZE - 1,
    "ytick.labelsize": FONT_SIZE - 1,
    "figure.dpi":      150,
})


# ──────────────────────────────────────────────────────────────────────────────
# Training curves
# ──────────────────────────────────────────────────────────────────────────────

def plot_training_history(
    history: Dict[str, List[float]],
    save_path: str,
    title: str = "Training History",
) -> None:
    """
    Plot loss and accuracy (or any metric) curves from a Keras-style
    history dict: {"loss": [...], "val_loss": [...], "accuracy": [...], ...}
    """
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle(title, fontweight="bold")

    # ── Loss ──
    ax = axes[0]
    ax.plot(history.get("loss", []), label="Train Loss", linewidth=2)
    if "val_loss" in history:
        ax.plot(history["val_loss"], label="Val Loss", linewidth=2, linestyle="--")
    ax.set_title("Loss")
    ax.set_xlabel("Epoch")
    ax.set_ylabel("Loss")
    ax.legend()
    ax.grid(alpha=0.3)

    # ── Accuracy (or any second metric) ──
    ax = axes[1]
    acc_key = next((k for k in history if "acc" in k and "val" not in k), None)
    val_acc_key = next((k for k in history if "acc" in k and "val" in k), None)
    if acc_key:
        ax.plot(history[acc_key], label="Train Accuracy", linewidth=2)
    if val_acc_key:
        ax.plot(history[val_acc_key], label="Val Accuracy", linewidth=2, linestyle="--")
    ax.set_title("Accuracy")
    ax.set_xlabel("Epoch")
    ax.set_ylabel("Accuracy")
    ax.legend()
    ax.grid(alpha=0.3)

    plt.tight_layout()
    os.makedirs(Path(save_path).parent, exist_ok=True)
    plt.savefig(save_path, bbox_inches="tight")
    plt.close(fig)
    print(f"[viz] Training history saved → {save_path}")


# ──────────────────────────────────────────────────────────────────────────────
# Confusion matrix
# ──────────────────────────────────────────────────────────────────────────────

def plot_confusion_matrix(
    cm: np.ndarray,
    class_names: Optional[List[str]],
    save_path: str,
    title: str = "Confusion Matrix",
    normalize: bool = False,
) -> None:
    """
    Plot and save a confusion matrix heatmap.

    Parameters
    ----------
    normalize : If True, normalise rows to show proportions.
    """
    if normalize:
        row_sums = cm.sum(axis=1, keepdims=True)
        cm_plot = np.where(row_sums == 0, 0, cm / row_sums)
        fmt = ".2f"
    else:
        cm_plot = cm
        fmt = "d"

    n = cm.shape[0]
    fig, ax = plt.subplots(figsize=(max(6, n * 1.5), max(5, n * 1.3)))
    sns.heatmap(
        cm_plot,
        annot=True,
        fmt=fmt,
        cmap=PALETTE,
        xticklabels=class_names or list(range(n)),
        yticklabels=class_names or list(range(n)),
        ax=ax,
        linewidths=0.5,
    )
    ax.set_title(title, fontweight="bold", pad=12)
    ax.set_ylabel("True Label")
    ax.set_xlabel("Predicted Label")
    plt.tight_layout()

    os.makedirs(Path(save_path).parent, exist_ok=True)
    plt.savefig(save_path, bbox_inches="tight")
    plt.close(fig)
    print(f"[viz] Confusion matrix saved → {save_path}")


# ──────────────────────────────────────────────────────────────────────────────
# ROC curve
# ──────────────────────────────────────────────────────────────────────────────

def plot_roc_curve(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    save_path: str,
    title: str = "ROC Curve",
    class_names: Optional[List[str]] = None,
) -> None:
    """
    Plot ROC curve(s) and save.

    – Binary: single curve.
    – Multiclass: one-vs-rest curve per class + micro-average.

    Parameters
    ----------
    y_prob : (n_samples,) for binary or (n_samples, n_classes) for multiclass.
    """
    n_classes = len(np.unique(y_true))
    fig, ax = plt.subplots(figsize=(8, 6))

    if n_classes == 2:
        # Binary ──────────────────────────────────────────────────────────────
        prob_pos = y_prob[:, 1] if y_prob.ndim == 2 else y_prob
        fpr, tpr, _ = roc_curve(y_true, prob_pos)
        roc_auc = auc(fpr, tpr)
        ax.plot(fpr, tpr, linewidth=2,
                label=f"ROC (AUC = {roc_auc:.3f})", color="steelblue")
    else:
        # Multiclass OvR ─────────────────────────────────────────────────────
        classes = np.unique(y_true)
        y_bin = label_binarize(y_true, classes=classes)
        colors = plt.cm.tab10(np.linspace(0, 1, n_classes))

        for i, cls in enumerate(classes):
            fpr_i, tpr_i, _ = roc_curve(y_bin[:, i], y_prob[:, i])
            roc_auc_i = auc(fpr_i, tpr_i)
            label = (class_names[i] if class_names else f"Class {cls}")
            ax.plot(fpr_i, tpr_i, linewidth=1.5, color=colors[i],
                    label=f"{label} (AUC={roc_auc_i:.3f})")

        # Micro-average
        fpr_micro, tpr_micro, _ = roc_curve(y_bin.ravel(), y_prob.ravel())
        auc_micro = auc(fpr_micro, tpr_micro)
        ax.plot(fpr_micro, tpr_micro, linewidth=2.5, linestyle="--",
                color="black", label=f"Micro-avg (AUC={auc_micro:.3f})")

    ax.plot([0, 1], [0, 1], "k--", linewidth=1, label="Random")
    ax.set_xlim([0.0, 1.0])
    ax.set_ylim([0.0, 1.02])
    ax.set_xlabel("False Positive Rate (1 – Specificity)")
    ax.set_ylabel("True Positive Rate (Sensitivity)")
    ax.set_title(title, fontweight="bold")
    ax.legend(loc="lower right", fontsize=10)
    ax.grid(alpha=0.3)

    plt.tight_layout()
    os.makedirs(Path(save_path).parent, exist_ok=True)
    plt.savefig(save_path, bbox_inches="tight")
    plt.close(fig)
    print(f"[viz] ROC curve saved → {save_path}")


# ──────────────────────────────────────────────────────────────────────────────
# Class distribution bar chart
# ──────────────────────────────────────────────────────────────────────────────

def plot_class_distribution(
    class_counts: Dict[str, int],
    save_path: str,
    title: str = "Class Distribution",
) -> None:
    """Bar chart showing the number of samples per class."""
    labels = list(class_counts.keys())
    values = list(class_counts.values())
    colors = sns.color_palette("pastel", len(labels))

    fig, ax = plt.subplots(figsize=(max(6, len(labels) * 1.5), 5))
    bars = ax.bar(labels, values, color=colors, edgecolor="black", linewidth=0.7)
    ax.bar_label(bars, fmt="%d", padding=4)
    ax.set_title(title, fontweight="bold")
    ax.set_xlabel("Class")
    ax.set_ylabel("Sample Count")
    ax.grid(axis="y", alpha=0.3)
    plt.tight_layout()

    os.makedirs(Path(save_path).parent, exist_ok=True)
    plt.savefig(save_path, bbox_inches="tight")
    plt.close(fig)
    print(f"[viz] Class distribution saved → {save_path}")


# ──────────────────────────────────────────────────────────────────────────────
# Feature importance (diabetes / tabular models)
# ──────────────────────────────────────────────────────────────────────────────

def plot_feature_importance(
    feature_names: List[str],
    importances: np.ndarray,
    save_path: str,
    title: str = "Feature Importance",
    top_n: int = 20,
) -> None:
    """Horizontal bar chart of the top-N most important features."""
    idx = np.argsort(importances)[-top_n:]
    fig, ax = plt.subplots(figsize=(9, max(5, top_n * 0.4)))
    colors = sns.color_palette("Blues_r", len(idx))
    ax.barh(
        [feature_names[i] for i in idx],
        importances[idx],
        color=colors,
        edgecolor="black",
        linewidth=0.5,
    )
    ax.set_title(title, fontweight="bold")
    ax.set_xlabel("Importance Score")
    ax.grid(axis="x", alpha=0.3)
    plt.tight_layout()

    os.makedirs(Path(save_path).parent, exist_ok=True)
    plt.savefig(save_path, bbox_inches="tight")
    plt.close(fig)
    print(f"[viz] Feature importance saved → {save_path}")


# ──────────────────────────────────────────────────────────────────────────────
# History JSON helper
# ──────────────────────────────────────────────────────────────────────────────

def save_history(history: Dict[str, Any], path: str) -> None:
    """Serialise a training history dict to JSON."""
    os.makedirs(Path(path).parent, exist_ok=True)
    with open(path, "w") as fh:
        json.dump(history, fh, indent=2)
    print(f"[viz] Training history JSON saved → {path}")


def load_history(path: str) -> Dict[str, Any]:
    """Load a training history dict from JSON."""
    with open(path) as fh:
        return json.load(fh)
