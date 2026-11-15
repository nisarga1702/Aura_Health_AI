/**
 * AURA-Health AI — ResultsScreen.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Restored EXACT original component sequence and layout order.
 * All diagnostic cards, line graphs, organ maps, simulators, AI summaries,
 * SHAP/LIME panels, Grad-CAM viewers, prescriptions, and nurse task forms
 * appear in their exact original positions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, FileText, Heart, Sparkles, Activity,
  AlertTriangle, TrendingUp, TrendingDown, Eye, FileDown, Info, UserCheck
} from 'lucide-react';
import API_BASE from '../config/api';
import { db } from '../db/localDb';
import { usePatient } from '../context/PatientContext';
import GradCamViewer    from '../components/GradCamViewer';
import EcgAiSummary    from '../components/EcgAiSummary';
import SpeechReader     from '../components/SpeechReader';
import PrescriptionCard from '../components/PrescriptionCard';
import AnatomicalOrganMap from '../components/AnatomicalOrganMap';
import RiskCounterfactualSimulator from '../components/RiskCounterfactualSimulator';
import ClinicalPdfExporter from '../components/ClinicalPdfExporter';
import KidneyClinicalSummary from '../components/KidneyClinicalSummary';
import SeparateDiseaseLineGraph from '../components/SeparateDiseaseLineGraph';

function RiskGraphicalCardGauge({ score, color, label, icon, isPredicted, isActive, onClick }) {
  return (
    <div
      className="glass-panel"
      onClick={onClick}
      style={{
        textAlign: 'center',
        cursor: 'pointer',
        border: isActive ? `2px solid ${color}` : '1px solid var(--glass-border)',
        transition: 'all 0.2s',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>{label}</span>
        {icon}
      </div>

      <div style={{ fontSize: '24px', fontWeight: '900', color: color, margin: '8px 0' }}>
        {score}%
      </div>

      {/* Disease Predicted YES / NO Tag */}
      <div style={{ marginTop: '8px', width: '100%' }}>
        {isPredicted ? (
          <span className="badge badge-danger" style={{ width: '100%', padding: '5px 8px', fontSize: '11px', fontWeight: '700', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            ⚠️ Disease Predicted: YES
          </span>
        ) : (
          <span className="badge badge-success" style={{ width: '100%', padding: '5px 8px', fontSize: '11px', fontWeight: '700', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            ✅ Disease Predicted: NO
          </span>
        )}
      </div>

      {isActive && <div style={{ fontSize: '10px', color: color, marginTop: '6px', fontWeight: '600' }}>▲ Active Selection</div>}
    </div>
  );
}

export default function ResultsScreen({ onNavigate, t, lang, userRole, user }) {
  const {
    patient,
    predictions,
    longitudinalHistory,
    prescriptionsMap,
    prescriptionLoading,
    longitudinalLoading,
  } = usePatient();

  const [prescription,       setPrescription]       = useState('');
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [activeTab,          setActiveTab]          = useState('heart');
  const [gradCamMode,        setGradCamMode]        = useState('ecg');
  const [isSaved,            setIsSaved]            = useState(false);

  // Nurse task assignment state
  const [selectedNurse, setSelectedNurse] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDosage, setTaskDosage] = useState('');
  const [assigningTask, setAssigningTask] = useState(false);
  const [assignedTasks, setAssignedTasks] = useState([]);

  const doctorNurses = user?.id === 'doc_2' ? ['nurse3', 'nurse4'] : ['nurse1', 'nurse2'];

  useEffect(() => {
    setSelectedNurse(doctorNurses[0]);
  }, [user?.id]);

  const fetchDoctorTasks = useCallback(async () => {
    if (user?.role !== 'doctor' || !user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/getDoctorTasks?doctorId=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setAssignedTasks(data.tasks.filter(t => t.patientId === patient?.patientId));
      }
    } catch (e) {
      console.warn("Failed to fetch doctor tasks", e);
    }
  }, [user?.role, user?.id, patient?.patientId]);

  useEffect(() => {
    fetchDoctorTasks();
  }, [fetchDoctorTasks]);

  const handleAssignTask = async (e) => {
    e.preventDefault();
    if (!selectedNurse || !taskDesc) {
      alert("Please select a nurse and enter task details.");
      return;
    }
    setAssigningTask(true);
    try {
      const res = await fetch(`${API_BASE}/api/assignTask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: user.id,
          patientId: patient.patientId,
          nurseId: selectedNurse,
          task: {
            description: taskDesc,
            dosage: taskDosage
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("Task assigned successfully to " + selectedNurse);
        setTaskDesc('');
        setTaskDosage('');
        fetchDoctorTasks();
      } else {
        alert("Failed to assign task: " + data.error);
      }
    } catch (err) {
      alert("Error assigning task: " + err.message);
    } finally {
      setAssigningTask(false);
    }
  };

  useEffect(() => {
    setIsSaved(false);
    setPrescription('');
  }, [patient?.patientId, activeTab]);

  if (!patient || !predictions) {
    return (
      <div className="container" style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>No Diagnostic Result Loaded</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
          Open a patient from Records, or run a new diagnostic via New Patient.
        </p>
        <button onClick={() => onNavigate('records')} className="btn-primary">
          Go to Records
        </button>
      </div>
    );
  }

  const imageSrc = gradCamMode === 'fundus' ? patient.fundusImage : patient.ecgImage;
  const xai      = predictions.primaryExplanation || {};

  const getRiskColor = (s) =>
    s > 70 ? 'var(--color-danger)' : s > 40 ? 'var(--color-warning)' : 'var(--color-success)';

  const handleUseAIPrescription = () => {
    const aiText = prescriptionsMap[activeTab];
    if (aiText) setPrescription(aiText);
  };

  const handleSavePrescription = async () => {
    if (userRole !== 'doctor') return;
    setSavingPrescription(true);
    try {
      let rec = patient;
      if (!rec?.id) {
        rec = await db.patients.where('patientId').equals(patient.patientId).first();
      }
      if (!rec?.id) throw new Error('Patient record not found in local database.');
      await db.patients.update(rec.id, { prescriptions: prescription, synced: 0 });
      await db.prescriptions.add({
        patientId:   patient.patientId,
        text:        prescription,
        doctorName:  'Attending Doctor',
        createdTime: new Date().toISOString(),
        synced:      0,
      });
      alert('Prescription saved to patient record.');
      setIsSaved(true);
    } catch (e) {
      alert(`Unable to save prescription: ${e.message}`);
    } finally {
      setSavingPrescription(false);
    }
  };

  const cd = patient.clinicalData || {};

  const diseaseDetails = {
    heart: {
      icon:  <Heart size={20} color={getRiskColor(predictions.heartRisk)} />,
      label: t.riskHeart,
      score: predictions.heartRisk,
      color: getRiskColor(predictions.heartRisk),
      rootCause: (cd.bp && parseInt(cd.bp.split('/')[0]) > 130) || (cd.cholesterol > 200)
        ? `Arterial workload (${cd.bp || '120/80'} mmHg) and lipid metrics (${cd.cholesterol || 180} mg/dL) drive cardiovascular stress.`
        : 'Cardiovascular parameters are within healthy baseline limits with low overall risk.',
      shapData: [
        { feature: 'Systolic BP',   importance: 0.35 },
        { feature: 'Cholesterol',   importance: 0.28 },
        { feature: 'Age',           importance: 0.22 },
        { feature: 'BMI',           importance: 0.15 },
      ],
      limeData: [
        { feature: 'Blood Pressure', value: cd.bp || '120/80', effect: parseInt((cd.bp || '120').split('/')[0]) > 140 ? 'Increases risk' : 'Normal / Safe' },
        { feature: 'Cholesterol',    value: (cd.cholesterol || 180) + ' mg/dL', effect: (cd.cholesterol || 0) > 240 ? 'Strongly increases risk' : 'Optimal' },
      ],
      parametersTable: [
        { name: "Blood Pressure (Systolic)", value: (parseInt((cd.bp || '120/80').split('/')[0]) || 120) + " mmHg", normal: "90-120 mmHg", max: "180 mmHg" },
        { name: "Cholesterol", value: (cd.cholesterol || 180) + " mg/dL", normal: "125-200 mg/dL", max: "300 mg/dL" },
        { name: "Age", value: (cd.age || 45) + " yrs", normal: "18-60 yrs", max: "90 yrs" },
        { name: "BMI", value: (cd.bmi || 22.4), normal: "18.5-24.9", max: "45" },
        { name: "Chest Pain Type", value: cd.chestPainType || (cd.symptoms?.includes('chestPain') ? 'Present' : 'None'), normal: "None", max: "Present" },
        { name: "Breathlessness", value: (cd.symptoms?.includes('breathlessness') ? 'Present' : 'None'), normal: "None", max: "Present" }
      ],
      rec: predictions.heartRisk > 70
        ? 'Urgent cardiology referral. Anti-hypertensives + statins. ECG + Echo within 48h.'
        : predictions.heartRisk > 40
        ? 'Reduce sodium. Daily BP monitoring. Follow up in 2 weeks.'
        : 'Maintain healthy lifestyle. Annual cardiac screening.',
    },
    diabetes: {
      icon:  <Sparkles size={20} color={getRiskColor(predictions.diabetesRisk)} />,
      label: t.riskDiabetes,
      score: predictions.diabetesRisk,
      color: getRiskColor(predictions.diabetesRisk),
      rootCause: (cd.bloodSugar > 100) || (cd.hba1c > 5.7)
        ? `Fasting blood glucose (${cd.bloodSugar || 100} mg/dL) and HbA1c (${cd.hba1c || 5.4}%) contribute to metabolic risk.`
        : 'Fasting glucose and pancreatic beta-cell indicators demonstrate healthy glycemic regulation.',
      shapData: [
        { feature: 'Fasting Glucose', importance: 0.40 },
        { feature: 'HbA1c',         importance: 0.30 },
        { feature: 'BMI',           importance: 0.18 },
        { feature: 'Insulin level', importance: 0.12 },
      ],
      limeData: [
        { feature: 'Blood Glucose', value: (cd.bloodSugar || 100) + ' mg/dL', effect: (cd.bloodSugar || 0) > 140 ? 'Strongly increases risk' : 'Optimal' },
        { feature: 'HbA1c',         value: (cd.hba1c || 5.4) + '%',      effect: (cd.hba1c || 0) > 6.5 ? 'Diagnostic for diabetes' : 'Normal' },
      ],
      parametersTable: [
        { name: "Blood Glucose", value: (cd.bloodSugar || 100) + " mg/dL", normal: "70-100 mg/dL", max: "400 mg/dL" },
        { name: "BMI", value: (cd.bmi || 22.4), normal: "18.5-24.9", max: "50" },
        { name: "Insulin", value: (cd.insulin || 10) + " µU/mL", normal: "2-25 µU/mL", max: "300 µU/mL" },
        { name: "Age", value: (cd.age || 45) + " yrs", normal: "18-60 yrs", max: "90 yrs" },
        { name: "Frequent Urination", value: (cd.symptoms?.includes('frequentUrination') ? 'Present' : 'None'), normal: "None", max: "Present" },
        { name: "Vision Changes", value: (cd.symptoms?.includes('visionChanges') ? 'Present' : 'None'), normal: "None", max: "Present" }
      ],
      rec: predictions.diabetesRisk > 70
        ? 'HbA1c urgently needed. Consider Metformin. Refer endocrinologist. Strict diabetic diet.'
        : predictions.diabetesRisk > 40
        ? 'Monitor fasting glucose weekly. Reduce refined carbs. 30 min exercise daily.'
        : 'Maintain healthy weight. Annual glucose check.',
    },
    kidney: {
      icon:  <Activity size={20} color={getRiskColor(predictions.kidneyRisk)} />,
      label: t.riskKidney,
      score: predictions.kidneyRisk,
      color: getRiskColor(predictions.kidneyRisk),
      rootCause: (cd.eGFR < 60) || (cd.serumCreatinine > 1.2)
        ? `Renal filtration capacity (eGFR: ${cd.eGFR || 95} mL/min, Creatinine: ${cd.serumCreatinine || 0.9} mg/dL) drives renal risk.`
        : 'Glomerular filtration rate (eGFR 95+) and serum creatinine (0.9 mg/dL) demonstrate optimal kidney clearance.',
      shapData: [
        { feature: 'eGFR Clearance',   importance: 0.38 },
        { feature: 'Serum Creatinine', importance: 0.32 },
        { feature: 'UACR Albuminuria', importance: 0.18 },
        { feature: 'Blood Urea',       importance: 0.12 },
      ],
      limeData: [
        { feature: 'eGFR',            value: String(cd.eGFR || 95),            effect: (cd.eGFR || 95) < 60 ? 'Strongly increases risk' : 'Optimal' },
        { feature: 'Serum Creatinine', value: (cd.serumCreatinine || 0.9) + ' mg/dL', effect: (cd.serumCreatinine || 0) > 1.4 ? 'Increases risk' : 'Normal' },
      ],
      parametersTable: [
        { name: "Serum Creatinine", value: (cd.serumCreatinine || 0.9) + " mg/dL", normal: "0.5-1.2 mg/dL", max: "10.0 mg/dL" },
        { name: "eGFR", value: (cd.eGFR || 95) + " mL/min/1.73m²", normal: "90-120", max: "120" },
        { name: "Blood Urea", value: (cd.urea || 20) + " mg/dL", normal: "7-20 mg/dL", max: "200 mg/dL" },
        { name: "Potassium", value: (cd.potassium || 4.2) + " mEq/L", normal: "3.5-5.0 mEq/L", max: "7.0 mEq/L" },
        { name: "Blood Pressure (Systolic)", value: (parseInt((cd.bp || '120/80').split('/')[0]) || 120) + " mmHg", normal: "90-120 mmHg", max: "180 mmHg" },
        { name: "Limb Swelling", value: (cd.symptoms?.includes('swelling') ? 'Present' : 'None'), normal: "None", max: "Present" }
      ],
      rec: predictions.kidneyRisk > 70
        ? 'Urgent nephrology referral. Restrict protein & potassium. Electrolyte monitoring bi-weekly.'
        : predictions.kidneyRisk > 40
        ? 'Low-salt low-protein diet. Control BP and glucose. Monthly creatinine/eGFR.'
        : 'Stay hydrated. Avoid NSAIDs. Annual kidney panel.',
    },
  };

  const active = diseaseDetails[activeTab];

  const DataQualityBanner = () => {
    if (!xai.dataQualityWarning) return null;
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        padding: '12px 16px', marginBottom: '20px',
        background: 'rgba(245,158,11,0.07)',
        border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: '10px', fontSize: '13px', color: 'var(--color-warning)',
      }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
        <div>
          <strong>Incomplete Clinical Data — Risk scores are capped at 40%.</strong><br />
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            {xai.dataQualityWarning} Complete the patient form for full multimodal risk assessment.
          </span>
        </div>
      </div>
    );
  };

  const renderSparkline = (points, color) => {
    if (!points || points.length < 2) return null;
    const w = 150, h = 40, pad = 5;
    const pts = points.map((val, i) => {
      const x = pad + (i / (points.length - 1)) * (w - 2 * pad);
      const y = h - pad - (val / 100) * (h - 2 * pad);
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={w} height={h} style={{ overflow: 'visible' }}>
        <polyline fill="none" stroke={color} strokeWidth="2.5" points={pts} />
        {points.map((val, i) => {
          const x = pad + (i / (points.length - 1)) * (w - 2 * pad);
          const y = h - pad - (val / 100) * (h - 2 * pad);
          return <circle key={i} cx={x} cy={y} r="3.5" fill="#fff" stroke={color} strokeWidth="1.5" />;
        })}
      </svg>
    );
  };

  const getTrendIndicator = (diff) => {
    if (diff < -2) return <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}><TrendingDown size={14} /> {diff}% (Improving)</span>;
    if (diff >  2) return <span style={{ color: 'var(--color-danger)',  display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}><TrendingUp  size={14} /> +{diff}% (Worsening)</span>;
    return <span style={{ color: 'var(--color-warning)', fontSize: '12px' }}>Stable (±2%)</span>;
  };

  const renderLongitudinalPanel = () => {
    const history = longitudinalHistory;
    const heartHistory    = history.map(h => h.heart);
    const diabetesHistory = history.map(h => h.diabetes);
    const kidneyHistory   = history.map(h => h.kidney);
    const diff = (arr) => arr.length > 1 ? arr[arr.length - 1] - arr[0] : 0;

    return (
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <h3 style={{
          fontSize: '16px', fontWeight: '700',
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px',
        }}>
          <TrendingUp size={18} color="var(--accent-secondary)" />
          Longitudinal Risk Trajectory & Trend Analytics
        </h3>

        {longitudinalLoading ? (
          <div style={{ padding: '8px 12px', fontSize: '13px', color: 'var(--text-muted)' }}>
            Loading trend data…
          </div>
        ) : history.length < 2 ? (
          <div style={{ padding: '8px 12px', fontSize: '13px', color: 'var(--text-muted)' }}>
            ℹ️ A longitudinal trend timeline will appear automatically once this patient has two or more diagnostic records saved.{' '}
            <span style={{ color: 'var(--accent-secondary)' }}>
              Current records: {history.length}
            </span>
          </div>
        ) : (
          <div className="grid-3" style={{ gap: '16px' }}>
            {[
              { label: 'Heart Risk Trend',    history: heartHistory,    color: 'var(--color-danger)' },
              { label: 'Diabetes Risk Trend', history: diabetesHistory, color: 'var(--color-warning)' },
              { label: 'Kidney Risk Trend',   history: kidneyHistory,   color: 'var(--accent-secondary)' },
            ].map(({ label, history: h, color }) => (
              <div key={label} style={{
                display: 'flex', flexDirection: 'column', gap: '8px',
                padding: '12px',
                background: 'rgba(255,255,255,0.01)',
                borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>{label}</span>
                  {getTrendIndicator(diff(h))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
                  {renderSparkline(h, color)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>{history[0].date}</span>
                  <span>{history[history.length - 1].date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const crossWarnings = xai.crossDiseaseWarnings || [];
  const audioSummary  = `Results for ${patient.name}. Heart risk: ${predictions.heartRisk}%. Diabetes risk: ${predictions.diabetesRisk}%. Kidney risk: ${predictions.kidneyRisk}%.`;

  return (
    <div className="container" style={{ animation: 'fadeIn 0.5s ease-out' }}>

      {/* 1. Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => onNavigate('dashboard')} className="btn-secondary" style={{ padding: '8px 12px' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '800' }}>{t.results}</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              ID: <b>{patient.patientId}</b> | {(!patient.name || patient.name === 'yfkyuvj' || patient.name.trim() === '') ? 'Anonymous Patient' : patient.name} (Age {patient.age}, {patient.gender})
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ClinicalPdfExporter
            patient={patient}
            predictions={predictions}
            prescription={prescription}
            userRole={userRole}
          />
          <SpeechReader text={audioSummary} lang={lang} />
        </div>
      </div>

      {/* 2. Data quality warning */}
      <DataQualityBanner />

      {/* 3. Separate Dedicated Disease Line Graph Chart */}
      <SeparateDiseaseLineGraph
        diseaseKey={activeTab}
        score={predictions[activeTab === 'heart' ? 'heartRisk' : activeTab === 'diabetes' ? 'diabetesRisk' : 'kidneyRisk']}
        clinicalData={patient?.clinicalData}
      />

      {/* 4. 3 Risk Score Cards with Graphical Representations & Disease Prediction Status */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        {['heart', 'diabetes', 'kidney'].map(d => {
          const dd = diseaseDetails[d];
          const isPredicted = dd.score > 50;
          return (
            <RiskGraphicalCardGauge
              key={d}
              score={dd.score}
              color={dd.color}
              label={dd.label}
              icon={dd.icon}
              isPredicted={isPredicted}
              isActive={activeTab === d}
              onClick={() => setActiveTab(d)}
            />
          );
        })}
      </div>

      {/* 5. 3D Anatomical Organ Health Map */}
      <AnatomicalOrganMap
        predictions={predictions}
        clinicalData={patient?.clinicalData}
        patient={patient}
        t={t}
      />

      {/* 6. Live "What-If" Counterfactual Risk Simulator */}
      <RiskCounterfactualSimulator
        predictions={predictions}
        clinicalData={patient?.clinicalData}
        t={t}
      />

      {/* 7. Longitudinal panel */}
      {renderLongitudinalPanel()}

      {/* 8. ECG AI Doctor Summary */}
      <EcgAiSummary
        patient={patient}
        predictions={predictions}
        userRole={userRole}
      />

      {/* 9. Chronic Kidney Disease (CKD) & Nephron Clearance Summary */}
      <KidneyClinicalSummary
        patient={patient}
        predictions={predictions}
        activeTab={activeTab}
      />

      {/* 10. Cross-disease warnings */}
      {crossWarnings.length > 0 && (
        <div className="glass-panel" style={{ marginBottom: '24px', borderLeft: '4px solid var(--color-warning)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--color-warning)' }}>
            <AlertTriangle size={18} /> Cross-Disease Interconnection Alerts
          </h3>
          {crossWarnings.map((w, i) => (
            <div key={i} style={{
              fontSize: '13px', padding: '8px 12px', marginBottom: '6px',
              background: 'rgba(245,158,11,0.06)', borderRadius: '8px',
              borderLeft: '3px solid var(--color-warning)',
            }}>
              {w}
            </div>
          ))}
        </div>
      )}

      {/* 11. Disease detail + SHAP/LIME + Parameter Table + GradCam */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
            {active.label} — AI Explanation
          </h3>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', borderLeft: `4px solid ${active.color}` }}>
            <h5 style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: active.color }}>Root Cause Analysis</h5>
            <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.6' }}>{active.rootCause}</p>
          </div>
          {/* SHAP */}
          <div>
            <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '600' }}>{t.shapTitle} (Normalized Relative Factors)</h5>
            {active.shapData.map((item, i) => {
              const totalImportance = active.shapData.reduce((acc, curr) => acc + curr.importance, 0) || 1;
              const relPct = Math.round((item.importance / totalImportance) * 100);
              return (
                <div key={i} style={{ fontSize: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span>{item.feature}</span>
                    <span style={{ fontWeight: '600' }}>{relPct}%</span>
                  </div>
                  <div style={{ width: '100%', height: '9px', background: 'rgba(255,255,255,0.06)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${relPct}%`, height: '100%', background: `linear-gradient(90deg,var(--accent-primary),${active.color})`, borderRadius: '5px', transition: 'width 0.8s' }} />
                  </div>
                </div>
              );
            })}
          </div>
          {/* LIME */}
          <div>
            <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: '600' }}>{t.limeTitle}</h5>
            {active.limeData.map((item, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.01)', padding: '7px 12px',
                borderRadius: '6px', fontSize: '12px',
                border: '1px solid rgba(255,255,255,0.04)', marginBottom: '6px',
              }}>
                <span style={{ color: 'var(--text-muted)' }}>{item.feature}: <b style={{ color: 'var(--text-primary)' }}>{item.value}</b></span>
                <span style={{
                  color: item.effect.includes('Strongly') ? 'var(--color-danger)' : item.effect.includes('Increases') ? 'var(--color-warning)' : 'var(--color-success)',
                  fontWeight: '600',
                }}>{item.effect}</span>
              </div>
            ))}
          </div>

          {/* Input Parameters & Ranges Table */}
          <div style={{ marginTop: '16px' }}>
            <h5 style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '600' }}>Input Parameters & Ranges</h5>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.01)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Parameter</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Value</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Normal</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Max Safe</th>
                </tr>
              </thead>
              <tbody>
                {active.parametersTable.map((p, idx) => (
                  <tr key={idx} style={{ borderBottom: idx === active.parametersTable.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>{p.name}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--accent-secondary)', fontWeight: '600' }}>{p.value}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--color-success)' }}>{p.normal}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--color-danger)' }}>{p.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          {(patient.ecgAttached || patient.fundusAttached) && (
            <div className="glass-panel" style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Eye size={14} /> Diagnostic Input:
              </span>
              {patient.ecgAttached    && <button type="button" onClick={() => setGradCamMode('ecg')}    className={gradCamMode === 'ecg'    ? 'btn-primary' : 'btn-secondary'} style={{ padding: '6px 12px', fontSize: '11px' }}>12-Lead ECG</button>}
              {patient.fundusAttached && <button type="button" onClick={() => setGradCamMode('fundus')} className={gradCamMode === 'fundus' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '6px 12px', fontSize: '11px' }}>Retinal Fundus</button>}
            </div>
          )}
          <GradCamViewer heatmapPoints={xai.gradCamCoordinates?.heatmapPoints} mode={gradCamMode} imageSrc={imageSrc} />
          <div className="glass-panel" style={{ marginTop: '20px', borderLeft: `4px solid ${active.color}` }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {active.icon} {t.recommendations}
            </h3>
            <p style={{ fontSize: '13px', lineHeight: '1.7', color: 'var(--text-primary)' }}>{active.rec}</p>
          </div>

          {/* Restored Doctor Prescription Review & Editable Textarea Box */}
          <div style={{ marginTop: '20px' }}>
            <PrescriptionCard
              patientId={patient.patientId}
              prescription={prescription}
              setPrescription={setPrescription}
              clinicalData={patient.clinicalData}
              loading={savingPrescription}
              onSave={handleSavePrescription}
              userRole={userRole}
            />
          </div>
        </div>
      </div>

      {/* 12. AI Prescription Preview */}
      {userRole === 'doctor' && (
        <div className="glass-panel" style={{ marginBottom: '24px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={18} color="var(--accent-secondary)" />
              AI Prescription Preview — {diseaseDetails[activeTab].label}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '8px 14px', fontSize: '12px' }}
                onClick={handleUseAIPrescription}
                disabled={!prescriptionsMap[activeTab] || prescriptionLoading}
              >
                ✨ Use AI Prescription
              </button>
            </div>
          </div>
          {prescriptionLoading ? (
            <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
              Generating AI prescription based on {patient.name}'s clinical risk factors…
            </div>
          ) : (
            <div style={{
              whiteSpace: 'pre-wrap', minHeight: '120px', padding: '18px',
              background: 'rgba(255,255,255,0.04)', borderRadius: '16px',
              color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.75',
            }}>
              {prescriptionsMap[activeTab] || 'No AI prescription available. Please connect to the backend server for AI-generated care plans.'}
            </div>
          )}
        </div>
      )}

      {/* 13. Doctor Nurse Task Command */}
      {userRole === 'doctor' && (
        <div className="glass-panel" style={{ marginBottom: '24px', padding: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginBottom: '16px' }}>
            👨‍⚕️ Assign Clinical Task to Registered Nurse
          </h3>
          <form onSubmit={handleAssignTask} style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>Select Nurse</label>
              <select
                value={selectedNurse}
                onChange={(e) => setSelectedNurse(e.target.value)}
                className="input-field"
                style={{ width: '100%', marginTop: '4px' }}
              >
                {doctorNurses.map(n => (
                  <option key={n} value={n} style={{ background: '#080d1a', color: '#fff' }}>{n.toUpperCase()} - Clinical Nurse</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>Task Instruction</label>
              <input
                type="text"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="e.g. Administer 10mg Lisinopril IV and check BP in 2 hours"
                className="input-field"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={assigningTask}>
              {assigningTask ? 'Assigning...' : 'Submit Task to Nurse'}
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
