'use strict';

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function formatClinicalValue(label, value, suffix = '') {
  if (value === undefined || value === null || value === '') return `${label}: N/A`;
  return `${label}: ${value}${suffix}`;
}

function buildGeminiPrescriptionPrompt(disease, riskScore, clinicalData = {}) {
  const age = safeNumber(clinicalData.age, 45);
  const gender = String(clinicalData.gender || 'Unknown');
  const bp = String(clinicalData.bp || '120/80');
  const bloodSugar = safeNumber(clinicalData.bloodSugar, 100);
  const cholesterol = safeNumber(clinicalData.cholesterol, 180);
  const ldl = safeNumber(clinicalData.ldl, 110);
  const hba1c = safeNumber(clinicalData.hba1c, 5.4);
  const uacr = safeNumber(clinicalData.uacr, 5);
  const bmi = safeNumber(clinicalData.bmi, 22);
  const creatinine = safeNumber(clinicalData.serumCreatinine, 1.0);
  const eGFR = safeNumber(clinicalData.eGFR, 90);
  const potassium = safeNumber(clinicalData.potassium, 4.2);
  const sodium = safeNumber(clinicalData.sodium, 138);
  const urea = safeNumber(clinicalData.urea, 20);
  const symptoms = Array.isArray(clinicalData.symptoms) ? clinicalData.symptoms : [];
  const symptomList = symptoms.length ? symptoms.join(', ') : 'None reported';
  const weightStatus = bmi >= 30 ? 'obese' : bmi >= 25 ? 'overweight' : bmi < 18.5 ? 'underweight' : 'normal BMI';
  const riskBand = riskScore >= 80 ? 'high-risk' : riskScore >= 60 ? 'moderate-risk' : 'low-risk';

  const patientHash = [
    disease,
    Number(age),
    Number(bmi),
    Number(bloodSugar),
    Number(hba1c),
    Number(eGFR),
    Number(creatinine),
    symptomList
  ].join('|');

  return `You are generating a unique clinical treatment plan for ONE patient only. Do NOT give a generic template. Your output must be personalized to this exact individual and differ meaningfully from any other case.

Patient fingerprint: ${patientHash}

Disease: ${disease}
Risk score: ${riskScore}% (${riskBand})

Patient profile:
- Age: ${age} years
- Gender: ${gender}
- BMI: ${bmi} (${weightStatus})
- Blood Pressure: ${bp} mmHg
- Fasting Glucose: ${bloodSugar} mg/dL
- HbA1c: ${hba1c}%
- Serum Creatinine: ${creatinine} mg/dL
- eGFR: ${eGFR} mL/min/1.73m²
- Blood Urea: ${urea} mg/dL
- UACR: ${uacr} mg/g
- Total Cholesterol: ${cholesterol} mg/dL
- LDL: ${ldl} mg/dL
- Potassium: ${potassium} mEq/L
- Sodium: ${sodium} mEq/L
- Active symptoms: ${symptomList}

Clinical decision requirements:
- Make the treatment plan specific to this patient's values, age group, BMI, kidney function, glucose burden, and symptoms.
- If the patient is older, has elevated glucose/HbA1c, obesity, or poor kidney function, prioritize renal-safe and diabetes-aware medication choices.
- If the patient is relatively young and low-risk, keep the plan conservative and avoid overshooting medications.
- Include affected organ system risk, medication choice, dose adjustments, contraindications, monitoring, and emergency red flags.
- Use plain text only. No markdown code fences or JSON.
- Write a distinct, patient-specific care plan; avoid repeating identical phrases across different profiles.

Return these sections exactly in order:
1. RECOMMENDED PHARMACOTHERAPY & DOSING:
2. CLINICAL RATIONALE & MULTI-PARAMETER BASIS:
3. CONTRAINDICATIONS & SAFETY PRECAUTIONS:
4. DIETARY & LIFESTYLE COUNSELING:
5. LAB & CLINICAL MONITORING SCHEDULE:
6. EMERGENCY RED FLAGS & URGENT ACTIONS:

ATTENDING PHYSICIAN ATTESTATION:
This plan was individualized for the specific patient profile above and reviewed for clinical risk, medication safety, and monitoring needs.
`;
}

function extractGeminiResponseText(response) {
  const candidates = response?.candidates || [];
  const parts = [];

  for (const candidate of candidates) {
    const contentParts = candidate?.content?.parts || [];
    for (const part of contentParts) {
      if (typeof part?.text === 'string' && part.text.trim()) {
        parts.push(part.text.trim());
      }
    }
  }

  if (!parts.length) {
    return '';
  }

  return parts.join('\n');
}

module.exports = {
  buildGeminiPrescriptionPrompt,
  extractGeminiResponseText,
  safeNumber,
  formatClinicalValue,
};
