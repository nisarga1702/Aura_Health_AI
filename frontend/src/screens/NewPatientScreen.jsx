import React, { useState } from 'react';
import { FileUp, RefreshCcw, Activity, ArrowLeft } from 'lucide-react';
import API_BASE from '../config/api';
import { db, generatePatientId, checkOnlineStatus, generateOfflinePredictions, checkDuplicatePatient } from '../db/localDb';

export default function NewPatientScreen({ onNavigate, onSetCurrentResult, t, userRole, user }) {
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [duplicatePatient, setDuplicatePatient] = useState(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [useExistingId, setUseExistingId] = useState(false);

  // Demographics
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');

  // Clinical parameters
  const [bp, setBp] = useState('120/80');
  const [bloodSugar, setBloodSugar] = useState('95');
  const [cholesterol, setCholesterol] = useState('180');
  const [ldl, setLdl] = useState(''); // new biomarker
  const [hba1c, setHba1c] = useState(''); // new biomarker
  const [uacr, setUacr] = useState(''); // new biomarker
  const [serumCreatinine, setSerumCreatinine] = useState('0.9');
  const [eGFR, setEgfr] = useState('95');
  const [bmi, setBmi] = useState('22.4');
  const [insulin, setInsulin] = useState('12');
  const [urea, setUrea] = useState('20');
  const [potassium, setPotassium] = useState('4.2');
  const [sodium, setSodium] = useState('138');

  // Uploads
  const [ecgPreview, setEcgPreview] = useState('');
  const [fundusPreview, setFundusPreview] = useState('');
  const [labFile, setLabFile] = useState(null);

  // Symptoms
  const [symptoms, setSymptoms] = useState({
    chestPain: false, fatigue: false, frequentUrination: false,
    swelling: false, visionChanges: false, breathlessness: false
  });
  const toggleSymptom = (k) => setSymptoms(p => ({ ...p, [k]: !p[k] }));

  const handleEcgUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setEcgPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleFundusUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setFundusPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleLabUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setLabFile(file); setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append('labReportFile', file);
      const res = await fetch(`${API_BASE}/api/uploadLabReport`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.extractedValues) {
        const v = data.extractedValues;
        if (v.bloodSugar !== undefined) setBloodSugar(String(v.bloodSugar));
        if (v.cholesterol !== undefined) setCholesterol(String(v.cholesterol));
        if (v.serumCreatinine !== undefined) setSerumCreatinine(String(v.serumCreatinine));
        if (v.eGFR !== undefined) setEgfr(String(v.eGFR));
        if (v.urea !== undefined) setUrea(String(v.urea));
        if (v.potassium !== undefined) setPotassium(String(v.potassium));
        if (v.sodium !== undefined) setSodium(String(v.sodium));
        if (v.ldl !== undefined) setLdl(String(v.ldl));
        if (v.hba1c !== undefined) setHba1c(String(v.hba1c));
        if (v.uacr !== undefined) setUacr(String(v.uacr));
      } else {
        alert(data.error || 'Failed to extract values from lab report.');
      }
    } catch (err) {
      console.error('Lab OCR request failed:', err);
      alert('Error connecting to OCR engine. Using fallback values.');
      setBloodSugar('165'); setCholesterol('245');
      setSerumCreatinine('1.75'); setEgfr('52'); setUrea('42');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!name || !age) { alert('Please enter patient name and age.'); return; }
    
    if (!useExistingId) {
      // Check for duplicate patient on first attempt
      const existing = await checkDuplicatePatient(name, age);
      if (existing) {
        setDuplicatePatient(existing);
        setShowDuplicateDialog(true);
        return;
      }
    }
    
    proceedWithAnalysis();
  };

  const proceedWithAnalysis = async () => {
    setLoading(true);
    setShowDuplicateDialog(false);

    const patientId = useExistingId && duplicatePatient ? duplicatePatient.patientId : generatePatientId();
    const isOnline = await checkOnlineStatus();
    const activeSymptoms = Object.keys(symptoms).filter(k => symptoms[k]);

    const clinicalData = {
      age: parseInt(age), gender, bp,
      bloodSugar: parseFloat(bloodSugar),
      cholesterol: parseFloat(cholesterol),
      ldl: parseFloat(ldl),
      hba1c: parseFloat(hba1c),
      uacr: parseFloat(uacr),
      serumCreatinine: parseFloat(serumCreatinine),
      eGFR: parseFloat(eGFR),
      bmi: parseFloat(bmi), insulin: parseFloat(insulin),
      urea: parseFloat(urea), potassium: parseFloat(potassium),
      sodium: parseFloat(sodium), symptoms: activeSymptoms
    };

    let heartRisk, diabetesRisk, kidneyRisk, xaiResult;

    if (isOnline) {
      try {
        const [hRes, dRes, kRes] = await Promise.all([
          fetch(`${API_BASE}/api/predictHeart`,    { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...clinicalData,patientId}) }),
          fetch(`${API_BASE}/api/predictDiabetes`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...clinicalData,patientId}) }),
          fetch(`${API_BASE}/api/predictKidney`,   { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...clinicalData,patientId}) })
        ]);
        const [hData, dData, kData] = await Promise.all([hRes.json(), dRes.json(), kRes.json()]);
        heartRisk    = hData.riskScore;
        diabetesRisk = dData.riskScore;
        kidneyRisk   = kData.riskScore;

        // XAI for highest risk
        const maxRiskDisease = [
          { disease:'Cardiovascular Disease', score:heartRisk },
          { disease:'Diabetes Mellitus',      score:diabetesRisk },
          { disease:'Chronic Kidney Disease', score:kidneyRisk }
        ].sort((a,b) => b.score - a.score)[0];

        const xRes = await fetch(`${API_BASE}/api/getExplanation`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ disease:maxRiskDisease.disease, riskScore:maxRiskDisease.score, clinicalData })
        });
        xaiResult = await xRes.json();
      } catch(err) {
        console.warn('Backend unreachable, switching to offline engine:', err);
        const offline = generateOfflinePredictions(clinicalData);
        heartRisk = offline.heartRisk; diabetesRisk = offline.diabetesRisk;
        kidneyRisk = offline.kidneyRisk; xaiResult = offline.xai;
      }
    } else {
      const offline = generateOfflinePredictions(clinicalData);
      heartRisk = offline.heartRisk; diabetesRisk = offline.diabetesRisk;
      kidneyRisk = offline.kidneyRisk; xaiResult = offline.xai;
    }

    let patientRecord = {
      patientId,
      doctorId: user?.id || 'doc_1',
      name,
      age: parseInt(age),
      gender,
      clinicalData,
      ecgAttached: !!ecgPreview,
      fundusAttached: !!fundusPreview,
      ecgImage: ecgPreview,
      fundusImage: fundusPreview,
      prescriptions: '',
      createdTime: duplicatePatient ? duplicatePatient.createdTime : new Date().toISOString(),
      synced: isOnline ? 1 : 0
    };
    
    if (duplicatePatient) {
      await db.patients.update(duplicatePatient.id, patientRecord);
      patientRecord = { ...patientRecord, id: duplicatePatient.id };
    } else {
      const insertedId = await db.patients.add(patientRecord);
      patientRecord = { ...patientRecord, id: insertedId };
    }

    let compositeRisk;
    try {
      const multimodalRes = await fetch(`${API_BASE}/api/multimodalScore`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          age: parseInt(age), gender, bp,
          bloodSugar: parseFloat(bloodSugar),
          cholesterol: parseFloat(cholesterol),
          ldl: parseFloat(ldl),
          hba1c: parseFloat(hba1c),
          uacr: parseFloat(uacr),
          serumCreatinine: parseFloat(serumCreatinine),
          eGFR: parseFloat(eGFR),
          bmi: parseFloat(bmi), insulin: parseFloat(insulin),
          urea: parseFloat(urea), potassium: parseFloat(potassium),
          sodium: parseFloat(sodium),
          symptoms: activeSymptoms
        })
      });
      const multimodalData = await multimodalRes.json();
      compositeRisk = multimodalData.riskScore;
    } catch(e) {
      console.warn('Multimodal scoring failed', e);
    }

    // ── Fetch 12-lead ECG signal metrics from the Python ECG backend ──────────
    // (runs in parallel with the rest of the analysis; silently skipped offline)
    let leadsData     = {};
    let miAnalysis    = null;
    let globalMetrics = null;

    if (ecgPreview && isOnline) {
      try {
        const ecgB64 = ecgPreview.startsWith('data:') ? ecgPreview.split(',')[1] : ecgPreview;
        const ecgRes = await fetch(`${API_BASE}/analyze-ecg-advanced`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ image: ecgB64 }),
        });
        const ecgJson = await ecgRes.json();
        if (ecgJson.success) {
          leadsData     = ecgJson.leads     || {};
          miAnalysis    = ecgJson.mi_analysis || null;
          globalMetrics = {
            bpm:         ecgJson.bpm,
            hrv:         ecgJson.hrv,
            qrs_ms:      ecgJson.qrs_ms,
            noise_level: ecgJson.noise_level,
            checks:      ecgJson.checks || [],
          };
        }
      } catch (ecgErr) {
        console.warn('[NewPatientScreen] ECG signal backend unreachable:', ecgErr.message);
      }
    }

    const predictionRecord = {
      patientId,
      heartRisk,
      diabetesRisk,
      kidneyRisk,
      compositeRisk: compositeRisk !== undefined ? compositeRisk : null,
      primaryExplanation: xaiResult,
      leadsData,
      miAnalysis,
      globalMetrics,
      createdTime: new Date().toISOString(),
      synced: isOnline ? 1 : 0
    };
    await db.predictions.add(predictionRecord);

    setLoading(false);
    setUseExistingId(false);
    setDuplicatePatient(null);
    onSetCurrentResult({ patient: patientRecord, predictions: predictionRecord });
    onNavigate('results');
  };

  const symptomList = [
    { key:'chestPain',        label:'Chest Pain' },
    { key:'fatigue',          label:'Fatigue' },
    { key:'frequentUrination',label:'Frequent Urination' },
    { key:'swelling',         label:'Limb Swelling' },
    { key:'visionChanges',    label:'Vision Changes' },
    { key:'breathlessness',   label:'Breathlessness' }
  ];

  return (
    <div className="container" style={{animation:'fadeIn 0.5s ease-out'}}>
      {showDuplicateDialog && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div className="glass-panel" style={{padding:'24px',maxWidth:'400px',textAlign:'center'}}>
            <h3 style={{fontSize:'18px',marginBottom:'16px',color:'var(--color-warning)'}}>Patient Already Exists</h3>
            <p style={{marginBottom:'16px',color:'var(--text-secondary)'}}>
              A patient named <strong>{duplicatePatient?.name}</strong> (Age: {duplicatePatient?.age}) already exists in the system.
            </p>
            <p style={{marginBottom:'24px',fontSize:'12px',color:'var(--text-muted)'}}>
              Patient ID: <code>{duplicatePatient?.patientId}</code>
            </p>
            <div style={{display:'flex',gap:'12px',justifyContent:'center'}}>
              <button 
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setDuplicatePatient(null);
                  setShowDuplicateDialog(false);
                  setUseExistingId(false);
                }}
              >
                Create New Entry
              </button>
              <button 
                type="button"
                className="btn-primary"
                onClick={() => {
                  setUseExistingId(true);
                  setShowDuplicateDialog(false);
                  proceedWithAnalysis();
                }}
              >
                Use Existing ID
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'24px'}}>
        <button onClick={()=>onNavigate('dashboard')} className="btn-secondary" style={{padding:'8px 12px'}}>
          <ArrowLeft size={16}/>
        </button>
        <h2 style={{fontSize:'24px',fontWeight:'800'}}>{t.newPatient} Diagnostic Form</h2>
      </div>

      <form onSubmit={handleAnalyze}>
        <div className="grid-2" style={{alignItems:'start',marginBottom:'24px'}}>

          {/* Left: Clinical Parameters */}
          <div className="glass-panel" style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            <h3 style={{fontSize:'18px',borderBottom:'1px solid var(--glass-border)',paddingBottom:'8px'}}>
              Clinical Measurements
            </h3>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{t.name}</label>
                <input type="text" className="input-field" value={name} onChange={e=>setName(e.target.value)} placeholder="Full Name" required/>
              </div>
              <div className="form-group">
                <label className="form-label">{t.age}</label>
                <input type="number" className="input-field" value={age} onChange={e=>setAge(e.target.value)} placeholder="e.g. 52" required/>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{t.gender}</label>
                <select className="input-field" value={gender} onChange={e=>setGender(e.target.value)} style={{background:'var(--bg-secondary)'}}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t.bp} <span style={{fontSize:'10px',color:'var(--text-muted)'}}>mmHg</span></label>
                <input type="text" className="input-field" value={bp} onChange={e=>setBp(e.target.value)}/>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{t.bloodSugar} <span style={{fontSize:'10px',color:'var(--color-warning)'}}>↑ Diabetes</span></label>
                <input type="number" className="input-field" value={bloodSugar} onChange={e=>setBloodSugar(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">{t.cholesterol} <span style={{fontSize:'10px',color:'var(--color-danger)'}}>↑ Heart</span></label>
                <input type="number" className="input-field" value={cholesterol} onChange={e=>setCholesterol(e.target.value)}/>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{t.serumCreatinine} <span style={{fontSize:'10px',color:'var(--accent-secondary)'}}>↑ Kidney</span></label>
                <input type="number" step="0.1" className="input-field" value={serumCreatinine} onChange={e=>setSerumCreatinine(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">{t.eGFR} <span style={{fontSize:'10px',color:'var(--accent-secondary)'}}>↓ = Kidney risk</span></label>
                <input type="number" className="input-field" value={eGFR} onChange={e=>setEgfr(e.target.value)}/>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{t.bmi} <span style={{fontSize:'10px',color:'var(--text-muted)'}}>↑ Diabetes+Heart</span></label>
                <input type="number" step="0.1" className="input-field" value={bmi} onChange={e=>setBmi(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">{t.insulin} <span style={{fontSize:'10px',color:'var(--color-warning)'}}>µU/mL</span></label>
                <input type="number" className="input-field" value={insulin} onChange={e=>setInsulin(e.target.value)}/>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{t.urea} <span style={{fontSize:'10px',color:'var(--accent-secondary)'}}>↑ Kidney</span></label>
                <input type="number" className="input-field" value={urea} onChange={e=>setUrea(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Potassium / Sodium (K / Na)</label>
                <div style={{display:'flex',gap:'8px'}}>
                  <input type="number" step="0.1" className="input-field" value={potassium} onChange={e=>setPotassium(e.target.value)} placeholder="K" style={{flex:1}}/>
                  <input type="number" className="input-field" value={sodium} onChange={e=>setSodium(e.target.value)} placeholder="Na" style={{flex:1}}/>
                </div>
              </div>
            </div>
{/* Additional Lab Biomarkers */}
<div className="grid-2" style={{alignItems:'start',marginBottom:'24px'}}>
  <div className="form-group">
    <label className="form-label">HbA1c (%) <span style={{fontSize:'10px',color:'var(--color-warning)'}}>↑ Diabetes</span></label>
    <input type="number" className="input-field" value={hba1c} onChange={e=>setHba1c(e.target.value)} />
  </div>
  <div className="form-group">
    <label className="form-label">UACR (mg/g) <span style={{fontSize:'10px',color:'var(--accent-secondary)'}}>↑ Kidney</span></label>
    <input type="number" className="input-field" value={uacr} onChange={e=>setUacr(e.target.value)} />
  </div>
</div>
          </div>

          {/* Right: Symptoms + Uploads */}
          <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>
            <div className="glass-panel">
              <h3 style={{fontSize:'18px',borderBottom:'1px solid var(--glass-border)',paddingBottom:'8px',marginBottom:'16px'}}>
                {t.symptoms}
              </h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'12px'}}>
                {symptomList.map(s => (
                  <label key={s.key} style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',cursor:'pointer'}}>
                    <input type="checkbox" checked={symptoms[s.key]} onChange={()=>toggleSymptom(s.key)}
                      style={{accentColor:'var(--accent-secondary)',width:'16px',height:'16px'}}/>
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="glass-panel">
              <h3 style={{fontSize:'18px',borderBottom:'1px solid var(--glass-border)',paddingBottom:'8px',marginBottom:'16px'}}>
                ECG Upload (12-Lead)
              </h3>
              <input type="file" accept="image/*,.pdf" id="ecg-upload" style={{display:'none'}} onChange={handleEcgUpload}/>
              <label htmlFor="ecg-upload" className="btn-secondary"
                style={{width:'100%',justifyContent:'center',cursor:'pointer',padding:'16px',borderStyle:'dashed'}}>
                <FileUp size={18}/>
                <span>Choose ECG scan file</span>
              </label>
              {ecgPreview && (
                <div style={{marginTop:'12px',background:'#070a14',borderRadius:'8px',padding:'8px',textAlign:'center'}}>
                  <img src={ecgPreview} alt="ECG" style={{maxWidth:'100%',maxHeight:'120px',objectFit:'contain',borderRadius:'4px'}}/>
                </div>
              )}
            </div>

            <div className="glass-panel">
              <h3 style={{fontSize:'18px',borderBottom:'1px solid var(--glass-border)',paddingBottom:'8px',marginBottom:'16px'}}>
                Retinal Fundus Image
              </h3>
              <input type="file" accept="image/*" id="fundus-upload" style={{display:'none'}} onChange={handleFundusUpload}/>
              <label htmlFor="fundus-upload" className="btn-secondary"
                style={{width:'100%',justifyContent:'center',cursor:'pointer',padding:'16px',borderStyle:'dashed'}}>
                <FileUp size={18}/>
                <span>Choose Retinal Fundus Photo</span>
              </label>
              {fundusPreview && (
                <div style={{marginTop:'12px',background:'#070a14',borderRadius:'8px',padding:'8px',textAlign:'center'}}>
                  <img src={fundusPreview} alt="Fundus" style={{maxWidth:'100%',maxHeight:'120px',objectFit:'contain',borderRadius:'4px'}}/>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{display:'flex',justifyContent:'flex-end',gap:'16px'}}>
          <button type="button" onClick={()=>onNavigate('dashboard')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary" style={{minWidth:'200px',justifyContent:'center'}}>
            {loading ? (
              <><RefreshCcw size={16} className="glowing-text"/><span>Running AI Models (3 diseases)...</span></>
            ) : (
              <><Activity size={16}/><span>{t.analyze} — Heart + Diabetes + Kidney</span></>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
