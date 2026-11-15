# Advanced ECG Scanning & Analysis Implementation

## Overview

This project now includes a state-of-the-art ECG scanning and analysis system based on best practices from advanced ECG processing methodologies. The implementation provides comprehensive 12-lead ECG analysis with advanced signal processing, heart rate variability metrics, and myocardial infarction (MI) detection.

## Architecture

### Core Components

#### 1. **ECG Processing Module** (`ecg_processing.py`)
The heart of the system providing advanced signal processing capabilities:

- **Image Preprocessing**
  - Grayscale conversion and histogram equalization
  - Morphological operations to remove grid lines
  - Gaussian blur and automatic binary thresholding

- **Signal Extraction**
  - Converts binary ECG images to digital signals
  - Interpolates missing values
  - Applies Savitzky-Golay filtering for smoothing

- **R-Peak Detection**
  - Detects heartbeat positions in the signal
  - Calculates RR intervals and heart rate (BPM)
  - Uses scipy signal processing for accurate peak detection

- **Heart Rate Variability (HRV) Metrics**
  - **SDNN**: Standard deviation of RR intervals (time-domain measure of HRV)
  - **RMSSD**: Root mean square of successive RR differences (parasympathetic tone indicator)
  - **PNN50**: Percentage of successive RR intervals differing by >50ms (arrhythmia detection)

- **QRS Complex Analysis**
  - Estimates QRS duration (normal: 80-120 ms)
  - Identifies conduction abnormalities
  - Measured at 50% peak amplitude

- **Signal Quality Assessment**
  - Evaluates noise levels (Low/Moderate/High)
  - Compares original signal with smoothed signal
  - Provides reliability indication for results

- **Arrhythmia Detection**
  - Detects irregular rhythms (high RR variability)
  - Identifies tachycardia (HR > 100 bpm)
  - Identifies bradycardia (HR < 60 bpm)

- **ST Segment Analysis**
  - Measures baseline deviation at ST point (60ms after R-peak)
  - Detects ST elevation/depression patterns
  - Critical for MI detection

- **12-Lead ECG Processing**
  - Automatically crops standard 3x4 grid layout
  - Processes all 12 leads: I, II, III, aVR, aVL, aVF, V1-V6
  - Generates metrics for each lead

- **MI/Ischemia Analysis**
  - Rule-based detection of ST segment patterns
  - Regional analysis (Anterior, Lateral, Inferior, Septal)
  - Severity scoring (None, Low, Moderate, High)
  - STEMI pattern recognition

#### 2. **ECG Prediction Script** (`predict_ecg_image.py`)
Main analysis engine that:
- Decodes base64 image data
- Performs comprehensive ECG analysis
- Calculates cardiovascular risk scores
- Generates detailed reports with visualizations

#### 3. **Server Integration** (`server.js`)
Three new REST API endpoints:

**POST /api/analyzeEcgImage**
- Input: Base64 encoded ECG image
- Returns: Full ECG analysis with metrics for all leads and risk assessment

**POST /api/uploadEcgImage**
- Input: File upload + patient data (JSON)
- Returns: Analysis results saved with filename

**POST /api/ecgRiskSummary**
- Input: Base64 encoded ECG image
- Returns: Quick risk summary and MI suspicion status

## Key Features

### Advanced Signal Processing
- Automatic grid removal from ECG paper
- Noise-robust peak detection
- Baseline wandering correction
- Multi-scale signal analysis

### Comprehensive Metrics
```
Per Lead:
- Heart Rate (BPM)
- HRV Metrics (SDNN, RMSSD, PNN50)
- QRS Width (milliseconds)
- ST Segment Shift
- Signal Quality Assessment
- Detected Abnormalities

Overall Analysis:
- Regional ST Changes
- MI Severity Assessment
- Cardiovascular Risk Score (0-100)
- Clinical Recommendations
```

### Risk Stratification
- **High Risk (≥70)**: Urgent medical evaluation required
- **Moderate Risk (50-69)**: Medical consultation recommended
- **Low-Moderate Risk (30-49)**: Follow-up consultation advised
- **Low Risk (<30)**: Routine monitoring recommended

## Medical Significance

### ST Segment Patterns
- **ST Elevation**: Suggests acute myocardial infarction
- **ST Depression**: Suggests ischemia or reciprocal changes
- **Normal**: Baseline within expected range

### Regional MI Patterns
- **Anterior**: V1, V2, V3, V4 - Left anterior descending artery (LAD)
- **Lateral**: I, aVL, V5, V6 - Left circumflex artery (LCx)
- **Inferior**: II, III, aVF - Right coronary artery (RCA)
- **Septal**: V1, V2 - Septal perforators

### HRV Clinical Significance
- **SDNN >100 ms**: Good cardiovascular autonomic function
- **SDNN <50 ms**: Severely reduced HRV, higher mortality risk
- **RMSSD >20 ms**: Indicates vagal tone and parasympathetic activity
- **PNN50 >10%**: Reflects parasympathetic dominance

## Installation & Setup

### 1. Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Verify Environment
Ensure Python executable is accessible via:
- `PYTHON` environment variable, or
- `PYTHON_BIN` environment variable, or
- Default `python` command

### 3. Start Server
```bash
npm start
# or for development
npm run dev
```

## API Usage Examples

### Example 1: Analyze ECG Image
```bash
curl -X POST http://localhost:5000/api/analyzeEcgImage \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "patientData": {
      "name": "John Doe",
      "age": 55,
      "gender": "Male"
    }
  }'
```

### Example 2: Upload and Analyze
```bash
curl -X POST http://localhost:5000/api/uploadEcgImage \
  -F "ecgFile=@ecg_image.jpg" \
  -F "patientData={\"age\":55,\"gender\":\"Male\"}"
```

### Example 3: Quick Risk Summary
```bash
curl -X POST http://localhost:5000/api/ecgRiskSummary \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,..."
  }'
```

## Response Format

### Full Analysis Response
```json
{
  "success": true,
  "analysis": {
    "ecg_type": "12-lead",
    "analysis": {
      "I": {
        "valid": true,
        "heart_rate_bpm": 72.5,
        "hrv_metrics": {
          "sdnn_ms": 45.23,
          "rmssd_ms": 28.45,
          "pnn50_percent": 8.5
        },
        "qrs_width_ms": 95.5,
        "signal_quality": "Low",
        "detected_issues": []
      },
      ...
      "mi_analysis": {
        "mi_suspected": false,
        "severity": "None",
        "regions_elevated": [],
        "regions_depressed": [],
        "comment": "No significant ST segment changes detected"
      }
    },
    "summary": {
      "valid_leads": 12,
      "average_heart_rate": 72.5,
      "mi_suspected": false,
      "mi_severity": "None",
      "affected_regions": {
        "elevated": [],
        "depressed": []
      }
    },
    "risk_assessment": {
      "risk_score": 15.3,
      "risk_category": "Low",
      "risk_factors": [],
      "recommendation": "Routine monitoring recommended"
    }
  }
}
```

## Performance Notes

- Processing time: 2-5 seconds per ECG image
- Optimal image resolution: 1024x768 or higher
- Supported formats: JPEG, PNG, BMP
- Memory usage: ~100-200 MB per analysis

## Limitations & Considerations

1. **Algorithm Limitations**
   - Rule-based MI detection is heuristic (not replacing clinical judgment)
   - Requires standard 3x4 12-lead layout
   - Quality dependent on image clarity

2. **Clinical Validation**
   - Results should be reviewed by qualified cardiologists
   - Not intended as standalone diagnostic tool
   - Complements, not replaces, clinical assessment

3. **Image Requirements**
   - Clear, noise-free ECG paper images
   - Adequate contrast between signal and background
   - Standard ECG paper formatting

## Troubleshooting

### Common Issues

**Python not found**
- Set `PYTHON_BIN` environment variable to Python executable path
- Example: `PYTHON_BIN=/usr/bin/python3.10 npm start`

**Out of memory**
- Reduce concurrent requests
- Process large batches sequentially

**Image processing fails**
- Verify image is clear ECG paper
- Check image format (JPEG/PNG preferred)
- Ensure adequate image resolution

**Unexpected results**
- Verify ECG image quality and contrast
- Check for grid line artifacts
- Ensure standard 12-lead layout

## Future Enhancements

- Deep learning models for improved MI detection
- Automatic calibration detection
- Multiple ECG rhythm type detection
- Waveform interpretation assistance
- Integration with electronic health records

## References

The implementation is based on:
- Signal processing techniques from advanced ECG analysis
- ST segment analysis methodology
- Heart rate variability analysis standards
- 12-lead ECG interpretation guidelines

## Support

For issues or questions:
1. Check error messages in server logs
2. Verify all dependencies are installed
3. Ensure Python environment is correctly configured
4. Validate input image format and quality
