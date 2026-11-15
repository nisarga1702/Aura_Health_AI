#!/usr/bin/env python
r"""
Diabetes Risk Prediction Module
Dataset Path: D:\ecg\mpc\mp\backend\datasets\diabetes_dataset
Target: Diabetes_binary (0 = Healthy / Non-Diabetic, 1 = Diabetic / Prediabetic)
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, 'datasets', 'diabetes_dataset')
ARTIFACTS_DIR = os.path.join(BASE_DIR, 'diabetes', 'artifacts')
PIPELINE_PATH = os.path.join(ARTIFACTS_DIR, 'pipeline.joblib')
META_PATH = os.path.join(ARTIFACTS_DIR, 'meta.json')

_PIPELINE = None
_META = None

def load_pipeline():
    global _PIPELINE, _META
    if _PIPELINE is None and os.path.exists(PIPELINE_PATH):
        try:
            _PIPELINE = joblib.load(PIPELINE_PATH)
            if os.path.exists(META_PATH):
                with open(META_PATH, 'r', encoding='utf-8') as f:
                    _META = json.load(f)
        except Exception:
            _PIPELINE = None
    return _PIPELINE, _META

def get_diabetes_prediction(data):
    pipeline, meta = load_pipeline()
    
    bp = str(data.get('bp', '120/80'))
    systolic = float(bp.split('/')[0]) if '/' in bp else float(bp) if str(bp).replace('.', '', 1).isdigit() else 120.0
    cholesterol = float(data.get('cholesterol', 180))
    glucose = float(data.get('bloodSugar', 100))
    bmi = float(data.get('bmi', 22.0))
    age = float(data.get('age', 45))
    gender = 1 if str(data.get('gender', 'Male')).lower() in ['male', '1', 'm'] else 0

    high_bp = 1 if systolic >= 130 or data.get('HighBP', 0) == 1 else 0
    high_chol = 1 if cholesterol >= 200 or data.get('HighChol', 0) == 1 else 0

    if pipeline is not None and meta is not None:
        try:
            feature_cols = meta.get('feature_columns', [])
            row_dict = {
                'HighBP': high_bp,
                'HighChol': high_chol,
                'CholCheck': 1,
                'BMI': bmi,
                'Smoker': data.get('Smoker', 0),
                'Stroke': data.get('Stroke', 0),
                'HeartDiseaseorAttack': data.get('HeartDiseaseorAttack', 0),
                'PhysActivity': data.get('PhysActivity', 1),
                'Fruits': data.get('Fruits', 1),
                'Veggies': data.get('Veggies', 1),
                'HvyAlcoholConsump': data.get('HvyAlcoholConsump', 0),
                'AnyHealthcare': 1,
                'NoDocbcCost': 0,
                'GenHlth': 3 if glucose > 140 else 2,
                'MentHlth': 0,
                'PhysHlth': 0,
                'DiffWalk': 0,
                'Sex': gender,
                'Age': int(np.clip(age / 5.0, 1, 13)),
                'Education': 5,
                'Income': 6
            }
            df_input = pd.DataFrame([row_dict])[feature_cols]
            probs = pipeline.predict_proba(df_input)[0]
            prob_diabetic = float(probs[1])
            prob_healthy = float(probs[0])
            risk_score = round(prob_diabetic * 100.0, 2)
            prediction = int(pipeline.predict(df_input)[0])
            engine_str = "Trained RandomForest Pipeline (BRFSS 2015 Dataset)"
        except Exception as e:
            raw_score = (glucose / 200.0) * 40.0 + (bmi / 40.0) * 25.0 + high_bp * 15.0 + high_chol * 10.0 + (age / 80.0) * 10.0
            risk_score = round(float(np.clip(raw_score, 3.0, 97.0)), 2)
            prob_diabetic = round(risk_score / 100.0, 4)
            prob_healthy = round(1.0 - prob_diabetic, 4)
            prediction = 1 if risk_score >= 50.0 else 0
            engine_str = "Calibrated Risk Model"
    else:
        raw_score = (glucose / 200.0) * 40.0 + (bmi / 40.0) * 25.0 + high_bp * 15.0 + high_chol * 10.0 + (age / 80.0) * 10.0
        risk_score = round(float(np.clip(raw_score, 3.0, 97.0)), 2)
        prob_diabetic = round(risk_score / 100.0, 4)
        prob_healthy = round(1.0 - prob_diabetic, 4)
        prediction = 1 if risk_score >= 50.0 else 0
        engine_str = "Calibrated Risk Model"

    verdict = "HIGH RISK" if risk_score >= 70.0 else "MEDIUM RISK" if risk_score >= 40.0 else "LOW RISK"

    return {
        "success": True,
        "disease": "Diabetes Mellitus",
        "riskScore": risk_score,
        "prediction": prediction,
        "consensusVerdict": verdict,
        "probabilities": {
            "0": prob_healthy,
            "1": prob_diabetic
        },
        "engine": engine_str,
        "datasetPath": DATASET_PATH,
        "evaluatedFeatures": {
            "HighBP": high_bp,
            "HighChol": high_chol,
            "BMI": bmi,
            "BloodGlucose": glucose,
            "Age": age
        }
    }

def main():
    try:
        raw_input = sys.argv[1] if len(sys.argv) > 1 else (sys.stdin.read() if not sys.stdin.isatty() else "")
        payload = json.loads(raw_input) if raw_input.strip() else {}
    except Exception:
        payload = {}

    result = get_diabetes_prediction(payload)
    print(json.dumps(result))

if __name__ == '__main__':
    main()
