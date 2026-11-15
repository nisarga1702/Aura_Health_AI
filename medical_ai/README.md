# Multimodal Medical AI Framework

A production-quality, modular machine-learning / deep-learning framework for
medical classification across three independent modalities:

| Modality | Task | Model |
|---|---|---|
| Retinal fundus images | Retinal fungal infection / disease classification | EfficientNetB0 (configurable) |
| ECG images | Chronic heart disease detection | EfficientNetB0 (configurable) |
| Diabetes CSV | Diabetes / diabetic condition prediction | XGBoost (configurable) |

---

## Architecture Analysis

### Why EfficientNetB0 for images?

EfficientNetB0 is a state-of-the-art convolutional neural network that scales
depth, width, and resolution jointly using a compound coefficient. It achieves
excellent accuracy with significantly fewer parameters than ResNet50 or VGG16,
making it practical for medical imaging where datasets are often small.

**Suitable for retinal images:** YES. Retinal fundus images are 2-D RGB images
with rich spatial features (blood vessels, lesions, disc morphology). CNNs are
the established standard.

**Suitable for ECG images:** YES. ECG printouts are 2-D visual representations.
The model treats them as images, which is appropriate when the dataset consists
of scanned/printed ECG strips rather than raw 1-D signal arrays.

**Suitable for tabular diabetes data:** NO. CNNs require spatial 2-D structure.
Tabular clinical data (Glucose, BMI, BloodPressure, etc.) has no spatial
relationship. XGBoost is used instead — a gradient-boosted tree ensemble that
is state-of-the-art on structured medical data.

### Training strategy

Two-phase transfer learning is used for both image modalities:

```
Phase 1 – Feature extraction (≈10 warm-up epochs)
  Backbone : frozen (ImageNet weights preserved)
  Head     : trained from scratch
  LR       : LEARNING_RATE  (e.g. 1e-4)

Phase 2 – Fine-tuning (remaining epochs)
  Backbone : partially unfrozen (layers from FINE_TUNE_AT onward)
  Head     : continues training
  LR       : LEARNING_RATE / 10  (smaller to avoid catastrophic forgetting)
```

---

## Project Structure

```
medical_ai/
├── config.yaml                    ← Single source of truth for all settings
│
├── data/                          ← Optional local datasets
│
├── models/
│   ├── retinal_model.py           ← EfficientNetB0 + custom head
│   ├── ecg_model.py               ← EfficientNetB0 + custom head (independent)
│   └── diabetes_model.py          ← XGBoost / RF / MLP factory
│
├── preprocessing/
│   ├── retinal_preprocessing.py   ← Discovery, validation, split, generators
│   ├── ecg_preprocessing.py       ← Same interface; ECG-safe augmentation
│   └── diabetes_preprocessing.py  ← CSV cleaning, imputation, scaling, SMOTE
│
├── training/
│   ├── train_retinal.py           ← python train_retinal.py
│   ├── train_ecg.py               ← python train_ecg.py
│   └── train_diabetes.py          ← python train_diabetes.py
│
├── testing/
│   └── test_all_models.py         ← python test_all_models.py
│
├── utils/
│   ├── config.py                  ← All configuration constants
│   ├── metrics.py                 ← Medical metrics (Sens, Spec, AUC, …)
│   └── visualization.py           ← Training curves, CM, ROC, feat. importance
│
├── saved_models/                  ← Auto-created by training scripts
│   ├── retinal_model.keras
│   ├── ecg_model.keras
│   ├── diabetes_model.pkl
│   └── diabetes_preprocessor.pkl
│
├── results/                       ← Auto-created; plots and final CSV
│
├── logs/                          ← TensorBoard logs
│
├── requirements.txt
└── README.md
```

---

## Installation

### 1. Clone / download the project

```bash
git clone <repo-url>
cd medical_ai
```

### 2. Create a virtual environment (recommended)

```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

For Apple Silicon (M1/M2), replace the TensorFlow line in `requirements.txt`:
```
tensorflow-macos>=2.13.0
tensorflow-metal>=1.1.0
```

---

## Dataset Preparation

### Retinal and ECG datasets

This workspace uses the datasets already stored in the backend project:

```
../backend/datasets/retinal_images/
  dr/
  no_dr/

../backend/datasets/ecg_images/
  abnormal/
  normal
```

Class names are inferred automatically from subdirectory names.
The active paths are configured in `utils/config.py`; no dataset copy is needed.

### Diabetes dataset

The active diabetes CSV is:

```
../backend/datasets/diabetes_dataset/diabetes_binary_5050split_health_indicators_BRFSS2015.csv
```

Its target column is `Diabetes_binary`, configured in `utils/config.py`.

---

## Configuration

All parameters are in `utils/config.py` (Python constants) and mirrored in
`config.yaml` (human-readable reference).

Key settings:

```python
# utils/config.py

IMAGE_MODEL_NAME   = "EfficientNetB0"   # swap backbone here
TABULAR_MODEL_NAME = "XGBoost"          # swap tabular model here

RETINAL_DATASET_PATH = "../backend/datasets/retinal_images"
ECG_DATASET_PATH     = "../backend/datasets/ecg_images"
DIABETES_CSV_PATH    = "../backend/datasets/diabetes_dataset/diabetes_binary_5050split_health_indicators_BRFSS2015.csv"
DIABETES_TARGET_COLUMN = "Diabetes_binary"

BATCH_SIZE    = 32
EPOCHS        = 50
LEARNING_RATE = 1e-4
IMAGE_SIZE    = (224, 224)
RANDOM_SEED   = 42
```

---

## Training

Each modality trains independently. Run from the project root:

```bash
# Train retinal model
python training/train_retinal.py

# Override defaults via CLI
python training/train_retinal.py --dataset /my/retinal/data --epochs 30 --model ResNet50
```

```bash
# Train ECG model
python training/train_ecg.py

python training/train_ecg.py --dataset /my/ecg/data --epochs 40
```

```bash
# Train diabetes model
python training/train_diabetes.py

python training/train_diabetes.py --csv /my/data.csv --target Outcome --model RandomForest
```

Each training script:
- Prints class distributions before and after balancing
- Runs two-phase training (image models) or standard fit (tabular)
- Saves the best model (by val AUC) to `saved_models/`
- Generates plots in `results/`

---

## Testing (Unified Evaluation)

After all three models are trained:

```bash
# Use defaults from config.py
python testing/test_all_models.py

# Specify paths explicitly
python testing/test_all_models.py \
    --retinal_data  data/retinal \
    --ecg_data      data/ecg \
    --diabetes_data data/diabetes/diabetes.csv
```

### Output

```
results/
├── retinal_confusion_matrix.png
├── ecg_confusion_matrix.png
├── diabetes_confusion_matrix.png
├── retinal_roc_curve.png
├── ecg_roc_curve.png
├── diabetes_roc_curve.png
└── final_results.csv
```

The final table printed to the console and saved as CSV:

| Modality | Model | Accuracy | Precision | Recall | F1 | Sensitivity | Specificity | ROC-AUC |
|---|---|---|---|---|---|---|---|---|
| Retinal | EfficientNetB0 | 0.93 | 0.92 | 0.93 | 0.92 | 0.93 | 0.97 | 0.98 |
| ECG | EfficientNetB0 | 0.91 | 0.90 | 0.91 | 0.90 | 0.91 | 0.95 | 0.97 |
| Diabetes | XGBoost | 0.82 | 0.81 | 0.82 | 0.81 | 0.78 | 0.84 | 0.87 |

*(Numbers above are illustrative; actual results depend on your dataset.)*

---

## Swapping Models

To change the backbone for retinal and ECG, edit `utils/config.py`:

```python
IMAGE_MODEL_NAME = "ResNet50"        # or VGG16, MobileNetV2, DenseNet121, ...
```

Then retrain:
```bash
python training/train_retinal.py
python training/train_ecg.py
```

To change the diabetes model:
```python
TABULAR_MODEL_NAME = "RandomForest"  # or MLP, LogisticRegression
```

```bash
python training/train_diabetes.py
```

---

## Data Leakage Prevention

| Risk | Mitigation |
|---|---|
| Train/val/test contamination | Stratified split is performed on raw file lists / DataFrame rows before any transform |
| Augmentation on test data | `ImageDataGenerator` augmentation is defined only in `train_datagen`; `infer_datagen` uses rescale only |
| Scaler/imputer fitted on test data | `build_and_fit_preprocessor()` is called only with `X_train`; `apply_preprocessor()` uses the already-fitted objects |
| SMOTE applied before splitting | SMOTE is applied to `X_train` only, after the split |
| Patient-level leakage | If your dataset contains patient IDs, add the ID column to `DIABETES_DROP_COLUMNS` in config.py |

---

## Class Imbalance Handling

| Modality | Technique | Rationale |
|---|---|---|
| Retinal images | Class weights in `model.fit(class_weight=...)` | Avoids generating synthetic fundus images which could introduce unrealistic artefacts |
| ECG images | Class weights in `model.fit(class_weight=...)` | Same reasoning; waveform morphology must not be fabricated |
| Diabetes CSV | SMOTE on training set + class weights fallback | Synthetic tabular samples are safe; SMOTE interpolates in feature space |

---

## Medical Metrics Explained

All metrics are computed in `utils/metrics.py`.

```
Sensitivity (Recall for positive class) = TP / (TP + FN)
  → "Of all actual positive cases, how many did we catch?"
  → Critical for screening (minimise false negatives)

Specificity = TN / (TN + FP)
  → "Of all actual negative cases, how many did we correctly exclude?"
  → Critical for ruling out disease (minimise false positives)

ROC-AUC    → Probability that the model ranks a positive case higher than a
             negative case; 0.5 = random, 1.0 = perfect
```

For binary classification the confusion matrix is:

```
                Predicted Positive    Predicted Negative
Actual Positive      TP                     FN
Actual Negative      FP                     TN
```

For multiclass, sensitivity and specificity are computed per class (one-vs-rest)
and averaged using the strategy set in `METRICS_AVERAGE` (default: "weighted").

---

## TensorBoard

Training logs are written to `logs/retinal/` and `logs/ecg/`.

View them with:
```bash
tensorboard --logdir logs/
```

---

## Reproducibility

The following seeds are set before any library import in every training script:

```python
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)
os.environ["PYTHONHASHSEED"] = str(RANDOM_SEED)
tf.random.set_seed(RANDOM_SEED)
```

All train/val/test splits use `random_state=RANDOM_SEED`.
XGBoost and scikit-learn models accept `random_state=RANDOM_SEED`.

---

## Error Messages

The framework raises descriptive errors for common problems:

| Situation | Error raised |
|---|---|
| Dataset path missing | `FileNotFoundError` with the expected path and config key |
| No class subdirectories | `ValueError` with expected directory structure |
| Corrupt image files | `Warning` (image skipped, training continues) |
| Target column missing from CSV | `ValueError` listing available columns |
| Model file not found at test time | `FileNotFoundError` advising which training script to run |
| Unsupported model name | `ValueError` listing all supported names |

---

## Environment

Tested with:
- Python 3.10
- TensorFlow 2.13
- scikit-learn 1.3
- XGBoost 2.0
- imbalanced-learn 0.11

GPU training recommended for the image models. CPU training works but is slow.
