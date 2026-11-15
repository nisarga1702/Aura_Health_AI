"""
config.py
─────────
Central configuration for the multimodal medical AI framework.
All paths, hyperparameters, and model choices are defined here.
Change MODEL_NAME or any path here to reconfigure the full system.
"""

import os
from pathlib import Path

# ─── Project root ──────────────────────────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parent.parent

# ─── Random seed (used everywhere for reproducibility) ─────────────────────────
RANDOM_SEED: int = 42

# ─── Model selection ───────────────────────────────────────────────────────────
# Supported image models: "EfficientNetB0", "ResNet50", "VGG16", "MobileNetV2",
#                         "InceptionV3", "DenseNet121"
# Supported tabular models: "XGBoost", "RandomForest", "MLP", "LogisticRegression"
#
# IMAGE_MODEL_NAME applies to retinal and ECG pipelines.
# TABULAR_MODEL_NAME applies to the diabetes pipeline.

IMAGE_MODEL_NAME: str = "EfficientNetB0"
TABULAR_MODEL_NAME: str = "XGBoost"

# ─── Image hyper-parameters ────────────────────────────────────────────────────
IMAGE_SIZE: tuple = (224, 224)           # (height, width) fed to the backbone
BATCH_SIZE: int = 32
EPOCHS: int = 50
LEARNING_RATE: float = 1e-4
DROPOUT_RATE: float = 0.4
FINE_TUNE_AT: int = 100                  # Freeze all layers before this index
EARLY_STOPPING_PATIENCE: int = 10
REDUCE_LR_PATIENCE: int = 5
REDUCE_LR_FACTOR: float = 0.3
MIN_LR: float = 1e-7
VALIDATION_SPLIT: float = 0.15          # proportion of train → val
TEST_SPLIT: float = 0.15                # proportion of full dataset → test

# ─── Augmentation settings ─────────────────────────────────────────────────────
# Retinal augmentation (moderate; preserve pathology features)
RETINAL_AUG = dict(
    rotation_range=15,
    width_shift_range=0.05,
    height_shift_range=0.05,
    zoom_range=0.1,
    horizontal_flip=True,
    vertical_flip=False,
    brightness_range=[0.85, 1.15],
    fill_mode="nearest",
)

# ECG augmentation (very conservative; never distort waveform morphology)
ECG_AUG = dict(
    rotation_range=5,
    width_shift_range=0.02,
    height_shift_range=0.02,
    zoom_range=0.05,
    horizontal_flip=False,
    vertical_flip=False,
    brightness_range=[0.95, 1.05],
    fill_mode="nearest",
)

# ─── Dataset paths ─────────────────────────────────────────────────────────────
# Expected directory structure for image datasets:
#   <DATASET_PATH>/
#       class_label_1/
#           img001.jpg
#           img002.png
#           ...
#       class_label_2/
#           ...
#
# OR provide a CSV index with columns: [filepath, label]

RETINAL_DATASET_PATH: str = str(ROOT_DIR.parent / "backend" / "datasets" / "retinal_images")
ECG_DATASET_PATH: str    = str(ROOT_DIR.parent / "backend" / "datasets" / "ecg_images")
DIABETES_CSV_PATH: str   = str(ROOT_DIR.parent / "backend" / "datasets" / "diabetes_dataset" / "diabetes_binary_5050split_health_indicators_BRFSS2015.csv")
ECG_ABNORMAL_THRESHOLD: float = 0.30

# Target column name in the diabetes CSV
DIABETES_TARGET_COLUMN: str = "Diabetes_binary"   # change if your CSV uses a different name

# ─── Output directories ────────────────────────────────────────────────────────
SAVED_MODELS_DIR: str = str(ROOT_DIR / "saved_models")
RESULTS_DIR: str      = str(ROOT_DIR / "results")
LOGS_DIR: str         = str(ROOT_DIR / "logs")

# ─── Saved artefact file names ─────────────────────────────────────────────────
RETINAL_MODEL_PATH: str    = str(Path(SAVED_MODELS_DIR) / "retinal_model.keras")
ECG_MODEL_PATH: str        = str(Path(SAVED_MODELS_DIR) / "ecg_model.keras")
DIABETES_MODEL_PATH: str   = str(Path(SAVED_MODELS_DIR) / "diabetes_model.pkl")
DIABETES_PREP_PATH: str    = str(Path(SAVED_MODELS_DIR) / "diabetes_preprocessor.pkl")

# Training history JSON files
RETINAL_HISTORY_PATH: str  = str(Path(SAVED_MODELS_DIR) / "retinal_history.json")
ECG_HISTORY_PATH: str      = str(Path(SAVED_MODELS_DIR) / "ecg_history.json")
DIABETES_HISTORY_PATH: str = str(Path(SAVED_MODELS_DIR) / "diabetes_history.json")

# ─── Diabetes / tabular settings ───────────────────────────────────────────────
# Columns to drop unconditionally (e.g. patient IDs, free-text)
DIABETES_DROP_COLUMNS: list = []

# Columns where 0 is physiologically impossible (treated as missing)
DIABETES_ZERO_AS_NAN_COLUMNS: list = [
    "Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI",
]

# XGBoost hyper-parameters (used when TABULAR_MODEL_NAME == "XGBoost")
XGBOOST_PARAMS: dict = dict(
    n_estimators=500,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    eval_metric="logloss",
    random_state=RANDOM_SEED,
    n_jobs=-1,
)

# MLP hyper-parameters (used when TABULAR_MODEL_NAME == "MLP")
MLP_HIDDEN_LAYERS: list = [256, 128, 64]
MLP_DROPOUT: float = 0.3
MLP_EPOCHS: int = 200
MLP_BATCH_SIZE: int = 64
MLP_LEARNING_RATE: float = 1e-3

# ─── Metric reporting ──────────────────────────────────────────────────────────
# How to average multi-class metrics: "macro" | "weighted" | "micro"
METRICS_AVERAGE: str = "weighted"

# ─── Utility: ensure output directories exist ──────────────────────────────────
def ensure_dirs() -> None:
    """Create all output directories if they do not already exist."""
    for d in [SAVED_MODELS_DIR, RESULTS_DIR, LOGS_DIR]:
        os.makedirs(d, exist_ok=True)
