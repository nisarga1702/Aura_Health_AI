#!/usr/bin/env python
r"""
Train Diabetes Model Pipeline on Local Desktop Dataset
Dataset: D:\ecg\mpc\mp\backend\datasets\diabetes_dataset\diabetes_binary_5050split_health_indicators_BRFSS2015.csv
"""

import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_FILE = os.path.join(BASE_DIR, 'datasets', 'diabetes_dataset', 'diabetes_binary_5050split_health_indicators_BRFSS2015.csv')
ARTIFACTS_DIR = os.path.join(BASE_DIR, 'diabetes', 'artifacts')

os.makedirs(ARTIFACTS_DIR, exist_ok=True)

def train():
    print(f"Loading dataset from: {DATASET_FILE}")
    df = pd.read_csv(DATASET_FILE)
    print(f"Dataset Loaded. Shape: {df.shape}")

    target_col = 'Diabetes_binary'
    X = df.drop(columns=[target_col])
    y = df[target_col]

    feature_columns = list(X.columns)
    print(f"Features ({len(feature_columns)}): {feature_columns}")

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    print("Training RandomForest Pipeline...")
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('classifier', RandomForestClassifier(n_estimators=100, max_depth=15, random_state=42, n_jobs=-1))
    ])

    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Model Training Complete! Accuracy: {accuracy * 100:.2f}%")

    pipeline_path = os.path.join(ARTIFACTS_DIR, 'pipeline.joblib')
    meta_path = os.path.join(ARTIFACTS_DIR, 'meta.json')

    joblib.dump(pipeline, pipeline_path)
    
    meta_data = {
        "model_name": "RandomForestClassifier",
        "accuracy": round(float(accuracy), 4),
        "feature_columns": feature_columns,
        "target_col": target_col,
        "dataset": "CDC BRFSS 2015 Balanced Split",
        "samples_trained": len(X_train)
    }

    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta_data, f, indent=2)

    print(f"Saved model pipeline to: {pipeline_path}")
    print(f"Saved metadata to: {meta_path}")

if __name__ == '__main__':
    train()
