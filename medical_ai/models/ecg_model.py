"""
ecg_model.py
─────────────
Configurable transfer-learning model for ECG image classification.

The architecture is identical to the retinal model (same backbone registry,
same classification head) because ECG images are also 2-D visual inputs.

ECG-specific notes
──────────────────
• EfficientNetB0 is the default.  VGG16 and ResNet50 also perform well on
  ECG images due to their strong feature extraction for 2-D patterns.
• The backbone is initially frozen (Phase 1) and then partially unfrozen
  (Phase 2 fine-tuning), same as retinal.
• A lower learning rate and very conservative augmentation (defined in
  config.ECG_AUG) protect clinically meaningful waveform morphology.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Tuple

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, regularizers  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from utils.config import (
    IMAGE_MODEL_NAME,
    IMAGE_SIZE,
    LEARNING_RATE,
    DROPOUT_RATE,
    FINE_TUNE_AT,
)

_BACKBONE_MAP = {
    "EfficientNetB0": keras.applications.EfficientNetB0,
    "EfficientNetB3": keras.applications.EfficientNetB3,
    "ResNet50":       keras.applications.ResNet50,
    "ResNet50V2":     keras.applications.ResNet50V2,
    "MobileNetV2":    keras.applications.MobileNetV2,
    "VGG16":          keras.applications.VGG16,
    "InceptionV3":    keras.applications.InceptionV3,
    "DenseNet121":    keras.applications.DenseNet121,
}


def _get_backbone(
    model_name: str,
    input_shape: Tuple[int, int, int],
    weights: str = "imagenet",
) -> keras.Model:
    if model_name not in _BACKBONE_MAP:
        raise ValueError(
            f"Unknown image model '{model_name}'.\n"
            f"Supported: {list(_BACKBONE_MAP.keys())}"
        )
    return _BACKBONE_MAP[model_name](
        include_top=False,
        weights=weights,
        input_shape=input_shape,
    )


def build_model(
    n_classes: int,
    model_name: str = IMAGE_MODEL_NAME,
    image_size: Tuple[int, int] = IMAGE_SIZE,
    learning_rate: float = LEARNING_RATE,
    dropout_rate: float = DROPOUT_RATE,
    freeze_backbone: bool = True,
) -> keras.Model:
    """
    Build and compile the ECG classification model.

    Parameters
    ----------
    n_classes       : Number of output classes (inferred from data).
    freeze_backbone : True during Phase 1; False for fine-tuning.
    """
    input_shape = (*image_size, 3)
    backbone = _get_backbone(model_name, input_shape)
    backbone.trainable = not freeze_backbone

    if not freeze_backbone:
        for layer in backbone.layers[:FINE_TUNE_AT]:
            layer.trainable = False

    inputs = keras.Input(shape=input_shape, name="ecg_input")
    x = backbone(inputs, training=not freeze_backbone)
    x = layers.GlobalAveragePooling2D(name="gap")(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dense(512, activation="relu",
                     kernel_regularizer=regularizers.l2(1e-4),
                     name="dense_512")(x)
    x = layers.Dropout(dropout_rate)(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dense(256, activation="relu",
                     kernel_regularizer=regularizers.l2(1e-4),
                     name="dense_256")(x)
    x = layers.Dropout(dropout_rate)(x)

    activation = "softmax"
    outputs = layers.Dense(n_classes, activation=activation, name="output")(x)

    model = keras.Model(inputs, outputs, name=f"ecg_{model_name}")

    loss = "categorical_crossentropy"
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss=loss,
        metrics=["accuracy",
                 keras.metrics.AUC(name="auc"),
                 keras.metrics.Precision(name="precision"),
                 keras.metrics.Recall(name="recall")],
    )

    print(f"\n[ecg_model] {model_name} built | "
          f"classes={n_classes} | frozen_backbone={freeze_backbone}")
    model.summary(line_length=100, print_fn=lambda s: print("  " + s))
    return model


def unfreeze_for_finetuning(
    model: keras.Model,
    learning_rate: float = LEARNING_RATE * 0.1,
    n_classes: int = 2,
) -> keras.Model:
    """Enable Phase 2 fine-tuning."""
    for layer in model.layers:
        if hasattr(layer, "layers"):
            for i, sub_layer in enumerate(layer.layers):
                sub_layer.trainable = (i >= FINE_TUNE_AT)
        else:
            layer.trainable = True

    loss = "categorical_crossentropy"
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss=loss,
        metrics=["accuracy",
                 keras.metrics.AUC(name="auc"),
                 keras.metrics.Precision(name="precision"),
                 keras.metrics.Recall(name="recall")],
    )
    print(f"[ecg_model] Fine-tuning enabled | lr={learning_rate:.2e}")
    return model
