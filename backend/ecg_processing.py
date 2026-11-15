"""
Advanced ECG Processing Module
Comprehensive ECG scanning, signal extraction, and analysis
Based on best practices for 12-lead ECG analysis
"""

import cv2
import numpy as np
from scipy.signal import find_peaks, savgol_filter
import matplotlib.pyplot as plt
import io
import base64


# =============================================================================
# 1. IMAGE PREPROCESSING
# =============================================================================

def preprocess_image_bgr(image_bgr):
    """
    Preprocess ECG image:
    - Convert to grayscale
    - Histogram equalization
    - Remove grid lines with morphological operations
    - Apply gaussian blur and binary thresholding
    
    Args:
        image_bgr: Input image in BGR format
        
    Returns:
        Binary image with cleaned ECG waveform
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    # Remove grid lines using morphological operations
    kernel_h = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
    kernel_v = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
    remove_h = cv2.morphologyEx(gray, cv2.MORPH_OPEN, kernel_h)
    remove_v = cv2.morphologyEx(gray, cv2.MORPH_OPEN, kernel_v)

    grid = cv2.add(remove_h, remove_v)
    cleaned = cv2.subtract(gray, grid)

    blurred = cv2.GaussianBlur(cleaned, (5, 5), 0)
    _, th = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    return th


# =============================================================================
# 2. SIGNAL EXTRACTION FROM IMAGE
# =============================================================================

def image_to_signal(binary_image):
    """
    Convert binary ECG image to digital signal.
    Traces the waveform by finding the center line of the ECG trace.
    
    Args:
        binary_image: Binary preprocessed ECG image
        
    Returns:
        Normalized signal array (smoothed)
    """
    h, w = binary_image.shape
    signal = []

    # Extract signal by finding the median y-coordinate of black pixels in each column
    for x in range(w):
        col = binary_image[:, x]
        ys = np.where(col == 0)[0]
        if len(ys) == 0:
            signal.append(None)
        else:
            y = int(np.median(ys))
            signal.append(y)

    # Interpolate missing values
    xs = np.arange(w)
    good = np.array([s is not None for s in signal])
    signal_arr = np.array([s if s is not None else 0 for s in signal], dtype=float)

    if good.sum() >= 2:
        signal_arr[~good] = np.interp(xs[~good], xs[good], signal_arr[good])

    # Normalize signal (invert so peaks are positive)
    signal_norm = (h - signal_arr)

    # Apply Savitzky-Golay filter for smoothing
    if w > 51:
        signal_sm = savgol_filter(signal_norm, 51, 3)
    else:
        signal_sm = signal_norm

    return signal_sm


# =============================================================================
# 3. R-PEAK DETECTION AND HEART RATE CALCULATION
# =============================================================================

def detect_r_peaks(signal, px_per_second=100):
    """
    Detect R-peaks in ECG signal.
    R-peaks represent the highest points of QRS complexes (heartbeats).
    
    Args:
        signal: ECG signal array
        px_per_second: Sampling rate (pixels per second)
        
    Returns:
        peaks: Indices of detected R-peaks
        rr_sec: RR intervals in seconds
        bpm: Beats per minute (heart rate)
    """
    peaks, props = find_peaks(
        signal,
        distance=px_per_second * 0.4,
        height=np.mean(signal) + 0.2 * np.ptp(signal)
    )

    if len(peaks) < 2:
        return peaks, [], None

    rr_px = np.diff(peaks)
    rr_sec = rr_px / px_per_second
    bpm = 60 / np.mean(rr_sec)

    return peaks, rr_sec, bpm


# =============================================================================
# 4. HEART RATE VARIABILITY (HRV) METRICS
# =============================================================================

def hrv_metrics(rr_sec):
    """
    Calculate Heart Rate Variability metrics from RR intervals.
    
    Metrics:
    - SDNN: Standard deviation of RR intervals (ms)
    - RMSSD: Root mean square of successive RR differences (ms)
    - PNN50: Percentage of successive RR intervals differing by >50ms
    
    Args:
        rr_sec: RR intervals in seconds
        
    Returns:
        Dictionary with HRV metrics
    """
    if len(rr_sec) < 2:
        return {}

    # Convert to milliseconds
    rr_ms = rr_sec * 1000

    sdnn = np.std(rr_ms, ddof=1)
    rmssd = np.sqrt(np.mean(np.diff(rr_ms) ** 2))
    nn50 = np.sum(np.abs(np.diff(rr_ms)) > 50)
    pnn50 = 100 * nn50 / len(rr_ms)

    return {
        "sdnn_ms": float(sdnn),
        "rmssd_ms": float(rmssd),
        "pnn50_percent": float(pnn50)
    }


# =============================================================================
# 5. QRS COMPLEX ANALYSIS
# =============================================================================

def estimate_qrs_width(signal, peaks, fs=250):
    """
    Estimate QRS duration (width) in milliseconds.
    Measures the width at 50% of peak amplitude for each R-peak.
    
    Args:
        signal: ECG signal
        peaks: R-peak indices
        fs: Sampling frequency (Hz)
        
    Returns:
        Average QRS width in milliseconds
    """
    if peaks is None or len(peaks) == 0:
        return None

    signal = np.asarray(signal)
    widths = []

    for p in peaks:
        amp = signal[p]
        half = amp * 0.5

        # Find left edge
        left = p
        while left > 0 and signal[left] > half:
            left -= 1

        # Find right edge
        right = p
        while right < len(signal) - 1 and signal[right] > half:
            right += 1

        width_samples = right - left
        if width_samples > 0:
            width_ms = (width_samples / fs) * 1000.0
            widths.append(width_ms)

    if len(widths) == 0:
        return None

    return float(np.mean(widths))


# =============================================================================
# 6. NOISE AND SIGNAL QUALITY ASSESSMENT
# =============================================================================

def estimate_noise_level(signal):
    """
    Assess signal quality by comparing original and smoothed signal.
    
    Args:
        signal: ECG signal
        
    Returns:
        String indicating noise level: "Low", "Moderate", or "High"
    """
    signal = np.asarray(signal, dtype=float)
    if len(signal) < 10:
        return "Unknown"

    # Simple moving average smoothing
    k = 5
    kernel = np.ones(k) / k
    smooth = np.convolve(signal, kernel, mode='same')

    noise = signal - smooth
    std_noise = float(np.std(noise))

    # Heuristic thresholds
    if std_noise < 0.02:
        return "Low"
    elif std_noise < 0.05:
        return "Moderate"
    else:
        return "High"


# =============================================================================
# 7. ARRHYTHMIA DETECTION
# =============================================================================

def simple_arrhythmia_checks(rr_sec, signal):
    """
    Detect common arrhythmias and rhythm abnormalities.
    
    Detects:
    - Irregular rhythm (high RR variability)
    - Tachycardia (heart rate > 120 bpm)
    - Bradycardia (heart rate < 60 bpm)
    
    Args:
        rr_sec: RR intervals in seconds
        signal: ECG signal
        
    Returns:
        List of detected abnormalities
    """
    checks = []

    if len(rr_sec) > 0:
        # Check for irregular rhythm
        if np.std(rr_sec) > 0.12:
            checks.append("Irregular rhythm (possible arrhythmia)")
        
        # Check for tachycardia (>100 bpm)
        if np.mean(rr_sec) < 0.6:
            checks.append("Tachycardia (fast heart rate)")
        
        # Check for bradycardia (<60 bpm)
        if np.mean(rr_sec) > 1.0:
            checks.append("Bradycardia (slow heart rate)")

    return checks


# =============================================================================
# 8. ST SEGMENT ANALYSIS
# =============================================================================

def estimate_st_shift(signal, peaks, fs=250):
    """
    Estimate ST segment deviation.
    Measures baseline deviation at ST point (60ms after R-peak).
    
    Args:
        signal: ECG signal
        peaks: R-peak indices
        fs: Sampling frequency (Hz)
        
    Returns:
        Average ST shift (relative units)
    """
    signal = np.asarray(signal, dtype=float)
    if peaks is None or len(peaks) == 0 or len(signal) < 10:
        return None

    pre_ms = 80   # baseline window 80ms before R
    st_ms = 60    # ST point 60ms after R
    pre_samp = int((pre_ms / 1000.0) * fs)
    st_samp = int((st_ms / 1000.0) * fs)

    st_values = []
    for p in peaks:
        left = p - pre_samp
        st_idx = p + st_samp
        if left < 0 or st_idx >= len(signal):
            continue

        baseline_win = signal[max(0, left - 5):left + 1]
        if len(baseline_win) == 0:
            continue

        baseline = np.median(baseline_win)
        st_val = signal[st_idx] - baseline
        st_values.append(st_val)

    if len(st_values) == 0:
        return None

    return float(np.mean(st_values))


# =============================================================================
# 9. VISUALIZATION
# =============================================================================

def plot_signal(signal, peaks=None):
    """
    Generate a plot of the ECG signal with detected peaks.
    
    Args:
        signal: ECG signal
        peaks: R-peak indices
        
    Returns:
        Base64 encoded PNG image
    """
    plt.figure(figsize=(12, 4))
    plt.plot(signal, linewidth=1.5)

    if peaks is not None and len(peaks) > 0:
        plt.plot(peaks, signal[peaks], "ro", markersize=8)

    plt.xlabel("Time (pixels)")
    plt.ylabel("Amplitude")
    plt.title("ECG Signal with Detected R-peaks")
    plt.grid(True, alpha=0.3)
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=100)
    plt.close()
    buf.seek(0)

    return base64.b64encode(buf.read()).decode("ascii")


# =============================================================================
# 10. 12-LEAD ECG PROCESSING
# =============================================================================

def crop_12_leads_grid(image_bgr):
    """
    Split a standard 12-lead ECG image into 12 individual leads.
    
    Assumes standard 3x4 grid layout:
      Row 0: I   | aVR | V1 | V4
      Row 1: II  | aVL | V2 | V5
      Row 2: III | aVF | V3 | V6
    
    Args:
        image_bgr: Full 12-lead ECG image
        
    Returns:
        Dictionary with lead name -> lead image
    """
    h, w = image_bgr.shape[:2]

    row_height = h // 4
    col_width = w // 4

    def crop_cell(r, c):
        y1 = r * row_height
        y2 = (r + 1) * row_height
        x1 = c * col_width
        x2 = (c + 1) * col_width
        return image_bgr[y1:y2, x1:x2]

    leads = {
        "I":   crop_cell(0, 0),
        "aVR": crop_cell(0, 1),
        "V1":  crop_cell(0, 2),
        "V4":  crop_cell(0, 3),

        "II":  crop_cell(1, 0),
        "aVL": crop_cell(1, 1),
        "V2":  crop_cell(1, 2),
        "V5":  crop_cell(1, 3),

        "III": crop_cell(2, 0),
        "aVF": crop_cell(2, 1),
        "V3":  crop_cell(2, 2),
        "V6":  crop_cell(2, 3),
    }

    return leads


def process_single_lead(image_bgr_lead):
    """
    Process a single ECG lead image and extract metrics.
    
    Args:
        image_bgr_lead: Single lead image
        
    Returns:
        Dictionary with lead metrics
    """
    try:
        binary = preprocess_image_bgr(image_bgr_lead)
        signal = image_to_signal(binary)

        if signal is None or len(signal) < 10:
            return {
                "valid": False,
                "bpm": None,
                "hrv": {},
                "qrs_ms": None,
                "noise_level": "Unknown",
                "st_shift": None,
                "checks": ["Lead signal not usable"],
                "signal_plot": None
            }

        peaks, rr_sec, bpm = detect_r_peaks(signal)
        hrv = hrv_metrics(rr_sec)
        checks = simple_arrhythmia_checks(rr_sec, signal)

        qrs_ms = estimate_qrs_width(signal, peaks)
        noise_level = estimate_noise_level(signal)
        st_shift = estimate_st_shift(signal, peaks)
        signal_plot = plot_signal(signal, peaks)

        return {
            "valid": True,
            "bpm": float(bpm) if bpm is not None else None,
            "hrv": hrv,
            "qrs_ms": qrs_ms,
            "noise_level": noise_level,
            "st_shift": st_shift,
            "checks": checks,
            "signal_plot": signal_plot
        }

    except Exception as e:
        return {
            "valid": False,
            "bpm": None,
            "hrv": {},
            "qrs_ms": None,
            "noise_level": "Error",
            "st_shift": None,
            "checks": [f"Error processing lead: {str(e)}"],
            "signal_plot": None
        }


def process_12_leads(image_bgr):
    """
    Process all 12 leads from an ECG image.
    
    Args:
        image_bgr: Full 12-lead ECG image
        
    Returns:
        Dictionary with results for each lead
    """
    leads_img = crop_12_leads_grid(image_bgr)
    lead_results = {}

    for name, img_lead in leads_img.items():
        lead_results[name] = process_single_lead(img_lead)

    return lead_results


# =============================================================================
# 11. MI/ISCHEMIA PATTERN ANALYSIS
# =============================================================================

def analyze_mi_from_12leads(lead_results, st_elev_thresh=0.05, st_depr_thresh=-0.05):
    """
    Detect myocardial infarction (MI) patterns using ST segment analysis.
    
    Rules:
    - ST elevation in 2+ leads in same region suggests STEMI
    - ST depression suggests ischemia
    
    Args:
        lead_results: Dictionary of lead analysis results
        st_elev_thresh: Threshold for ST elevation
        st_depr_thresh: Threshold for ST depression
        
    Returns:
        Dictionary with MI analysis and risk assessment
    """
    def region_has_elevation(leads):
        vals = []
        for l in leads:
            info = lead_results.get(l, {})
            st = info.get("st_shift", None)
            if st is not None:
                vals.append(st)
        return sum(1 for v in vals if v >= st_elev_thresh), vals

    def region_has_depression(leads):
        vals = []
        for l in leads:
            info = lead_results.get(l, {})
            st = info.get("st_shift", None)
            if st is not None:
                vals.append(st)
        return sum(1 for v in vals if v <= st_depr_thresh), vals

    # Define lead regions
    anterior = ["V1", "V2", "V3", "V4"]
    lateral  = ["I", "aVL", "V5", "V6"]
    inferior = ["II", "III", "aVF"]
    septal   = ["V1", "V2"]

    regions_elev = []
    regions_depr = []

    # Check for elevation patterns
    ant_count, _ = region_has_elevation(anterior)
    lat_count, _ = region_has_elevation(lateral)
    inf_count, _ = region_has_elevation(inferior)
    sep_count, _ = region_has_elevation(septal)

    if ant_count >= 2:
        regions_elev.append("Anterior")
    if lat_count >= 2:
        regions_elev.append("Lateral")
    if inf_count >= 2:
        regions_elev.append("Inferior")
    if sep_count >= 2 and "Anterior" not in regions_elev:
        regions_elev.append("Septal")

    # Check for depression patterns
    ant_dep_count, _ = region_has_depression(anterior)
    lat_dep_count, _ = region_has_depression(lateral)
    inf_dep_count, _ = region_has_depression(inferior)

    if ant_dep_count >= 2:
        regions_depr.append("Anterior")
    if lat_dep_count >= 2:
        regions_depr.append("Lateral")
    if inf_dep_count >= 2:
        regions_depr.append("Inferior")

    # Risk scoring
    score = 0
    score += len(regions_elev) * 2
    score += len(regions_depr)

    if score == 0:
        severity = "None"
        mi_suspected = False
    elif score == 1:
        severity = "Low"
        mi_suspected = True
    elif score == 2:
        severity = "Moderate"
        mi_suspected = True
    else:
        severity = "High"
        mi_suspected = True

    # Generate explanation
    explanation = []
    if regions_elev:
        explanation.append(f"ST elevation pattern in: {', '.join(regions_elev)}")
    if regions_depr:
        explanation.append(f"ST depression pattern in: {', '.join(regions_depr)}")
    if not explanation:
        explanation.append("No significant ST segment changes detected")

    return {
        "mi_suspected": mi_suspected,
        "severity": severity,
        "regions_elevated": regions_elev,
        "regions_depressed": regions_depr,
        "comment": "; ".join(explanation)
    }
