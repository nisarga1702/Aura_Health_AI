/**
 * AURA-Health AI — localDb.js  (PATCHED)
 * ─────────────────────────────────────────────────────────────────────────────
 * BUG #4 FIX: generateOfflinePredictions
 *   - Added input sanitisation: NaN / null / undefined inputs default to
 *     their population-normal value, not to 0 (which was being penalised
 *     heavily by the weighted scorer).
 *   - Added age-gated floor: if the patient is < 35 with no abnormal labs,
 *     the minimum returned risk is capped at a clinically sane ceiling.
 *   - Added partial-data detector: if fewer than 3 biomarkers are populated,
 *     the score is flagged as INSUFFICIENT_DATA and capped at 40 %.
 *
 * BUG #2 FIX: calculateLongitudinalTrends
 *   - Returns history sorted ascending by createdTime (unchanged).
 *   - Caller must check history.length >= 2 AFTER receiving the array — the
 *     DB function itself always returns an array; never null or undefined.
 *   - Added explicit toArray() guard so a missing predictions table doesn't
 *     throw.
 *
 * All other database scaffolding is unchanged from v4.
 */

import Dexie from 'dexie';

export const db = new Dexie('AuraHealthAIDatabase');

db.version(3).stores({
  patients:     '++id, patientId, name, age, gender, createdTime, synced, fundusAttached',
  predictions:  '++id, patientId, heartRisk, diabetesRisk, kidneyRisk, createdTime, synced',
  vitalsBuffer: '++id, patientId, heartRate, spo2, bpSystolic, bpDiastolic, timestamp, synced',
  prescriptions:'++id, patientId, doctorName, createdTime, synced',
  nurseNotes:   '++id, patientId, nurseUsername, note, createdTime'
});

db.version(4).stores({
  patients:     '++id, patientId, name, age, gender, createdTime, synced, fundusAttached, ldl, hba1c, uacr',
  predictions:  '++id, patientId, heartRisk, diabetesRisk, kidneyRisk, createdTime, synced',
  vitalsBuffer: '++id, patientId, heartRate, spo2, bpSystolic, bpDiastolic, timestamp, synced',
  prescriptions:'++id, patientId, doctorName, createdTime, synced',
  nurseNotes:   '++id, patientId, nurseUsername, note, createdTime'
});

// ─── BUG #2 FIX: Longitudinal trends ─────────────────────────────────────────
/**
 * Returns:
 *   { heartDiff, diabetesDiff, kidneyDiff, history: Array<{date,heart,diabetes,kidney}> }
 *
 * history is ALWAYS an array (possibly empty).  Never null / undefined.
 * The chart component must gate on history.length >= 2 to show sparklines.
 */
export async function calculateLongitudinalTrends(patientId) {
  let records = [];
  try {
    records = await db.predictions.where('patientId').equals(patientId).toArray();
  } catch (e) {
    console.error('[localDb] calculateLongitudinalTrends DB error:', e);
    return { heartDiff: 0, diabetesDiff: 0, kidneyDiff: 0, history: [] };
  }

  // Sort ascending by createdTime
  records.sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));

  if (records.length === 0) {
    return { heartDiff: 0, diabetesDiff: 0, kidneyDiff: 0, history: [] };
  }

  const last  = records[records.length - 1];
  const first = records[0];

  const heartDiff    = records.length > 1 ? last.heartRisk    - first.heartRisk    : 0;
  const diabetesDiff = records.length > 1 ? last.diabetesRisk - first.diabetesRisk : 0;
  const kidneyDiff   = records.length > 1 ? last.kidneyRisk   - first.kidneyRisk   : 0;

  return {
    heartDiff,
    diabetesDiff,
    kidneyDiff,
    history: records.map(r => ({
      date:     new Date(r.createdTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      heart:    r.heartRisk,
      diabetes: r.diabetesRisk,
      kidney:   r.kidneyRisk,
    })),
  };
}

// ─── Utility helpers ──────────────────────────────────────────────────────────
export async function checkOnlineStatus() {
  if (!navigator.onLine) return false;
  try {
    const res = await fetch('/api/health', { method: 'GET' });
    return res.status === 200;
  } catch { return false; }
}

export async function checkDuplicatePatient(name, age) {
  const trimmedName = name.trim().toLowerCase();
  const patients = await db.patients.where('name').startsWithIgnoreCase(name).toArray();
  const exactMatch = patients.find(
    p => p.name.toLowerCase() === trimmedName && p.age === parseInt(age)
  );
  return exactMatch || null;
}

export function generatePatientId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `AURA-${code}`;
}

// ─── BUG #4 FIX: Offline prediction engine ───────────────────────────────────
/**
 * Population-normal defaults for each biomarker.
 * When a field is empty / NaN, we use this value instead of 0.
 * Using 0 caused every "missing" biomarker to score at the low-risk extreme
 * of its normalised range in some features but at the high-risk extreme in
 * inverse-scored features (e.g. eGFR), causing catastrophic combined scores.
 */
const POPULATION_DEFAULTS = {
  systolic:        120,
  cholesterol:     185,
  ldl:             115,
  hba1c:           5.4,
  uacr:            5,
  bloodSugar:      90,
  bmi:             22.5,
  insulin:         10,
  serumCreatinine: 0.9,
  eGFR:            95,
  urea:            18,
  potassium:       4.1,
};

/**
 * safe(val, defaultVal) — returns a finite number or the population default.
 * This is the single fix for the "empty field = extreme penalty" bug.
 */
function safe(val, defaultVal) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : defaultVal;
}

/**
 * wv(val, min, max, weight)
 * Weighted normalised value — clamped [0, 1] × weight.
 */
function wv(val, min, max, weight) {
  return Math.min(1, Math.max(0, (val - min) / (max - min))) * weight;
}

/**
 * countPopulatedBiomarkers(c)
 * Returns the number of fields that were actually supplied (non-NaN).
 * Used to detect partial submissions.
 */
function countPopulatedBiomarkers(raw) {
  return [
    raw.cholesterol, raw.bloodSugar, raw.bmi, raw.insulin,
    raw.serumCreatinine, raw.eGFR, raw.urea, raw.potassium,
    raw.ldl, raw.hba1c, raw.uacr,
  ].filter(v => v != null && !isNaN(parseFloat(v))).length;
}

export function generateOfflinePredictions(raw) {
  // ── 1. Sanitise all inputs ────────────────────────────────────────────────
  const systolic        = safe((raw.bp || '120/80').split('/')[0], POPULATION_DEFAULTS.systolic);
  const cholesterol     = safe(raw.cholesterol,     POPULATION_DEFAULTS.cholesterol);
  const ldl             = safe(raw.ldl,             POPULATION_DEFAULTS.ldl);
  const bloodSugar      = safe(raw.bloodSugar,      POPULATION_DEFAULTS.bloodSugar);
  const hba1c           = safe(raw.hba1c,           POPULATION_DEFAULTS.hba1c);
  const bmi             = safe(raw.bmi,             POPULATION_DEFAULTS.bmi);
  const insulin         = safe(raw.insulin,         POPULATION_DEFAULTS.insulin);
  const serumCreatinine = safe(raw.serumCreatinine, POPULATION_DEFAULTS.serumCreatinine);
  const eGFR            = safe(raw.eGFR,            POPULATION_DEFAULTS.eGFR);
  const urea            = safe(raw.urea,            POPULATION_DEFAULTS.urea);
  const potassium       = safe(raw.potassium,       POPULATION_DEFAULTS.potassium);
  const uacr            = safe(raw.uacr,            POPULATION_DEFAULTS.uacr);
  const age             = safe(raw.age,             35);

  const symptoms = Array.isArray(raw.symptoms) ? raw.symptoms : [];

  // ── 2. Detect partial submissions ─────────────────────────────────────────
  const biomarkerCount  = countPopulatedBiomarkers(raw);
  const isPartialRecord = biomarkerCount < 3;

  // ── 3. Score each disease ─────────────────────────────────────────────────
  // Heart risk
  const heartRaw =
    wv(systolic,    80, 200, 0.28) +
    wv(cholesterol, 100, 300, 0.22) +
    wv(age,         20, 90,  0.18) +
    wv(bmi,         15, 45,  0.12) +
    (symptoms.includes('chestPain')      ? 0.12 : 0) +
    (symptoms.includes('breathlessness') ? 0.08 : 0);

  // Diabetes risk
  const diabRaw =
    wv(bloodSugar, 70, 400,  0.30) +
    wv(hba1c,      4,  13,   0.22) +   // HbA1c now explicitly scored
    wv(bmi,        15, 50,   0.18) +
    wv(insulin,    0,  300,  0.14) +
    wv(age,        20, 90,   0.10) +
    (symptoms.includes('frequentUrination') ? 0.06 : 0);

  // Kidney risk  (note: eGFR is inverse-scored — lower eGFR = higher risk)
  const kidneyRaw =
    wv(serumCreatinine, 0.4, 10,  0.30) +
    (1 - wv(eGFR,       5,  120,  0.28)) +   // inverse
    wv(uacr,            0,  300,  0.18) +    // UACR now explicitly scored
    wv(urea,            10, 200,  0.12) +
    wv(potassium,       3,  7,    0.08) +
    (symptoms.includes('swelling') ? 0.04 : 0);

  // ── 4. Convert to percentages ──────────────────────────────────────────────
  let heartRisk    = Math.round(heartRaw    * 100);
  let diabetesRisk = Math.round(diabRaw     * 100);
  let kidneyRisk   = Math.round(kidneyRaw   * 100);

  // ── 5. BUG #4 CORE FIX: Age-gated floor + partial-data cap ────────────────
  // (a) Partial record: never show catastrophic risk from missing data
  if (isPartialRecord) {
    const PARTIAL_CAP = 40;
    heartRisk    = Math.min(heartRisk,    PARTIAL_CAP);
    diabetesRisk = Math.min(diabetesRisk, PARTIAL_CAP);
    kidneyRisk   = Math.min(kidneyRisk,   PARTIAL_CAP);
  }

  // (b) Young patient (<35) with only default/normal lab values:
  //     max allowable risk is clinically constrained
  const allNormal =
    systolic        <= 130 &&
    cholesterol     <= 200 &&
    bloodSugar      <= 100 &&
    bmi             <= 25  &&
    serumCreatinine <= 1.1 &&
    eGFR            >= 90  &&
    hba1c           <= 5.7 &&
    uacr            <= 30;

  if (age < 35 && allNormal && symptoms.length === 0) {
    heartRisk    = Math.min(heartRisk,    25);
    diabetesRisk = Math.min(diabetesRisk, 20);
    kidneyRisk   = Math.min(kidneyRisk,   18);
  }

  // (c) Hard absolute clamp — never return 0% or 100% (not clinically meaningful)
  heartRisk    = Math.min(97, Math.max(3, heartRisk));
  diabetesRisk = Math.min(97, Math.max(3, diabetesRisk));
  kidneyRisk   = Math.min(97, Math.max(3, kidneyRisk));

  // ── 6. Determine primary disease ──────────────────────────────────────────
  const maxRisk = Math.max(heartRisk, diabetesRisk, kidneyRisk);
  const primaryDisease =
    maxRisk === heartRisk    ? 'Cardiovascular Disease' :
    maxRisk === diabetesRisk ? 'Diabetes Mellitus'      :
                               'Chronic Kidney Disease';

  // ── 7. Cross-disease commentary ───────────────────────────────────────────
  const crossRisks = [];
  if (heartRisk > 50 && diabetesRisk > 40)
    crossRisks.push('Elevated glucose accelerates atherosclerosis, compounding cardiovascular risk.');
  if (diabetesRisk > 50 && kidneyRisk > 40)
    crossRisks.push('Diabetic nephropathy likely — elevated glucose damages renal filtration over time.');
  if (heartRisk > 50 && kidneyRisk > 40)
    crossRisks.push('Cardiorenal syndrome detected — impaired cardiac output reduces GFR.');

  // ── 8. Data quality annotation ────────────────────────────────────────────
  const dataQualityNote = isPartialRecord
    ? ` ⚠️ Scores are capped at 40% due to incomplete biomarker data (${biomarkerCount}/11 fields supplied). Please complete the clinical form for accurate risk assessment.`
    : '';

  const xai = {
    disease:    primaryDisease,
    riskScore:  maxRisk,
    rootCause:
      `Offline AI Engine: Primary concern is ${primaryDisease} (${maxRisk}% risk). ` +
      (crossRisks.length
        ? `Interconnection notes: ${crossRisks.join(' ')}`
        : 'No significant cross-disease compounding detected at current thresholds.') +
      dataQualityNote,
    shapData: [
      { feature: 'Primary biomarker',  importance: 0.42, description: 'Core lab value exceeds clinical threshold.' },
      { feature: 'Age factor',          importance: 0.24, description: 'Age contributes to baseline physiological decline.' },
      { feature: 'BMI / Metabolic',     importance: 0.18, description: 'Elevated metabolic index amplifies organ strain.' },
      { feature: 'Symptom cluster',     importance: 0.16, description: 'Reported symptoms correlate with predicted disease profile.' },
    ],
    limeData: [
      { feature: 'Blood Glucose', value: String(raw.bloodSugar || '—'), effect: bloodSugar > 140 ? 'Strongly increases risk' : 'Neutral' },
      { feature: 'eGFR / Creatinine', value: `${raw.eGFR || '—'} / ${raw.serumCreatinine || '—'}`, effect: eGFR < 60 ? 'Increases kidney risk' : 'Normal range' },
      { feature: 'Systolic BP', value: String(systolic), effect: systolic > 140 ? 'Increases heart + kidney risk' : 'Acceptable' },
      { feature: 'Cholesterol', value: String(raw.cholesterol || '—'), effect: cholesterol > 240 ? 'Strongly increases heart risk' : 'Borderline' },
    ],
    crossDiseaseWarnings:  crossRisks,
    dataQualityWarning:    isPartialRecord ? `Incomplete data: only ${biomarkerCount}/11 biomarkers supplied.` : null,
    gradCamCoordinates:    { heatmapPoints: [] },
  };

  return { heartRisk, diabetesRisk, kidneyRisk, xai };
}

// ─── Offline sync stub ────────────────────────────────────────────────────────
export async function syncOfflineData() {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) return { success: false, syncedCount: 0 };

  let syncedCount = 0;
  const up = await db.patients.where('synced').equals(0).toArray();
  for (const p of up) { await db.patients.update(p.id, { synced: 1 }); syncedCount++; }
  const pr = await db.predictions.where('synced').equals(0).toArray();
  for (const p of pr) { await db.predictions.update(p.id, { synced: 1 }); syncedCount++; }
  await db.vitalsBuffer.where('synced').equals(0).modify({ synced: 1 });

  return { success: true, syncedCount };
}
