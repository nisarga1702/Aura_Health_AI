# Multi-Disease ML Project (ECG, Retinal Fundus, Diabetes)

Clean rebuild replacing the old confusing multi-script setup. There are
now only **4 scripts total**, not one per model.

```
ml-project/
├── requirements.txt
├── shared/
│   ├── image_classifier_train.py    ← used for BOTH ecg and retinal_fundus
│   └── image_classifier_predict.py  ← reference inference, mirror this in your backend
├── ecg/
│   └── artifacts/                   ← created after training (model.pt, meta.json)
├── retinal_fundus/
│   └── artifacts/                   ← created after training
└── diabetes/
    ├── diabetes_train.py
    ├── diabetes_predict.py
    └── artifacts/                   ← created after training (pipeline.joblib, meta.json)
```

## 1. Install dependencies

```bash
pip install -r requirements.txt
```

## 2. Prepare your data

**ECG and retinal fundus (images):** organize each dataset into one
subfolder per class:

```
ecg_images/
    normal/
        img001.jpg
    abnormal/
        img001.jpg

retinal_images/
    no_dr/
        img001.jpg
    dr/
        img001.jpg
```

If your images aren't sorted this way yet, sort them first — the folder
name IS the label, so this step matters.

**Diabetes (CSV):** just needs a column that holds the label (e.g.
`Outcome`, `Diagnosis`). Everything else is treated as a feature
automatically — numeric columns are scaled, text/categorical columns are
one-hot encoded.

## 3. Train each model

```bash
# ECG
python shared/image_classifier_train.py \
    --data_dir /path/to/ecg_images \
    --output_dir ecg/artifacts \
    --run_name ecg

# Retinal fundus
python shared/image_classifier_train.py \
    --data_dir /path/to/retinal_images \
    --output_dir retinal_fundus/artifacts \
    --run_name retinal

# Diabetes
python diabetes/diabetes_train.py \
    --csv_path /path/to/diabetes.csv \
    --target_column Outcome \
    --output_dir diabetes/artifacts
```

Each run prints validation/test accuracy per epoch (images) or a full
classification report (diabetes) so you can actually see how it's doing
as it trains, not just a final number.

## 4. Test inference before wiring up the webpage

```bash
python shared/image_classifier_predict.py \
    --artifacts_dir ecg/artifacts \
    --image /path/to/test_image.jpg

python diabetes/diabetes_predict.py \
    --artifacts_dir diabetes/artifacts \
    --input_json '{"Pregnancies": 2, "Glucose": 130, "BloodPressure": 70, ...}'
```

## 5. Wire up your webpage backend — the important part

Your backend must call the **same `predict()` functions above**, not
reimplement preprocessing by hand. Import them directly:

```python
from shared.image_classifier_predict import predict as predict_ecg
from diabetes.diabetes_predict import predict as predict_diabetes

result = predict_ecg(uploaded_file_path, "ecg/artifacts")
```

## AURA-Health AI framework integration

The active Express API uses the trained artifacts in `../medical_ai/saved_models`:

| Endpoint | Active algorithm | Status |
|---|---|---|
| `/api/predictDiabetes` | XGBoost + saved preprocessor | Trained |
| `/api/processECG` | EfficientNetB0 + calibrated threshold | Trained |
| `/api/processRetinal` | EfficientNetB0 | Trained |
| `/api/predictHeart` | Clinical heuristic fallback | No trained framework artifact |
| `/api/predictKidney` | Clinical heuristic fallback | No trained framework artifact |

The versioned endpoints `/api/v1/model-status` and
`/api/v1/predict-multimodal` expose this distinction directly. The multimodal
route uses the trained XGBoost diabetes model and reports heart/CKD fallback
outputs as untrained. It does not pretend that PSO, SHAP, LIME, or Grad-CAM
are active until their serialized artifacts and inference code are added.

WFDB is included for PTB-XL and other PhysioNet waveform processing. UCI
dataset APIs and PSO libraries are training/data-acquisition tools, not
runtime prediction APIs; they should only be introduced when the corresponding
heart and CKD training pipelines are implemented.

This is the fix for the earlier bug: preprocessing now lives in exactly
one place per model, and both training and serving read the same
`meta.json` / bundled pipeline — so there's no way for them to silently
drift apart.

## Notes

- Default image model is ResNet18 (transfer learning, ImageNet
  pretrained) — a reasonable starting point. Swap `--model_name
  efficientnet_b0` if you want to compare.
- Diabetes uses a single RandomForest inside a bundled pipeline rather
  than many separate models — easier to trust and debug than a 7-model
  ensemble where you can't tell which one is actually driving
  predictions.
- If accuracy still looks off after retraining, check dataset size per
  class first — small class counts (a few dozen images) will produce
  unstable accuracy no matter which model you use.
