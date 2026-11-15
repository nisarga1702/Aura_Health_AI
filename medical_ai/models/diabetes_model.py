"""
diabetes_model.py
──────────────────
Configurable model for tabular diabetes classification.

Why a separate model from the image pipelines?
──────────────────────────────────────────────
Convolutional networks (EfficientNet, ResNet, etc.) are designed for 2-D
spatial inputs.  Tabular data has no spatial structure, so applying a CNN
directly would be inappropriate.  This module uses tree-based and MLP models
that are state-of-the-art on tabular medical data.

Supported TABULAR_MODEL_NAME values
─────────────────────────────────────
  "XGBoost"           (default, recommended)
  "RandomForest"
  "LogisticRegression"
  "MLP"               (Keras-based multi-layer perceptron)

Interface
──────────
All models expose:  fit(), predict(), predict_proba(), and are wrapped in a
thin ModelWrapper class so the training script is model-agnostic.
"""

from __future__ import annotations

import sys
import warnings
from pathlib import Path
from typing import Optional, Any

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from utils.config import (
    TABULAR_MODEL_NAME,
    RANDOM_SEED,
    XGBOOST_PARAMS,
    MLP_HIDDEN_LAYERS,
    MLP_DROPOUT,
    MLP_EPOCHS,
    MLP_BATCH_SIZE,
    MLP_LEARNING_RATE,
)


# ──────────────────────────────────────────────────────────────────────────────
# sklearn / XGBoost models
# ──────────────────────────────────────────────────────────────────────────────

def _build_xgboost(n_classes: int, class_weights: Optional[dict] = None):
    try:
        from xgboost import XGBClassifier
    except ImportError:
        raise ImportError(
            "XGBoost is not installed.  Run: pip install xgboost"
        )
    params = dict(XGBOOST_PARAMS)
    if n_classes > 2:
        params["objective"] = "multi:softprob"
        params["num_class"] = n_classes
    else:
        params["objective"] = "binary:logistic"
        if class_weights:
            ratio = class_weights.get(0, 1.0) / max(class_weights.get(1, 1.0), 1e-9)
            params["scale_pos_weight"] = ratio
    return XGBClassifier(**params)


def _build_random_forest(n_classes: int, class_weights: Optional[dict] = None):
    from sklearn.ensemble import RandomForestClassifier
    return RandomForestClassifier(
        n_estimators=500,
        max_depth=None,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight=class_weights or "balanced",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )


def _build_logistic_regression(n_classes: int, class_weights: Optional[dict] = None):
    from sklearn.linear_model import LogisticRegression
    import sklearn
    kw: dict = dict(
        max_iter=2000,
        class_weight=class_weights or "balanced",
        random_state=RANDOM_SEED,
        solver="lbfgs",
    )
    # multi_class was removed in sklearn >= 1.5
    major, minor = (int(x) for x in sklearn.__version__.split(".")[:2])
    if (major, minor) < (1, 5):
        kw["multi_class"] = "auto"
    return LogisticRegression(**kw)


# ──────────────────────────────────────────────────────────────────────────────
# Keras MLP wrapper (sklearn-compatible interface)
# ──────────────────────────────────────────────────────────────────────────────

class KerasMLP:
    """Thin sklearn-compatible wrapper around a Keras MLP."""

    def __init__(
        self,
        n_features: int,
        n_classes: int,
        hidden_layers=MLP_HIDDEN_LAYERS,
        dropout: float = MLP_DROPOUT,
        learning_rate: float = MLP_LEARNING_RATE,
        epochs: int = MLP_EPOCHS,
        batch_size: int = MLP_BATCH_SIZE,
        class_weights: Optional[dict] = None,
    ):
        import tensorflow as tf
        from tensorflow import keras
        from tensorflow.keras import layers as kl  # type: ignore

        self.epochs       = epochs
        self.batch_size   = batch_size
        self.class_weights = class_weights
        self.history_: dict = {}

        inp = keras.Input(shape=(n_features,), name="tabular_input")
        x   = inp
        for units in hidden_layers:
            x = kl.Dense(units, activation="relu",
                         kernel_regularizer=keras.regularizers.l2(1e-4))(x)
            x = kl.BatchNormalization()(x)
            x = kl.Dropout(dropout)(x)

        activation = "sigmoid" if n_classes == 2 else "softmax"
        out = kl.Dense(n_classes, activation=activation, name="output")(x)

        self._model = keras.Model(inp, out, name="diabetes_mlp")
        loss = "binary_crossentropy" if n_classes == 2 else "sparse_categorical_crossentropy"
        self._model.compile(
            optimizer=keras.optimizers.Adam(learning_rate),
            loss=loss,
            metrics=["accuracy"],
        )
        self._n_classes = n_classes

    def fit(self, X, y, validation_data=None):
        import tensorflow as tf
        callbacks = [
            tf.keras.callbacks.EarlyStopping(
                patience=20, restore_best_weights=True, monitor="val_loss"
            )
        ]
        hist = self._model.fit(
            X, y,
            epochs=self.epochs,
            batch_size=self.batch_size,
            validation_data=validation_data,
            class_weight=self.class_weights,
            callbacks=callbacks,
            verbose=1,
        )
        self.history_ = hist.history
        return self

    def predict(self, X):
        prob = self._model.predict(X, verbose=0)
        if self._n_classes == 2:
            return (prob.ravel() >= 0.5).astype(int)
        return prob.argmax(axis=1)

    def predict_proba(self, X):
        prob = self._model.predict(X, verbose=0)
        if prob.ndim == 1 or prob.shape[1] == 1:
            prob = prob.ravel()
            return np.column_stack([1 - prob, prob])
        return prob


# ──────────────────────────────────────────────────────────────────────────────
# Factory
# ──────────────────────────────────────────────────────────────────────────────

def build_model(
    n_classes: int,
    n_features: int = 0,
    model_name: str = TABULAR_MODEL_NAME,
    class_weights: Optional[dict] = None,
) -> Any:
    """
    Instantiate the appropriate tabular model.

    Parameters
    ----------
    n_classes     : Number of target classes.
    n_features    : Number of input features (required for MLP).
    model_name    : One of "XGBoost", "RandomForest",
                    "LogisticRegression", "MLP".
    class_weights : Dict {class_idx: weight} for imbalance handling.

    Returns
    -------
    An sklearn-compatible estimator (fit / predict / predict_proba).
    """
    model_name_lc = model_name.lower()

    if model_name_lc == "xgboost":
        model = _build_xgboost(n_classes, class_weights)
    elif model_name_lc in ("randomforest", "random_forest", "rf"):
        model = _build_random_forest(n_classes, class_weights)
    elif model_name_lc in ("logisticregression", "logistic_regression", "lr"):
        model = _build_logistic_regression(n_classes, class_weights)
    elif model_name_lc == "mlp":
        if n_features == 0:
            raise ValueError("n_features must be provided for MLP.")
        model = KerasMLP(
            n_features=n_features,
            n_classes=n_classes,
            class_weights=class_weights,
        )
    else:
        raise ValueError(
            f"Unknown tabular model '{model_name}'.\n"
            "Supported: XGBoost, RandomForest, LogisticRegression, MLP"
        )

    print(f"[diabetes_model] Built: {model_name} | classes={n_classes}")
    return model
