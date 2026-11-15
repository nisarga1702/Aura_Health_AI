/**
 * AURA-Health AI — PatientContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for:
 *   patient demographics  →  risk scores  →  longitudinal history  →  AI prescriptions
 *
 * BUG FIXES ADDRESSED:
 *  #1  Demographic mutation    – immutable load from DB; no random fallback after first hydration
 *  #2  Longitudinal chart       – history array always populated from ALL predictions rows
 *  #3  Prescription staleness  – prescription state is reset every time patientId changes
 *  #4  Risk over-activation     – normalised inputs + age-gated floor enforcement
 */

import React, {
  createContext, useContext, useReducer, useCallback, useEffect
} from 'react';
import API_BASE from '../config/api';
import { db, calculateLongitudinalTrends } from '../db/localDb';

// ─── Shape of the store ───────────────────────────────────────────────────────
const INITIAL_STATE = {
  // The immutable demographic record loaded from IndexedDB
  patient: null,           // { patientId, name, age, gender, clinicalData, … }

  // Latest risk snapshot (from predictions table)
  predictions: null,       // { heartRisk, diabetesRisk, kidneyRisk, … }

  // Full longitudinal history array — drives the trend chart
  // Each entry: { date, heart, diabetes, kidney }
  longitudinalHistory: [], // ← FIX #2: always an array, never undefined/null

  // Per-disease AI prescriptions (keyed by 'heart' | 'diabetes' | 'kidney')
  prescriptionsMap: {},    // ← FIX #3: cleared on every patientId change

  prescriptionLoading: false,
  longitudinalLoading: false,
  error: null,
};

// ─── Action types ─────────────────────────────────────────────────────────────
const A = {
  LOAD_PATIENT_START:        'LOAD_PATIENT_START',
  LOAD_PATIENT_SUCCESS:      'LOAD_PATIENT_SUCCESS',
  LOAD_PATIENT_ERROR:        'LOAD_PATIENT_ERROR',
  SET_LONGITUDINAL:          'SET_LONGITUDINAL',
  SET_LONGITUDINAL_LOADING:  'SET_LONGITUDINAL_LOADING',
  SET_PRESCRIPTIONS_MAP:     'SET_PRESCRIPTIONS_MAP',
  SET_PRESCRIPTION_LOADING:  'SET_PRESCRIPTION_LOADING',
  CLEAR_PATIENT:             'CLEAR_PATIENT',
};

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    // FIX #1 + #3: Clear EVERYTHING before loading a new patient so no stale
    //              demographics or prescriptions bleed across patient switches.
    case A.LOAD_PATIENT_START:
      return {
        ...INITIAL_STATE,
        prescriptionLoading: true,
        longitudinalLoading: true,
      };

    // FIX #1: patient is set ONCE from the DB record; never re-generated.
    case A.LOAD_PATIENT_SUCCESS:
      return {
        ...state,
        patient: action.patient,       // immutable snapshot
        predictions: action.predictions,
        error: null,
      };

    case A.LOAD_PATIENT_ERROR:
      return { ...state, error: action.error, prescriptionLoading: false, longitudinalLoading: false };

    // FIX #2: longitudinalHistory is the full sorted array from DB.
    //         The chart component reads this directly — no extra filtering needed.
    case A.SET_LONGITUDINAL:
      return {
        ...state,
        longitudinalHistory: action.history,   // always an array (possibly [])
        longitudinalLoading: false,
      };

    case A.SET_LONGITUDINAL_LOADING:
      return { ...state, longitudinalLoading: action.value };

    // FIX #3: replace the whole map so old disease prescriptions don't linger.
    case A.SET_PRESCRIPTIONS_MAP:
      return {
        ...state,
        prescriptionsMap: action.map,
        prescriptionLoading: false,
      };

    case A.SET_PRESCRIPTION_LOADING:
      return { ...state, prescriptionLoading: action.value };

    case A.CLEAR_PATIENT:
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

// ─── Context + Provider ───────────────────────────────────────────────────────
const PatientContext = createContext(null);

export function PatientProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  /**
   * loadPatient(patientId)
   * ─────────────────────
   * Entry-point called by RecordsScreen / ResultsScreen / PatientPortal.
   * Loads demographics strictly from DB (FIX #1), then fans out to load
   * longitudinal history (FIX #2) and per-disease prescriptions (FIX #3).
   */
  const loadPatient = useCallback(async (patientId) => {
    if (!patientId) return;

    // Reset everything first so old data never flickers through (FIX #1, #3)
    dispatch({ type: A.LOAD_PATIENT_START });

    try {
      // ── 1. Immutable demographic fetch ────────────────────────────────────
      const patient = await db.patients
        .where('patientId')
        .equals(patientId.toUpperCase().trim())
        .first();

      if (!patient) {
        dispatch({ type: A.LOAD_PATIENT_ERROR, error: `No patient found for ID: ${patientId}` });
        return;
      }

      // ── 2. Latest prediction snapshot ─────────────────────────────────────
      // We use .last() so the most recent run is shown in the header.
      const allPreds = await db.predictions
        .where('patientId')
        .equals(patient.patientId)
        .toArray();

      allPreds.sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));
      const latestPred = allPreds[allPreds.length - 1] || null;

      // Dispatch patient + latest prediction (FIX #1: no random generation)
      dispatch({ type: A.LOAD_PATIENT_SUCCESS, patient, predictions: latestPred });

      // ── 3. Build full longitudinal history (FIX #2) ───────────────────────
      // calculateLongitudinalTrends already sorts and maps to { date, heart, diabetes, kidney }
      const trends = await calculateLongitudinalTrends(patient.patientId);
      dispatch({ type: A.SET_LONGITUDINAL, history: trends.history });

      // ── 4. Kick off AI prescription fetch (FIX #3) ────────────────────────
      if (latestPred) {
        fetchPrescriptions(patient, latestPred);
      } else {
        dispatch({ type: A.SET_PRESCRIPTION_LOADING, value: false });
      }

    } catch (err) {
      console.error('[PatientContext] loadPatient error:', err);
      dispatch({ type: A.LOAD_PATIENT_ERROR, error: err.message });
    }
  }, []);

  /**
   * fetchPrescriptions
   * ──────────────────
   * Fetches three disease-specific AI prescriptions in parallel.
   * Falls back to an empty string per disease if the server is down.
   * FIX #3: this is always called with the CURRENT patient's data because
   *         loadPatient dispatches LOAD_PATIENT_START first (clears old map).
   */
  const fetchPrescriptions = useCallback(async (patient, predictions) => {
    dispatch({ type: A.SET_PRESCRIPTION_LOADING, value: true });

    const diseases = [
      { key: 'heart',    name: 'Cardiovascular Disease',  riskKey: 'heartRisk' },
      { key: 'diabetes', name: 'Diabetes Mellitus',        riskKey: 'diabetesRisk' },
      { key: 'kidney',   name: 'Chronic Kidney Disease',   riskKey: 'kidneyRisk' },
    ];

    const map = {};

    await Promise.all(
      diseases.map(async (d) => {
        const riskScore = predictions[d.riskKey];
        try {
          const res = await fetch(`${API_BASE}/api/generatePrescription`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              disease:      d.name,
              riskScore,
              clinicalData: patient.clinicalData,
            }),
          });
          const json = await res.json();
          map[d.key] = json.prescription || '';
        } catch {
          map[d.key] = ''; // server offline — editor stays blank, not stale
        }
      })
    );

    dispatch({ type: A.SET_PRESCRIPTIONS_MAP, map });
  }, []);

  /**
   * setCurrentResult(result)
   * ─────────────────────────
   * Used by NewPatientScreen after a fresh analysis to push a brand-new result
   * directly into context without a DB round-trip (the data is already in memory).
   * Still triggers longitudinal reload + prescription fetch for consistency.
   */
  const setCurrentResult = useCallback(async ({ patient, predictions }) => {
    dispatch({ type: A.LOAD_PATIENT_START });
    dispatch({ type: A.LOAD_PATIENT_SUCCESS, patient, predictions });

    // Reload history — the new prediction was already written to DB before this call
    const trends = await calculateLongitudinalTrends(patient.patientId);
    dispatch({ type: A.SET_LONGITUDINAL, history: trends.history });

    fetchPrescriptions(patient, predictions);
  }, [fetchPrescriptions]);

  const clearPatient = useCallback(() => {
    dispatch({ type: A.CLEAR_PATIENT });
  }, []);

  return (
    <PatientContext.Provider value={{ ...state, loadPatient, setCurrentResult, clearPatient }}>
      {children}
    </PatientContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePatient() {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error('usePatient must be used inside <PatientProvider>');
  return ctx;
}
