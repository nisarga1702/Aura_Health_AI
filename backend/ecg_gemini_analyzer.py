"""
Advanced ECG Analysis API Handler
Integrates Gemini AI for intelligent ECG interpretation with image and signal processing
"""

import sys
import json
import base64
import os
import cv2
import numpy as np
import requests
import re
from io import BytesIO
from PIL import Image

# Import advanced ECG processing
from ecg_processing_advanced import (
    preprocess_image_bgr,
    image_to_signal,
    detect_r_peaks,
    hrv_metrics,
    simple_arrhythmia_checks,
    plot_signal,
    estimate_qrs_width,
    estimate_noise_level,
    process_12_leads,
    analyze_mi_from_12leads,
)


class ECGAnalysisHandler:
    """
    Handles comprehensive ECG image analysis combining signal processing and AI.
    """

    def __init__(self, gemini_api_key=None):
        self.gemini_api_key = gemini_api_key or os.getenv("GEMINI_API_KEY", "")
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        self.api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent"

    def decode_image(self, image_base64):
        """
        Decode base64 image to OpenCV format.
        """
        try:
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]
            img_bytes = base64.b64decode(image_base64)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return img
        except Exception as e:
            raise ValueError(f"Failed to decode image: {str(e)}")

    def analyze_ecg_signal(self, image_bgr):
        """
        Perform comprehensive ECG signal analysis on single-lead ECG.
        """
        try:
            binary = preprocess_image_bgr(image_bgr)
            signal = image_to_signal(binary)

            if signal is None or len(signal) < 10:
                return {
                    "success": False,
                    "error": "Signal extraction failed",
                    "analysis": None,
                }

            peaks, rr_sec, bpm = detect_r_peaks(signal)
            hrv = hrv_metrics(rr_sec)
            checks = simple_arrhythmia_checks(rr_sec, signal)
            plot_b64 = plot_signal(signal, peaks)
            qrs_ms = estimate_qrs_width(signal, peaks)
            noise_level = estimate_noise_level(signal)

            analysis = {
                "signal_analysis": {
                    "heart_rate": bpm,
                    "hrv_metrics": hrv,
                    "qrs_duration_ms": qrs_ms,
                    "noise_level": noise_level,
                    "arrhythmia_checks": checks,
                    "r_peak_count": len(peaks),
                },
                "plot": plot_b64,
            }

            return {"success": True, "analysis": analysis}

        except Exception as e:
            return {"success": False, "error": str(e), "analysis": None}

    def analyze_12_lead_ecg(self, image_bgr):
        """
        Perform comprehensive 12-lead ECG analysis.
        """
        try:
            leads_data = process_12_leads(image_bgr)
            mi_summary = analyze_mi_from_12leads(leads_data)

            analysis = {
                "leads": leads_data,
                "mi_analysis": mi_summary,
            }

            return {"success": True, "analysis": analysis}

        except Exception as e:
            return {"success": False, "error": str(e), "analysis": None}

    def call_gemini_api(self, prompt, image_base64=None):
        """
        Call Gemini API for AI-powered ECG interpretation.
        """
        try:
            if not self.gemini_api_key:
                return {"error": "Gemini API key not configured"}

            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": prompt},
                        ]
                    }
                ]
            }

            # Add image if provided
            if image_base64:
                payload["contents"][0]["parts"].append(
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": image_base64,
                        }
                    }
                )

            response = requests.post(
                f"{self.api_url}?key={self.gemini_api_key}",
                json=payload,
                timeout=30,
            )

            if response.status_code != 200:
                return {
                    "error": f"Gemini API error: {response.status_code}",
                    "details": response.text,
                }

            result = response.json()
            model_text = result["candidates"][0]["content"]["parts"][0]["text"]

            # Extract JSON if present
            json_match = re.search(r"\{[\s\S]*\}", model_text)
            if json_match:
                try:
                    json_response = json.loads(json_match.group(0))
                    return json_response
                except json.JSONDecodeError:
                    return {"text_response": model_text}
            else:
                return {"text_response": model_text}

        except requests.exceptions.Timeout:
            return {"error": "Gemini API request timeout"}
        except Exception as e:
            return {"error": f"Gemini API call failed: {str(e)}"}

    def comprehensive_ecg_analysis(self, image_base64, patient_info=None):
        """
        Perform comprehensive ECG analysis combining signal processing and AI.
        """
        try:
            # Decode image
            img = self.decode_image(image_base64)

            # Perform signal analysis
            signal_analysis = self.analyze_ecg_signal(img)

            # Perform 12-lead analysis if applicable
            twelve_lead_analysis = self.analyze_12_lead_ecg(img)

            # Prepare Gemini prompt
            patient_details = patient_info or {}
            prompt = f"""You are a professional cardiologist. Analyze this ECG image.

Patient Details:
- Name: {patient_details.get('name', 'Unknown')}
- Age: {patient_details.get('age', 'Unknown')}
- Gender: {patient_details.get('gender', 'Unknown')}
- Medical History: {patient_details.get('history', 'Not provided')}

Please provide a detailed analysis in JSON format with the following fields:
{{
  "condition_analysis": "Your detailed analysis of the ECG condition",
  "diagnosis": "Primary diagnosis or differential diagnoses",
  "severity": "Severity level (Normal/Mild/Moderate/Severe/Critical)",
  "age_based_interpretation": "Interpretation considering patient age",
  "recommendation": "Recommended actions or follow-up",
  "suggested_actions": "Immediate suggested actions if any"
}}

Respond ONLY with valid JSON."""

            # Call Gemini API
            ai_analysis = self.call_gemini_api(prompt, image_base64)

            # Combine results
            result = {
                "success": True,
                "signal_analysis": signal_analysis.get("analysis"),
                "twelve_lead_analysis": twelve_lead_analysis.get("analysis"),
                "ai_interpretation": ai_analysis,
                "timestamp": str(
                    np.datetime64("now")
                ),  # Current timestamp
            }

            return result

        except Exception as e:
            return {"success": False, "error": str(e)}


def main():
    """
    Main handler for command-line execution from Node.js backend.
    """
    try:
        # Read input from stdin or command-line args
        if len(sys.argv) > 1:
            payload = json.loads(sys.argv[1])
        else:
            payload = json.loads(sys.stdin.read())

        # Extract required parameters
        image_base64 = payload.get("image")
        patient_info = payload.get("patient_info", {})
        gemini_api_key = payload.get("gemini_api_key")
        analysis_type = payload.get("analysis_type", "comprehensive")

        if not image_base64:
            print(json.dumps({"error": "No image provided"}))
            return

        # Initialize handler
        handler = ECGAnalysisHandler(gemini_api_key=gemini_api_key)

        # Perform analysis based on type
        if analysis_type == "signal_only":
            img = handler.decode_image(image_base64)
            result = handler.analyze_ecg_signal(img)
        elif analysis_type == "12_lead":
            img = handler.decode_image(image_base64)
            result = handler.analyze_12_lead_ecg(img)
        else:  # comprehensive
            result = handler.comprehensive_ecg_analysis(image_base64, patient_info)

        # Output result as JSON
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))


if __name__ == "__main__":
    main()
