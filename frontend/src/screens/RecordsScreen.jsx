/**
 * AURA-Health AI — RecordsScreen.jsx  (PATCHED)
 * ─────────────────────────────────────────────────────────────────────────────
 * NEW FEATURE: "New Diagnostic" action column for existing patients.
 *
 * Doctors can now click "New Diagnostic" on any patient row to open an inline
 * modal/panel that lets them update vitals and run a fresh analysis WITHOUT
 * navigating to the New Patient screen. The patient's ID, name, age and gender
 * are pre-filled and immutable — only the clinical readings are refreshed.
 *
 * Flow:
 *   1. Doctor clicks "New Diagnostic" on a row.
 *   2. A slide-in panel appears with the patient's demographics locked at the
 *      top and an abbreviated vitals form below.
 *   3. On submit, the same analysis pipeline as NewPatientScreen runs:
 *      backend API → offline fallback → saves new prediction row → context.
 *   4. Patient is navigated to ResultsScreen with fresh data.
 */

import React, { useState, useEffect } from 'react';
import {
  Search, Database, ArrowLeft, Eye, ShieldOff, AlertCircle,
  RefreshCcw, Activity, X, Zap
} from 'lucide-react';
import API_BASE from '../config/api';
import { db, checkOnlineStatus, generateOfflinePredictions } from '../db/localDb';

const SYMPTOM_LIST = [
  { key: 'chestPain',         label: 'Chest Pain' },
  { key: 'fatigue',           label: 'Fatigue' },
  { key: 'frequentUrination', label: 'Frequent Urination' },
  { key: 'swelling',          label: 'Limb Swelling' },
  { key: 'visionChanges',     label: 'Vision Changes' },
  { key: 'breathlessness',    label: 'Breathlessness' },
];

export default function RecordsScreen({ onNavigate, onSetCurrentResult, t, userRole, user }) {
  const [searchTerm, setSearchTerm]   = useState('');
  const [records, setRecords]         = useState([]);
  const [loading, setLoading]         = useState(true);

  // Nurse tasks state
  const [nurseTasks, setNurseTasks] = useState([]);
  const [allTasksMap, setAllTasksMap] = useState({});
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [selectedVitalsPatient, setSelectedVitalsPatient] = useState(null);

  // ── New Diagnostic panel state ─────────────────────────────────────────────
  const [activeDiagPatient, setActiveDiagPatient] = useState(null); // patient row being re-diagnosed
  const [diagLoading, setDiagLoading]             = useState(false);

  // Vitals form (all start from patient's last recorded values)
  const [bp, setBp]                       = useState('120/80');
  const [bloodSugar, setBloodSugar]       = useState('95');
  const [cholesterol, setCholesterol]     = useState('180');
  const [serumCreatinine, setCreatinine]  = useState('0.9');
  const [eGFR, setEgfr]                   = useState('95');
  const [bmi, setBmi]                     = useState('22.4');
  const [insulin, setInsulin]             = useState('12');
  const [urea, setUrea]                   = useState('20');
  const [potassium, setPotassium]         = useState('4.2');
  const [hba1c, setHba1c]                 = useState('');
  const [uacr, setUacr]                   = useState('');
  const [symptoms, setSymptoms]           = useState({
    chestPain: false, fatigue: false, frequentUrination: false,
    swelling: false, visionChanges: false, breathlessness: false,
  });

  const isNurse  = userRole === 'nurse';
  const isDoctor = userRole === 'doctor';

  // ── Fetch all patient records ──────────────────────────────────────────────
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const all = await db.patients.toArray();
      // Doctor segregation: doc_1 sees doc_1 (or unassigned), doc_2 sees doc_2
      const filteredForDoctor = isDoctor && user?.id ? all.filter(p => {
        if (!p.doctorId) return user.id === 'doc_1';
        return p.doctorId === user.id;
      }) : all;

      const recordsWithPred = await Promise.all(filteredForDoctor.map(async p => {
        const preds = await db.predictions.where('patientId').equals(p.patientId).toArray();
        preds.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
        return { ...p, latestPrediction: preds[0] || null };
      }));
      setRecords(recordsWithPred);

      // Fetch all tasks map for status column badges
      try {
        const tRes = await fetch(`${API_BASE}/api/getAllTasks`);
        const tData = await tRes.json();
        if (tData.success && tData.tasks) {
          const map = {};
          tData.tasks.forEach(task => {
            map[task.patientId] = task.status;
          });
          setAllTasksMap(map);
        }
      } catch (err) {
        console.warn("Could not fetch tasks map", err);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchNurseTasks = async () => {
    if (userRole !== 'nurse' || !user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/getNurseTasks?nurseId=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setNurseTasks(data.tasks);
      }
    } catch (e) {
      console.warn("Failed to fetch nurse tasks", e);
    }
  };

  const handleUpdateTaskStatus = async (taskId, status) => {
    setUpdatingTaskId(taskId);
    try {
      const res = await fetch(`${API_BASE}/api/updateTask`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nurseId: user.id,
          taskId,
          status
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchNurseTasks();
        fetchRecords();
      } else {
        alert("Failed to update task: " + data.error);
      }
    } catch (err) {
      alert("Error updating task: " + err.message);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  useEffect(() => {
    fetchRecords();
    if (isNurse) {
      fetchNurseTasks();
    }
  }, [userRole, user?.id]);

  // ── Open the re-diagnostic panel, pre-fill from last clinical data ─────────
  const openDiagPanel = (patient) => {
    const cd = patient.clinicalData || {};
    setBp(cd.bp               || '120/80');
    setBloodSugar(String(cd.bloodSugar    || '95'));
    setCholesterol(String(cd.cholesterol  || '180'));
    setCreatinine(String(cd.serumCreatinine || '0.9'));
    setEgfr(String(cd.eGFR               || '95'));
    setBmi(String(cd.bmi                  || '22.4'));
    setInsulin(String(cd.insulin          || '12'));
    setUrea(String(cd.urea                || '20'));
    setPotassium(String(cd.potassium      || '4.2'));
    setHba1c(String(cd.hba1c              || ''));
    setUacr(String(cd.uacr                || ''));

    const prevSymptoms = {};
    SYMPTOM_LIST.forEach(s => { prevSymptoms[s.key] = (cd.symptoms || []).includes(s.key); });
    setSymptoms(prevSymptoms);

    setActiveDiagPatient(patient);
  };

  const closeDiagPanel = () => {
    setActiveDiagPatient(null);
    setDiagLoading(false);
  };

  const toggleSymptom = k => setSymptoms(p => ({ ...p, [k]: !p[k] }));

  // ── Run fresh analysis for existing patient ────────────────────────────────
  const handleRunDiagnostic = async () => {
    const patient = activeDiagPatient;
    if (!patient) return;

    setDiagLoading(true);
    const isOnline   = await checkOnlineStatus();
    const activeSyms = Object.keys(symptoms).filter(k => symptoms[k]);

    const clinicalData = {
      age:             patient.age,
      gender:          patient.gender,
      bp,
      bloodSugar:      parseFloat(bloodSugar),
      cholesterol:     parseFloat(cholesterol),
      serumCreatinine: parseFloat(serumCreatinine),
      eGFR:            parseFloat(eGFR),
      bmi:             parseFloat(bmi),
      insulin:         parseFloat(insulin),
      urea:            parseFloat(urea),
      potassium:       parseFloat(potassium),
      hba1c:           parseFloat(hba1c),
      uacr:            parseFloat(uacr),
      symptoms:        activeSyms,
    };

    let heartRisk, diabetesRisk, kidneyRisk, xaiResult;

    if (isOnline) {
      try {
        const [hRes, dRes, kRes] = await Promise.all([
          fetch(`${API_BASE}/api/predictHeart`,    { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...clinicalData, patientId: patient.patientId}) }),
          fetch(`${API_BASE}/api/predictDiabetes`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...clinicalData, patientId: patient.patientId}) }),
          fetch(`${API_BASE}/api/predictKidney`,   { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...clinicalData, patientId: patient.patientId}) }),
        ]);
        const [hD, dD, kD] = await Promise.all([hRes.json(), dRes.json(), kRes.json()]);
        heartRisk    = hD.riskScore;
        diabetesRisk = dD.riskScore;
        kidneyRisk   = kD.riskScore;

        const maxRisk = Math.max(heartRisk, diabetesRisk, kidneyRisk);
        const disease = maxRisk === heartRisk ? 'Cardiovascular Disease' : maxRisk === diabetesRisk ? 'Diabetes Mellitus' : 'Chronic Kidney Disease';
        const xRes = await fetch(`${API_BASE}/api/getExplanation`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ disease, riskScore: maxRisk, clinicalData }),
        });
        xaiResult = await xRes.json();
      } catch {
        const off = generateOfflinePredictions(clinicalData);
        heartRisk = off.heartRisk; diabetesRisk = off.diabetesRisk;
        kidneyRisk = off.kidneyRisk; xaiResult = off.xai;
      }
    } else {
      const off = generateOfflinePredictions(clinicalData);
      heartRisk = off.heartRisk; diabetesRisk = off.diabetesRisk;
      kidneyRisk = off.kidneyRisk; xaiResult = off.xai;
    }

    // Update patient record with new clinical data (preserving patientId / demographics)
    const updatedPatient = { ...patient, clinicalData, synced: isOnline ? 1 : 0 };
    await db.patients.update(patient.id, updatedPatient);

    // ── Fetch 12-lead ECG signal metrics from Python ECG backend (if image available) ──
    let leadsData = {}, miAnalysis = null, globalMetrics = null;
    const ecgB64raw = patient.ecgImage || '';
    const ecgB64 = ecgB64raw.startsWith('data:') ? ecgB64raw.split(',')[1] : ecgB64raw;
    if (ecgB64 && isOnline) {
      try {
        const ecgRes = await fetch(`${API_BASE}/analyze-ecg-advanced`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: ecgB64 }),
        });
        const ecgJson = await ecgRes.json();
        if (ecgJson.success) {
          leadsData     = ecgJson.leads || {};
          miAnalysis    = ecgJson.mi_analysis || null;
          globalMetrics = { bpm: ecgJson.bpm, hrv: ecgJson.hrv, qrs_ms: ecgJson.qrs_ms, noise_level: ecgJson.noise_level, checks: ecgJson.checks || [] };
        }
      } catch (e) {
        console.warn('[RecordsScreen] ECG signal backend unreachable:', e.message);
      }
    }

    // Save new prediction row (longitudinal history grows automatically)
    const predRecord = {
      patientId:          patient.patientId,
      heartRisk, diabetesRisk, kidneyRisk,
      primaryExplanation: xaiResult,
      leadsData, miAnalysis, globalMetrics,
      createdTime:        new Date().toISOString(),
      synced:             isOnline ? 1 : 0,
    };
    await db.predictions.add(predRecord);

    setDiagLoading(false);
    closeDiagPanel();

    // Push to context → navigate to results
    await onSetCurrentResult({ patient: updatedPatient, predictions: predRecord });
  };

  // ── View existing results ──────────────────────────────────────────────────
  const handleViewRecord = async (patient) => {
    if (isNurse) return;
    const prediction = await db.predictions
      .where('patientId').equals(patient.patientId)
      .toArray()
      .then(rows => rows.sort((a,b) => new Date(b.createdTime) - new Date(a.createdTime))[0]);

    const pred = prediction || {
      patientId: patient.patientId,
      heartRisk: 25, diabetesRisk: 30, kidneyRisk: 20,
      primaryExplanation: { rootCause: 'No prior analysis.', crossDiseaseWarnings: [], gradCamCoordinates: { heatmapPoints: [] } },
    };
    await onSetCurrentResult({ patient, predictions: pred });
  };

  const getRiskTag = (score) => {
    if (!score && score !== 0) return <span style={{ color:'var(--text-muted)', fontSize:'11px' }}>—</span>;
    if (score > 70) return <span className="badge badge-danger">High</span>;
    if (score > 40) return <span className="badge badge-warning">Medium</span>;
    return <span className="badge badge-success">Low</span>;
  };

  const filtered = records.filter(r => {
    const t = searchTerm.toLowerCase();
    return r.name?.toLowerCase().includes(t) || r.patientId?.toLowerCase().includes(t) || r.gender?.toLowerCase().includes(t);
  });

  // ── Inline re-diagnostic panel ────────────────────────────────────────────
  const DiagnosticPanel = () => {
    if (!activeDiagPatient) return null;
    const p = activeDiagPatient;

    return (
      <div style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
        display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000,
      }}>
        <div className="glass-panel" style={{
          width:'min(680px, 96vw)', maxHeight:'90vh', overflowY:'auto',
          padding:'28px', position:'relative',
        }}>
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
            <div>
              <span className="badge badge-success" style={{ marginBottom:'6px' }}>Re-Diagnostic — Existing Patient</span>
              <h2 style={{ fontSize:'20px', fontWeight:'800' }}>{p.name}</h2>
              <p style={{ fontSize:'12px', color:'var(--text-secondary)', marginTop:'4px' }}>
                ID: <b style={{ color:'var(--accent-secondary)' }}>{p.patientId}</b> &nbsp;|&nbsp;
                Age: {p.age} &nbsp;|&nbsp; {p.gender}
              </p>
            </div>
            <button onClick={closeDiagPanel} className="btn-secondary" style={{ padding:'6px 10px' }}>
              <X size={16}/>
            </button>
          </div>

          <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'18px', padding:'10px 14px',
            background:'rgba(99,102,241,0.06)', borderRadius:'8px', borderLeft:'3px solid var(--accent-secondary)' }}>
            Patient demographics are locked. Update the clinical readings below and run a new analysis.
            This will add a new entry to the patient's longitudinal history.
          </div>

          {/* Vitals grid */}
          <div className="grid-2" style={{ gap:'14px', marginBottom:'16px' }}>
            {[
              { label:'Blood Pressure', val:bp,            set:setBp,          type:'text',   placeholder:'120/80' },
              { label:'Blood Sugar (mg/dL)', val:bloodSugar, set:setBloodSugar, type:'number', placeholder:'95' },
              { label:'Cholesterol (mg/dL)', val:cholesterol, set:setCholesterol, type:'number', placeholder:'180' },
              { label:'Serum Creatinine', val:serumCreatinine, set:setCreatinine, type:'number', placeholder:'0.9', step:'0.1' },
              { label:'eGFR', val:eGFR, set:setEgfr, type:'number', placeholder:'95' },
              { label:'BMI', val:bmi, set:setBmi, type:'number', placeholder:'22.4', step:'0.1' },
              { label:'Insulin (µU/mL)', val:insulin, set:setInsulin, type:'number', placeholder:'12' },
              { label:'Blood Urea (mg/dL)', val:urea, set:setUrea, type:'number', placeholder:'20' },
              { label:'Potassium (mEq/L)', val:potassium, set:setPotassium, type:'number', placeholder:'4.2', step:'0.1' },
              { label:'HbA1c (%)', val:hba1c, set:setHba1c, type:'number', placeholder:'5.4', step:'0.1' },
              { label:'UACR (mg/g)', val:uacr, set:setUacr, type:'number', placeholder:'5' },
            ].map(({ label, val, set, type, placeholder, step }) => (
              <div key={label} className="form-group">
                <label className="form-label" style={{ fontSize:'11px' }}>{label}</label>
                <input
                  type={type}
                  step={step}
                  className="input-field"
                  style={{ fontSize:'13px', padding:'8px 12px' }}
                  value={val}
                  placeholder={placeholder}
                  onChange={e => set(e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Symptoms */}
          <div className="glass-panel" style={{ marginBottom:'18px', padding:'14px' }}>
            <p style={{ fontSize:'12px', fontWeight:'700', marginBottom:'12px', color:'var(--text-secondary)' }}>Symptoms (update if changed)</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
              {SYMPTOM_LIST.map(s => (
                <label key={s.key} style={{ display:'flex', alignItems:'center', gap:'7px', fontSize:'12px', cursor:'pointer' }}>
                  <input type="checkbox" checked={symptoms[s.key]} onChange={() => toggleSymptom(s.key)}
                    style={{ accentColor:'var(--accent-secondary)', width:'14px', height:'14px' }}/>
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div style={{ display:'flex', justifyContent:'flex-end', gap:'12px', marginTop:'16px' }}>
            <button onClick={closeDiagPanel} className="btn-secondary">Cancel</button>
            <button
              onClick={handleRunDiagnostic}
              disabled={diagLoading}
              className="btn-primary"
              style={{ minWidth:'200px', justifyContent:'center' }}
            >
              {diagLoading
                ? <><RefreshCcw size={15} className="glowing-text"/> Running AI Analysis…</>
                : <><Zap size={15}/> Run New Diagnostic</>
              }
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Vitals Modal for Nurse
  const VitalsModal = () => {
    if (!selectedVitalsPatient) return null;
    const p = selectedVitalsPatient;
    const cd = p.clinicalData || {};
    return (
      <div style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
        display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000,
      }}>
        <div className="glass-panel" style={{ width:'min(480px, 90vw)', padding:'24px', borderTop: '4px solid var(--accent-secondary)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
            <h3 style={{ fontSize:'18px', fontWeight:'800' }}>Vitals & Lab Readings</h3>
            <button onClick={() => setSelectedVitalsPatient(null)} className="btn-secondary" style={{ padding:'4px 8px' }}>X</button>
          </div>
          <div style={{ fontSize:'13px', color:'var(--text-secondary)' }}>
            <p><strong>Patient Name:</strong> {p.name}</p>
            <p><strong>Age / Gender:</strong> {p.age}y / {p.gender}</p>
            <hr style={{ margin:'12px 0', borderColor:'var(--glass-border)' }} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div><strong>Blood Pressure:</strong> {cd.bp || '—'}</div>
              <div><strong>Blood Sugar:</strong> {cd.bloodSugar ? cd.bloodSugar + ' mg/dL' : '—'}</div>
              <div><strong>Cholesterol:</strong> {cd.cholesterol ? cd.cholesterol + ' mg/dL' : '—'}</div>
              <div><strong>LDL:</strong> {cd.ldl ? cd.ldl + ' mg/dL' : '—'}</div>
              <div><strong>HbA1c:</strong> {cd.hba1c ? cd.hba1c + '%' : '—'}</div>
              <div><strong>Serum Creatinine:</strong> {cd.serumCreatinine ? cd.serumCreatinine + ' mg/dL' : '—'}</div>
              <div><strong>eGFR:</strong> {cd.eGFR || '—'}</div>
              <div><strong>BMI:</strong> {cd.bmi || '—'}</div>
              <div><strong>Urea:</strong> {cd.urea ? cd.urea + ' mg/dL' : '—'}</div>
              <div><strong>Potassium:</strong> {cd.potassium ? cd.potassium + ' mEq/L' : '—'}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const highRiskPatients = filtered.filter(p => {
    const pred = p.latestPrediction;
    return pred && (pred.heartRisk >= 70 || pred.diabetesRisk >= 70 || pred.kidneyRisk >= 70);
  });

  const lowRiskPatients = filtered.filter(p => {
    const pred = p.latestPrediction;
    return !pred || !(pred.heartRisk >= 70 || pred.diabetesRisk >= 70 || pred.kidneyRisk >= 70);
  });

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="container" style={{ animation:'fadeIn 0.5s ease-out' }}>

      <DiagnosticPanel/>
      <VitalsModal/>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'16px', marginBottom:'16px' }}>
        <button onClick={() => onNavigate('dashboard')} className="btn-secondary" style={{ padding:'8px 12px' }}>
          <ArrowLeft size={16}/>
        </button>
        <h2 style={{ fontSize:'24px', fontWeight:'800' }}>{t.records} Logbook</h2>
        {isNurse && (
          <span style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'11px', color:'var(--color-warning)', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:'6px', padding:'4px 10px' }}>
            <ShieldOff size={12}/> Nurse View — Linked Tasks
          </span>
        )}
      </div>

      {isNurse && (
        <div style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.18)', borderRadius:'10px', padding:'12px 18px', marginBottom:'18px', fontSize:'13px', color:'var(--color-warning)', display:'flex', alignItems:'center', gap:'10px' }}>
          <AlertCircle size={16}/>
          <span>You are logged in as <b>{user?.username} ({user?.id})</b>. You can view basic patient vitals and manage assigned care tasks.</span>
        </div>
      )}

      {/* Nurse Tasks Queue */}
      {isNurse && nurseTasks.length > 0 && (
        <div className="glass-panel" style={{ marginBottom: '24px', padding: '20px', borderLeft: '4px solid var(--accent-secondary)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="var(--accent-secondary)" />
            Assigned Care & Dosage Tasks
          </h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {nurseTasks.map(t => {
              const ptName = records.find(r => r.patientId === t.patientId)?.name || t.patientId;
              return (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>Patient: {ptName}</div>
                    <div style={{ fontSize: '13px', marginTop: '4px' }}>{t.description}</div>
                    {t.dosage && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Dosage: {t.dosage}</div>}
                  </div>
                  <div>
                    {t.status === 'done' ? (
                      <span className="badge badge-success">Completed</span>
                    ) : (
                      <button
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        disabled={updatingTaskId === t.id}
                        onClick={() => handleUpdateTaskStatus(t.id, 'done')}
                      >
                        {updatingTaskId === t.id ? 'Updating...' : 'Mark as Done'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="glass-panel" style={{ marginBottom:'24px', padding:'16px' }}>
        <div style={{ position:'relative' }}>
          <Search size={18} style={{ position:'absolute', left:'16px', top:'14px', color:'var(--text-muted)' }}/>
          <input type="text" className="input-field" style={{ paddingLeft:'44px' }}
            placeholder={t.search || 'Search name or ID…'}
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding:'40px', textAlign:'center', color:'var(--text-secondary)' }}>Loading records…</div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ padding:'40px', textAlign:'center', color:'var(--text-secondary)' }}>
          <Database size={32} style={{ marginBottom:'12px', opacity:0.5 }}/>
          <div>No matching records found.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* High Risk Standalone Block */}
          <div className="glass-panel" style={{ padding:'0px', overflowX:'auto', borderTop: '4px solid var(--color-danger)' }}>
            <div style={{ padding: '18px 24px', fontWeight: '800', fontSize: '18px', color: 'var(--color-danger)', borderBottom: '1px solid var(--glass-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>🚨 High-Risk Cases (Score ≥ 70%)</span>
              <span className="badge badge-danger" style={{ fontSize:'12px' }}>{highRiskPatients.length} Patients</span>
            </div>
            {highRiskPatients.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No high risk cases found.</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--glass-border)', background:'rgba(239, 68, 68, 0.03)' }}>
                    <th style={{ padding:'12px 16px', textAlign:'left', color:'var(--text-muted)', fontWeight:'600', fontSize:'11px', textTransform:'uppercase' }}>{isNurse ? 'Patient' : 'ID'}</th>
                    <th style={{ padding:'12px 16px', textAlign:'left', color:'var(--text-muted)', fontWeight:'600', fontSize:'11px', textTransform:'uppercase' }}>Name</th>
                    <th style={{ padding:'12px 16px', textAlign:'center', color:'var(--text-muted)', fontWeight:'600', fontSize:'11px', textTransform:'uppercase' }}>Risks</th>
                    <th style={{ padding:'12px 16px', textAlign:'center', color:'var(--text-muted)', fontWeight:'600', fontSize:'11px', textTransform:'uppercase' }}>Care Status</th>
                    <th style={{ padding:'12px 16px', textAlign:'center', color:'var(--text-muted)', fontWeight:'600', fontSize:'11px', textTransform:'uppercase' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {highRiskPatients.map((rec, i) => (
                    <RecordRow
                      key={rec.id || i}
                      rec={rec}
                      pred={rec.latestPrediction}
                      taskStatus={allTasksMap[rec.patientId]}
                      isNurse={isNurse}
                      isDoctor={isDoctor}
                      getRiskTag={getRiskTag}
                      onView={() => handleViewRecord(rec)}
                      onNewDiag={() => openDiagPanel(rec)}
                      onViewVitals={() => setSelectedVitalsPatient(rec)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Low/Medium Risk Standalone Block */}
          <div className="glass-panel" style={{ padding:'0px', overflowX:'auto', borderTop: '4px solid var(--color-success)' }}>
            <div style={{ padding: '18px 24px', fontWeight: '800', fontSize: '18px', color: 'var(--color-success)', borderBottom: '1px solid var(--glass-border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>🟢 Low / Medium-Risk Cases (Score &lt; 70%)</span>
              <span className="badge badge-success" style={{ fontSize:'12px' }}>{lowRiskPatients.length} Patients</span>
            </div>
            {lowRiskPatients.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No low/medium risk cases found.</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--glass-border)', background:'rgba(16, 185, 129, 0.03)' }}>
                    <th style={{ padding:'12px 16px', textAlign:'left', color:'var(--text-muted)', fontWeight:'600', fontSize:'11px', textTransform:'uppercase' }}>{isNurse ? 'Patient' : 'ID'}</th>
                    <th style={{ padding:'12px 16px', textAlign:'left', color:'var(--text-muted)', fontWeight:'600', fontSize:'11px', textTransform:'uppercase' }}>Name</th>
                    <th style={{ padding:'12px 16px', textAlign:'center', color:'var(--text-muted)', fontWeight:'600', fontSize:'11px', textTransform:'uppercase' }}>Risks</th>
                    <th style={{ padding:'12px 16px', textAlign:'center', color:'var(--text-muted)', fontWeight:'600', fontSize:'11px', textTransform:'uppercase' }}>Care Status</th>
                    <th style={{ padding:'12px 16px', textAlign:'center', color:'var(--text-muted)', fontWeight:'600', fontSize:'11px', textTransform:'uppercase' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lowRiskPatients.map((rec, i) => (
                    <RecordRow
                      key={rec.id || i}
                      rec={rec}
                      pred={rec.latestPrediction}
                      taskStatus={allTasksMap[rec.patientId]}
                      isNurse={isNurse}
                      isDoctor={isDoctor}
                      getRiskTag={getRiskTag}
                      onView={() => handleViewRecord(rec)}
                      onNewDiag={() => openDiagPanel(rec)}
                      onViewVitals={() => setSelectedVitalsPatient(rec)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────
function RecordRow({ rec, pred, taskStatus, isNurse, isDoctor, getRiskTag, onView, onNewDiag, onViewVitals }) {
  const lastSeen = pred?.createdTime
    ? new Date(pred.createdTime).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'2-digit' })
    : '—';

  return (
    <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', transition:'background 0.15s' }}
      onMouseEnter={e => { if (isDoctor) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>

      <td style={{ padding:'12px 16px' }}>
        {isNurse
          ? <span style={{ fontFamily:'monospace', fontSize:'11px', color:'var(--text-muted)' }}>••••••••</span>
          : <div>
              <span style={{ fontFamily:'monospace', color:'var(--accent-secondary)', fontWeight:'600', fontSize:'12px' }}>{rec.patientId}</span>
              <div style={{ fontSize:'10px', color:'var(--text-muted)', marginTop:'2px' }}>Last: {lastSeen}</div>
            </div>
        }
      </td>
      <td style={{ padding:'12px 16px', fontWeight:'500' }}>{rec.name}</td>
      <td style={{ padding:'12px 16px', textAlign:'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
          <div style={{ fontSize: '11px' }}>H: {getRiskTag(pred?.heartRisk)} ({pred?.heartRisk || 0}%)</div>
          <div style={{ fontSize: '11px' }}>D: {getRiskTag(pred?.diabetesRisk)} ({pred?.diabetesRisk || 0}%)</div>
          <div style={{ fontSize: '11px' }}>K: {getRiskTag(pred?.kidneyRisk)} ({pred?.kidneyRisk || 0}%)</div>
        </div>
      </td>

      {/* Care Task Status Column */}
      <td style={{ padding:'12px 16px', textAlign:'center' }}>
        {taskStatus === 'done' ? (
          <span className="badge badge-success" style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'4px 8px', fontSize:'11px' }}>
            ✓ Task Completed
          </span>
        ) : taskStatus === 'pending' ? (
          <span className="badge badge-warning" style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'4px 8px', fontSize:'11px' }}>
            ⏳ Task Pending
          </span>
        ) : (
          <span style={{ color:'var(--text-muted)', fontSize:'12px' }}>—</span>
        )}
      </td>

      <td style={{ padding:'12px 16px' }}>
        <div style={{ display:'flex', gap:'6px', justifyContent:'center' }}>
          {isDoctor && (
            <>
              {/* View last results */}
              <button
                className="btn-secondary"
                style={{ padding:'5px 10px', fontSize:'11px', display:'inline-flex', alignItems:'center', gap:'4px' }}
                onClick={onView}
              >
                <Eye size={12}/> View
              </button>

              {/* ── Run fresh diagnostic ── */}
              <button
                className="btn-primary"
                style={{ padding:'5px 10px', fontSize:'11px', display:'inline-flex', alignItems:'center', gap:'4px' }}
                onClick={e => { e.stopPropagation(); onNewDiag(); }}
              >
                <Zap size={12}/> New Diag
              </button>
            </>
          )}

          {isNurse && (
            <button
              className="btn-secondary"
              style={{ padding:'5px 10px', fontSize:'11px', display:'inline-flex', alignItems:'center', gap:'4px' }}
              onClick={onViewVitals}
            >
              <Eye size={12}/> Vitals
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
