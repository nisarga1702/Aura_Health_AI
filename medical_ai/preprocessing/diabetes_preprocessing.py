"""
diabetes_preprocessing.py
──────────────────────────
Full preprocessing pipeline for the tabular diabetes CSV dataset.

Data-leakage prevention
────────────────────────
ALL preprocessing objects (imputer, scaler, encoder, SMOTE) are fitted
ONLY on training data and then applied to validation and test sets.
No test-set statistics ever influence the transformation.

Class imbalance
────────────────
SMOTE (Synthetic Minority Over-sampling Technique) is used on the
training split only.  This generates synthetic tabular samples in
feature space – safe for tabular data unlike image oversampling.
If imbalanced-learn is not available, class_weight='balanced' is used
as a fallback inside the model.
"""

from __future__ import annotations

import sys
import warnings
from pathlib import Path
from typing import Tuple, Dict, List, Optional, Any

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.config import (
    DIABETES_CSV_PATH,
    DIABETES_TARGET_COLUMN,
    DIABETES_DROP_COLUMNS,
    DIABETES_ZERO_AS_NAN_COLUMNS,
    RANDOM_SEED,
    VALIDATION_SPLIT,
    TEST_SPLIT,
)

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.impute import SimpleImputer
import joblib


# ──────────────────────────────────────────────────────────────────────────────
# Loading
# ──────────────────────────────────────────────────────────────────────────────

def load_csv(csv_path: str = DIABETES_CSV_PATH) -> pd.DataFrame:
    """Load and minimally validate the diabetes CSV."""
    p = Path(csv_path)
    if not p.exists():
        raise FileNotFoundError(
            f"Diabetes CSV not found: {csv_path}\n"
            "Please set DIABETES_CSV_PATH in utils/config.py."
        )
    if p.suffix.lower() != ".csv":
        raise ValueError(f"Expected a .csv file, got: {csv_path}")

    df = pd.read_csv(csv_path)
    print(f"[diabetes_prep] Loaded {len(df)} rows × {len(df.columns)} columns "
          f"from {csv_path}")
    return df


# ──────────────────────────────────────────────────────────────────────────────
# Inspection & cleaning
# ──────────────────────────────────────────────────────────────────────────────

def inspect_dataframe(df: pd.DataFrame, target_col: str) -> None:
    """Print a concise data quality summary."""
    print(f"\n  Columns : {list(df.columns)}")
    print(f"  Shape   : {df.shape}")
    print(f"  Dtypes  :\n{df.dtypes.to_string()}")
    print(f"\n  Missing values per column:\n{df.isnull().sum().to_string()}")
    print(f"\n  Target column  : '{target_col}'")
    print(f"  Target distribution:\n{df[target_col].value_counts().to_string()}")


def validate_target_column(df: pd.DataFrame, target_col: str) -> None:
    if target_col not in df.columns:
        raise ValueError(
            f"Target column '{target_col}' not found in the CSV.\n"
            f"Available columns: {list(df.columns)}\n"
            "Set DIABETES_TARGET_COLUMN in utils/config.py."
        )


def clean_dataframe(
    df: pd.DataFrame,
    target_col: str,
    drop_cols: List[str] = DIABETES_DROP_COLUMNS,
    zero_as_nan_cols: List[str] = DIABETES_ZERO_AS_NAN_COLUMNS,
) -> pd.DataFrame:
    """
    Apply cleaning steps:
    1. Drop user-specified columns (e.g. patient IDs).
    2. Remove duplicate rows.
    3. Replace physiologically impossible zeros with NaN.
    4. Drop rows where the target label is missing.
    """
    # Drop specified columns
    existing_drop = [c for c in drop_cols if c in df.columns]
    if existing_drop:
        df = df.drop(columns=existing_drop)
        print(f"[diabetes_prep] Dropped columns: {existing_drop}")

    # Remove duplicates
    n_before = len(df)
    df = df.drop_duplicates().reset_index(drop=True)
    if len(df) < n_before:
        print(f"[diabetes_prep] Removed {n_before - len(df)} duplicate rows.")

    # Zero → NaN for physiologically impossible values
    for col in zero_as_nan_cols:
        if col in df.columns:
            n_zeros = (df[col] == 0).sum()
            if n_zeros > 0:
                df[col] = df[col].replace(0, np.nan)
                print(f"[diabetes_prep] Replaced {n_zeros} zeros with NaN in '{col}'.")

    # Drop rows with missing target
    n_before = len(df)
    df = df.dropna(subset=[target_col]).reset_index(drop=True)
    if len(df) < n_before:
        print(f"[diabetes_prep] Dropped {n_before - len(df)} rows with missing target.")

    return df


# ──────────────────────────────────────────────────────────────────────────────
# Feature / target split
# ──────────────────────────────────────────────────────────────────────────────

def split_features_target(
    df: pd.DataFrame, target_col: str
) -> Tuple[pd.DataFrame, pd.Series]:
    X = df.drop(columns=[target_col])
    y = df[target_col]
    return X, y


def encode_target(y: pd.Series) -> Tuple[np.ndarray, Optional[LabelEncoder]]:
    """
    If the target is already integer, return as-is.
    If it is string/categorical, apply LabelEncoder.
    Returns (encoded_array, encoder_or_None).
    """
    if pd.api.types.is_numeric_dtype(y):
        return y.to_numpy().astype(int), None
    encoder = LabelEncoder()
    encoded = encoder.fit_transform(y)
    print(f"[diabetes_prep] Label encoding: {dict(zip(encoder.classes_, encoder.transform(encoder.classes_)))}")
    return encoded, encoder


# ──────────────────────────────────────────────────────────────────────────────
# Train / val / test split
# ──────────────────────────────────────────────────────────────────────────────

def split_data(
    X: pd.DataFrame,
    y: np.ndarray,
    val_split: float = VALIDATION_SPLIT,
    test_split: float = TEST_SPLIT,
    seed: int = RANDOM_SEED,
) -> Tuple:
    """
    Stratified train / val / test split.
    Returns (X_train, X_val, X_test, y_train, y_val, y_test).
    """
    # First carve out the test set
    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y,
        test_size=test_split,
        stratify=y,
        random_state=seed,
    )
    # Then split the remainder into train and val
    val_fraction_of_temp = val_split / (1.0 - test_split)
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp,
        test_size=val_fraction_of_temp,
        stratify=y_temp,
        random_state=seed,
    )
    print(f"\n  Split sizes: train={len(X_train)}, val={len(X_val)}, test={len(X_test)}")
    return X_train, X_val, X_test, y_train, y_val, y_test


# ──────────────────────────────────────────────────────────────────────────────
# Preprocessing pipeline  (fit on train ONLY)
# ──────────────────────────────────────────────────────────────────────────────

def identify_column_types(X: pd.DataFrame) -> Tuple[List[str], List[str]]:
    """Return (numerical_cols, categorical_cols)."""
    num_cols  = X.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols  = X.select_dtypes(exclude=[np.number]).columns.tolist()
    return num_cols, cat_cols


def build_and_fit_preprocessor(
    X_train: pd.DataFrame,
) -> Tuple[Any, List[str], List[str], np.ndarray]:
    """
    Build a preprocessing pipeline fitted exclusively on X_train.

    Steps
    ─────
    1. Identify numerical vs categorical columns.
    2. Median imputation for numerical NaN.
    3. Most-frequent imputation for categorical NaN.
    4. One-hot encoding for categorical columns.
    5. Standard scaling of all numerical features.

    Returns
    ───────
    (preprocessor_dict, num_cols, cat_cols, feature_names_out)
    """
    from sklearn.preprocessing import OneHotEncoder

    num_cols, cat_cols = identify_column_types(X_train)
    print(f"[diabetes_prep] Numerical columns  : {num_cols}")
    print(f"[diabetes_prep] Categorical columns: {cat_cols}")

    # Numerical imputer + scaler
    num_imputer = SimpleImputer(strategy="median")
    num_scaler  = StandardScaler()

    X_num = X_train[num_cols].copy() if num_cols else pd.DataFrame()
    if num_cols:
        X_num_imp = num_imputer.fit_transform(X_num)
        num_scaler.fit(X_num_imp)

    # Categorical imputer + encoder
    cat_encoder = None
    X_cat = X_train[cat_cols].copy() if cat_cols else pd.DataFrame()
    cat_imputer = SimpleImputer(strategy="most_frequent")
    cat_feature_names: List[str] = []
    if cat_cols:
        X_cat_imp = cat_imputer.fit_transform(X_cat)
        cat_encoder = OneHotEncoder(sparse_output=False, handle_unknown="ignore")
        cat_encoder.fit(X_cat_imp)
        cat_feature_names = cat_encoder.get_feature_names_out(cat_cols).tolist()

    preprocessor = {
        "num_imputer":  num_imputer,
        "num_scaler":   num_scaler,
        "cat_imputer":  cat_imputer,
        "cat_encoder":  cat_encoder,
        "num_cols":     num_cols,
        "cat_cols":     cat_cols,
    }
    feature_names = num_cols + cat_feature_names
    return preprocessor, num_cols, cat_cols, feature_names


def apply_preprocessor(
    X: pd.DataFrame,
    preprocessor: Dict,
) -> np.ndarray:
    """Apply a fitted preprocessor dict to any split (val / test / inference)."""
    num_cols  = preprocessor["num_cols"]
    cat_cols  = preprocessor["cat_cols"]
    parts = []

    if num_cols:
        X_num = X[num_cols].copy()
        X_num_imp = preprocessor["num_imputer"].transform(X_num)
        X_num_sc  = preprocessor["num_scaler"].transform(X_num_imp)
        parts.append(X_num_sc)

    if cat_cols and preprocessor["cat_encoder"] is not None:
        X_cat = X[cat_cols].copy()
        X_cat_imp = preprocessor["cat_imputer"].transform(X_cat)
        X_cat_enc = preprocessor["cat_encoder"].transform(X_cat_imp)
        parts.append(X_cat_enc)

    if not parts:
        raise ValueError("No columns to transform – check column type detection.")

    return np.hstack(parts)


# ──────────────────────────────────────────────────────────────────────────────
# Class imbalance
# ──────────────────────────────────────────────────────────────────────────────

def print_class_distribution(y: np.ndarray, split_name: str = "Dataset") -> None:
    unique, counts = np.unique(y, return_counts=True)
    total = counts.sum()
    print(f"\n  {split_name} class distribution ({total} samples):")
    for cls, cnt in zip(unique, counts):
        print(f"    Class {cls}: {cnt:6d}  ({100.0*cnt/total:.1f} %)")


def apply_smote(
    X_train: np.ndarray,
    y_train: np.ndarray,
    seed: int = RANDOM_SEED,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Apply SMOTE to the training set to address class imbalance.
    Falls back to returning the original arrays if imbalanced-learn
    is not installed, and logs a warning.
    """
    try:
        from imblearn.over_sampling import SMOTE
        smote = SMOTE(random_state=seed, k_neighbors=5)
        X_res, y_res = smote.fit_resample(X_train, y_train)
        print(f"[diabetes_prep] SMOTE applied: {len(y_train)} → {len(y_res)} samples.")
        return X_res, y_res
    except ImportError:
        warnings.warn(
            "imbalanced-learn not installed; SMOTE skipped. "
            "Install with: pip install imbalanced-learn\n"
            "Falling back to class_weight='balanced' inside the model."
        )
        return X_train, y_train


# ──────────────────────────────────────────────────────────────────────────────
# Outlier clipping (IQR-based, fitted on training only)
# ──────────────────────────────────────────────────────────────────────────────

def fit_iqr_bounds(
    X_num: np.ndarray,
    factor: float = 3.0,
) -> Tuple[np.ndarray, np.ndarray]:
    """Compute IQR-based clip bounds from training data."""
    q1 = np.percentile(X_num, 25, axis=0)
    q3 = np.percentile(X_num, 75, axis=0)
    iqr = q3 - q1
    lower = q1 - factor * iqr
    upper = q3 + factor * iqr
    return lower, upper


def apply_iqr_clip(
    X: np.ndarray, lower: np.ndarray, upper: np.ndarray
) -> np.ndarray:
    return np.clip(X, lower, upper)


# ──────────────────────────────────────────────────────────────────────────────
# Persistence helpers
# ──────────────────────────────────────────────────────────────────────────────

def save_preprocessor(preprocessor: Dict, path: str) -> None:
    import os
    os.makedirs(Path(path).parent, exist_ok=True)
    joblib.dump(preprocessor, path)
    print(f"[diabetes_prep] Preprocessor saved → {path}")


def load_preprocessor(path: str) -> Dict:
    if not Path(path).exists():
        raise FileNotFoundError(f"Preprocessor not found: {path}")
    return joblib.load(path)


# ──────────────────────────────────────────────────────────────────────────────
# Public pipeline
# ──────────────────────────────────────────────────────────────────────────────

def load_and_prepare(
    csv_path: str = DIABETES_CSV_PATH,
    target_col: str = DIABETES_TARGET_COLUMN,
    apply_smote_flag: bool = True,
) -> Dict:
    """
    End-to-end preprocessing for the diabetes CSV.

    Returns a dict containing processed numpy arrays, the fitted
    preprocessor (for persistence), class names, and class weights.
    """
    print("\n" + "═" * 60)
    print("  Diabetes Dataset – Loading & Preprocessing")
    print("═" * 60)

    df = load_csv(csv_path)
    validate_target_column(df, target_col)
    inspect_dataframe(df, target_col)

    df = clean_dataframe(df, target_col)
    X, y_series = split_features_target(df, target_col)
    y, label_encoder = encode_target(y_series)

    class_names = (
        [str(c) for c in label_encoder.classes_]
        if label_encoder else [str(c) for c in np.unique(y)]
    )

    print_class_distribution(y, "Full Dataset")

    X_train, X_val, X_test, y_train, y_val, y_test = split_data(X, y)

    # Fit preprocessor on train ONLY
    preprocessor, num_cols, cat_cols, feature_names = build_and_fit_preprocessor(X_train)

    # Outlier bounds fitted on train
    X_train_num_raw = preprocessor["num_imputer"].transform(X_train[num_cols]) if num_cols else np.empty((len(X_train), 0))
    iqr_lower, iqr_upper = fit_iqr_bounds(X_train_num_raw)
    preprocessor["iqr_lower"] = iqr_lower
    preprocessor["iqr_upper"] = iqr_upper
    preprocessor["feature_names"] = feature_names
    preprocessor["label_encoder"] = label_encoder

    # Apply to all splits (leakage-free: only training statistics used)
    X_train_proc = apply_preprocessor(X_train, preprocessor)
    X_val_proc   = apply_preprocessor(X_val,   preprocessor)
    X_test_proc  = apply_preprocessor(X_test,  preprocessor)

    print_class_distribution(y_train, "Train")
    print_class_distribution(y_val,   "Validation")
    print_class_distribution(y_test,  "Test")

    # Class imbalance handling
    if apply_smote_flag:
        X_train_proc, y_train = apply_smote(X_train_proc, y_train)
        print_class_distribution(y_train, "Train (after SMOTE)")

    # Compute class weights as fallback / complement
    unique_cls, counts = np.unique(y_train, return_counts=True)
    n_total = len(y_train)
    n_cls   = len(unique_cls)
    class_weights = {int(c): n_total / (n_cls * cnt) for c, cnt in zip(unique_cls, counts)}

    return {
        "X_train": X_train_proc,
        "X_val":   X_val_proc,
        "X_test":  X_test_proc,
        "y_train": y_train,
        "y_val":   y_val,
        "y_test":  y_test,
        "preprocessor":  preprocessor,
        "feature_names": feature_names,
        "class_names":   class_names,
        "n_classes":     len(class_names),
        "class_weights": class_weights,
        "n_features":    X_train_proc.shape[1],
    }
