# AURA-Health AI — Offline-First Multimodal Healthcare AI System

Welcome to the **AURA-Health AI** workspace. This repository contains the complete structural files, local database configurations, and responsive UI screens for an offline-first diagnostic platform designed to predict three chronic diseases: Cardiovascular Disease (Heart Disease), Diabetes, and Chronic Kidney Disease (CKD).

---

> [!TIP]
> **Developer Setup Suggestion**
> We recommend setting this subdirectory (`C:\Users\user\.gemini\antigravity\scratch\aura-health-ai`) as your active coding workspace to easily build and test modifications.

---

## Architecture Overview

1. **Frontend (React + Vite + Dexie/IndexedDB)**:
   - **Local Cache**: Buffered storage using IndexedDB allows registering patients, capturing symptoms, uploading mock images/lab files, running simulation graphs, and editing prescriptions entirely offline.
   - **Accessibility & Translation**: Includes Hindi, Kannada, Tamil, Telugu, and English toggles, along with a Large Font toggle and an integrated Text-to-Speech (TTS) engine.
   - **Visual XAI**: Interactive SHAP feature lists, LIME local factors, and Grad-CAM ECG overlays with an opacity slider.

2. **Backend (Node.js Express + Multer)**:
   - **ML Inference Endpoints**: `/predictHeart`, `/predictDiabetes`, `/predictKidney`, `/getExplanation`, `/processECG`, `/uploadLabReport`.
   - **OCR Parser**: Accepts reports and parses structured outputs (currently simulated; ready for Tesseract/PyPDF2).

---

## Quick Start Instructions

Follow these steps to run both the frontend and backend servers on your system:

### 1. Install Dependencies

Open a terminal inside the project directory and run:

**For the Backend:**
```bash
cd backend
npm install
```

**For the Frontend:**
```bash
cd ../frontend
npm install
```

### 2. Start the Servers

**Start the Express API Backend (runs on Port 5000):**
```bash
cd backend
npm start
```

**Start the Vite React Frontend (runs on Port 3000):**
```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` in your web browser. 
- *To run on Android*: Connect your phone to the same Wi-Fi network and navigate to `http://<your-windows-ip-address>:3000`.

---

## Machine Learning Model Integration Guide

All endpoints, placeholders, and files are ready for you to train and plug in your ML weights:

### 1. Placing Models
Save your model files (e.g., `.pkl`, `.h5`, `.onnx`, or `.json`) in:
`backend/models/`

### 2. Connecting a Python ML Script (Recommended)
If you are training models in Python (scikit-learn, PyTorch, TensorFlow), you can execute the Python prediction script from the Node.js Express server using `child_process.exec`.

**Example Python Predictor (`backend/predict.py`):**
```python
import sys
import json
import joblib

# Load trained Random Forest model
model = joblib.load('models/heart_rf_model.pkl')

# Read input arguments
args = json.loads(sys.argv[1])
features = [[
    args['age'], 
    1 if args['gender'] == 'Male' else 0, 
    args['bloodSugar'], 
    args['cholesterol'], 
    args['bmi']
]]

prediction = model.predict(features)
probability = model.predict_proba(features)[0][1]

print(json.dumps({
    "riskScore": int(probability * 100),
    "success": True
}))
```

**Express Endpoint Integration (`backend/server.js`):**
Replace the mock block in `/api/predictHeart` with:
```javascript
const { exec } = require('child_process');

app.post('/api/predictHeart', (req, res) => {
  const payload = JSON.stringify(req.body);
  
  exec(`python predict.py '${payload}'`, (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    const modelOutput = JSON.parse(stdout);
    res.json({
      success: true,
      patientId: req.body.patientId,
      disease: 'Cardiovascular Disease',
      riskScore: modelOutput.riskScore,
      riskLevel: modelOutput.riskScore > 70 ? 'High' : 'Low',
      timestamp: new Date().toISOString()
    });
  });
});
```

---

## Database Schema Mappings

Local database collections are structured using Dexie.js in `frontend/src/db/localDb.js`:

1. **Patients Schema**:
   `patients: '++id, patientId, name, age, gender, createdTime, synced'`
2. **Predictions Schema**:
   `predictions: '++id, patientId, disease, riskScore, riskLevel, createdTime, synced'`
3. **Vitals Telemetry Buffer Schema**:
   `vitalsBuffer: '++id, patientId, heartRate, spo2, bpSystolic, bpDiastolic, timestamp, synced'`
