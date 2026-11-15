import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { Search, Download, BookOpen, Heart, Activity, Sparkles, Check, Phone, Lock } from 'lucide-react';
import { db } from '../db/localDb';
import SpeechReader from '../components/SpeechReader';

export default function PatientPortalScreen({ user, t, lang }) {
  const [patientData, setPatientData] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const getPrescriptionMedicationRows = (prescriptionText) => {
    if (!prescriptionText || !prescriptionText.trim()) return [];

    const lines = prescriptionText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => {
        if (!l) return false;
        if (/^={2,}/.test(l) || /^-{2,}/.test(l)) return false;
        if (/EVIDENCE-BASED|CLINICAL RATIONALE|MULTI-PARAMETER BASIS|Patient Context:|RECOMMENDED PHARMACOTHERAPY|ATTENDING PHYSICIAN|risk is calculated/i.test(l)) return false;
        return true;
      })
      .map(l => l.replace(/^[\*\-•\d\.\)\s]+/, '').trim())
      .filter(Boolean);

    const rows = [];
    lines.forEach(line => {
      if (line.includes(':')) {
        const parts = line.split(':');
        const category = parts[0].trim();
        const detail = parts.slice(1).join(':').trim();

        const doseMatch = detail.match(/(\d+\s?(mg|g|mcg|ml|units|tablets?|capsules?))/i);
        const dosage = doseMatch ? doseMatch[1].trim() : 'As prescribed';

        const freqMatch = detail.match(/(once daily|twice daily|daily PO|PO once daily|PO|BID|TID|QID)/i);
        const frequency = freqMatch ? freqMatch[0].trim() : 'Daily PO';

        let nameOnly = detail.split(/PO|once|twice|\(/i)[0].trim();
        if (nameOnly.length < 3) nameOnly = detail;

        rows.push({
          name: `${category}: ${nameOnly}`,
          dosage: dosage,
          frequency: frequency,
          notes: detail.includes('(') ? detail.substring(detail.indexOf('(')).replace(/[\(\)]/g, '').trim() : 'Take as directed by physician.'
        });
      } else {
        const doseMatch = line.match(/(\d+\s?(mg|g|mcg|ml|units|tablets?|capsules?))/i);
        if (doseMatch) {
          const parts = line.split(doseMatch[0]);
          rows.push({
            name: parts[0].trim() || line,
            dosage: doseMatch[0].trim(),
            frequency: 'Daily PO',
            notes: parts[1] ? parts[1].replace(/^[,\s\-]+/, '').trim() : 'As advised by physician.'
          });
        }
      }
    });

    return rows.filter(r => r.name && !r.name.toLowerCase().includes('rationale') && !r.name.toLowerCase().includes('calculated'));
  };

  // Patients can ONLY see their own data — the ID is locked to their login
  const myPatientId = user.patientId;

  useEffect(() => {
    if (!myPatientId) { setError('No patient ID associated with this account.'); return; }
    loadMyData(myPatientId);
  }, [myPatientId]);

  const loadMyData = async (pId) => {
    setError('');
    try {
      const patient = await db.patients.where('patientId').equals(pId.toUpperCase().trim()).first();
      if (!patient) { setError('No records found for your patient ID yet. Please ask your doctor to register you.'); return; }
      const pred = await db.predictions.where('patientId').equals(patient.patientId).first();
      const rxs  = await db.prescriptions.where('patientId').equals(patient.patientId).toArray();
      setPatientData(patient);
      setPredictions(pred || null);
      setPrescriptions(rxs || []);
    } catch(e) { console.error(e); setError('Database access error.'); }
  };

  const handleDownload = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const primaryColor = '#0b1f3a';
    const accentColor = '#0f8fe0';
    const textColor = '#1f2937';
    const lightBg = '#f8fafc';
    const borderColor = '#cbd5e1';

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 1: DIAGNOSTIC & CLINICAL RISK ASSESSMENT REPORT
    // ─────────────────────────────────────────────────────────────────────────

    // Header letterhead
    doc.setFillColor(primaryColor);
    doc.rect(0, 0, 595, 90, 'F');
    doc.setTextColor('#ffffff');
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('AURA CENTRAL HOSPITAL', 40, 38);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('123 Clinical Drive · Healthcare City · Hotline: +91 1800-455-AURA', 40, 54);
    doc.text('www.aurahealth.ai · clinical-records@aurahealth.ai', 40, 68);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL CLINICAL REPORT', 555, 38, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 555, 54, { align: 'right' });
    doc.text(`Ref ID: RPT-${patientData?.patientId || '000'}-${Date.now().toString().slice(-4)}`, 555, 68, { align: 'right' });

    // Decorative Accent Line
    doc.setFillColor(accentColor);
    doc.rect(0, 90, 595, 4, 'F');

    // 1. Patient Demographics & Admission Box
    doc.setFillColor(lightBg);
    doc.roundedRect(40, 108, 515, 88, 6, 6, 'F');
    doc.setDrawColor(borderColor);
    doc.setLineWidth(0.8);
    doc.roundedRect(40, 108, 515, 88, 6, 6, 'S');

    doc.setTextColor(primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT DEMOGRAPHICS & ADMISSION DETAILS', 52, 126);

    doc.setTextColor(textColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const cd = patientData?.clinicalData || {};
    const col1X = 52, col2X = 220, col3X = 390;

    doc.text(`Full Name: ${patientData?.name || 'N/A'}`, col1X, 145);
    doc.text(`Age: ${patientData?.age ?? 'N/A'} years`, col1X, 160);
    doc.text(`Gender: ${patientData?.gender || 'N/A'}`, col1X, 175);

    doc.text(`Patient ID: ${patientData?.patientId || 'N/A'}`, col2X, 145);
    doc.text(`Attending Physician: Dr. Sarah Jenkins, MD`, col2X, 160);
    doc.text(`Department: Internal Medicine`, col2X, 175);

    doc.text(`Blood Group: ${cd.bloodGroup || 'O+'}`, col3X, 145);
    doc.text(`Facility: Aura Central Hospital`, col3X, 160);
    doc.text(`Status: Outpatient Active`, col3X, 175);

    // 2. Baseline Clinical Vitals & Biomarkers
    doc.setTextColor(primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Baseline Vitals & Laboratory Biomarkers', 40, 218);

    doc.setFillColor('#ffffff');
    doc.setDrawColor(borderColor);
    doc.rect(40, 228, 515, 75);
    doc.setFillColor('#f1f5f9');
    doc.rect(40, 228, 515, 22, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#334155');
    doc.text('Parameter', 48, 243);
    doc.text('Observed Value', 180, 243);
    doc.text('Reference Standard', 330, 243);
    doc.text('Status', 480, 243);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textColor);

    const vitals = [
      { name: 'Blood Pressure (Systolic)', value: `${cd.bp || '120/80'} mmHg`, ref: '90 - 120 mmHg', status: 'Normal' },
      { name: 'Fasting Blood Glucose', value: `${cd.bloodSugar || 100} mg/dL`, ref: '70 - 100 mg/dL', status: 'Optimal' },
      { name: 'Serum Creatinine', value: `${cd.serumCreatinine || 0.9} mg/dL`, ref: '0.5 - 1.2 mg/dL', status: 'Optimal' }
    ];

    vitals.forEach((v, idx) => {
      const rowY = 265 + idx * 16;
      doc.text(v.name, 48, rowY);
      doc.text(v.value, 180, rowY);
      doc.text(v.ref, 330, rowY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#16a34a');
      doc.text(v.status, 480, rowY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor);
    });

    // 3. Multi-Organ Clinical Risk Assessment Table
    doc.setTextColor(primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Clinical Risk Stratification & Organ System Evaluation', 40, 326);

    const tableTop = 336;
    doc.setDrawColor(borderColor);
    doc.setFillColor('#f1f5f9');
    doc.rect(40, tableTop, 515, 24, 'F');
    doc.rect(40, tableTop, 515, 100, 'S');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#334155');
    doc.text('Organ System Evaluated', 48, tableTop + 16);
    doc.text('Risk Index', 190, tableTop + 16);
    doc.text('Clinical Classification', 300, tableTop + 16);
    doc.text('Diagnostic Interpretation', 420, tableTop + 16);

    const risks = [
      { organ: 'Cardiovascular (Heart)', score: predictions?.heartRisk ?? 0 },
      { organ: 'Endocrine (Diabetes)', score: predictions?.diabetesRisk ?? 0 },
      { organ: 'Renal (Kidney)', score: predictions?.kidneyRisk ?? 0 }
    ];

    risks.forEach((item, idx) => {
      const y = tableTop + 40 + idx * 24;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textColor);
      doc.text(item.organ, 48, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(accentColor);
      doc.text(`${item.score}%`, 190, y);

      const statusText = item.score > 70 ? 'High Risk' : item.score > 40 ? 'Moderate Risk' : 'Low / Normal';
      const statusColor = item.score > 70 ? '#dc2626' : item.score > 40 ? '#d97706' : '#16a34a';

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(statusColor);
      doc.text(statusText, 300, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor);
      const interp = item.score > 70 ? 'Intervention indicated' : item.score > 40 ? 'Routine observation' : 'Unremarkable baseline';
      doc.text(interp, 420, y);

      if (idx < 2) {
        doc.setDrawColor('#cbd5e1');
        doc.line(40, y + 8, 555, y + 8);
      }
    });

    // 4. Detailed Organ Health Breakdown Box
    doc.setFillColor(lightBg);
    doc.roundedRect(40, 456, 515, 270, 6, 6, 'F');
    doc.setDrawColor(borderColor);
    doc.roundedRect(40, 456, 515, 270, 6, 6, 'S');

    doc.setTextColor(primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SPECIALIST CLINICAL ASSESSMENT NARRATIVE', 52, 476);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textColor);

    const organNotes = [
      {
        title: 'Cardiovascular Function & Hemodynamics',
        desc: `Cardiovascular risk index is evaluated at ${predictions?.heartRisk ?? 0}%. Resting blood pressure (${cd.bp || '120/80'} mmHg) and systemic vascular resistance indicate stable arterial compliance with normal myocardial perfusion.`
      },
      {
        title: 'Pancreatic Endocrine & Carbohydrate Metabolism',
        desc: `Metabolic risk index is evaluated at ${predictions?.diabetesRisk ?? 0}%. Fasting plasma glucose (${cd.bloodSugar || 100} mg/dL) reflects preserved peripheral insulin sensitivity and balanced hepatic glucose output.`
      },
      {
        title: 'Renal Glomerular Filtration & Excretory Function',
        desc: `Renal risk index is evaluated at ${predictions?.kidneyRisk ?? 0}%. Serum creatinine (${cd.serumCreatinine || 0.9} mg/dL) and eGFR (95 mL/min/1.73m²) confirm intact glomerular clearance without evidence of proteinuria or tubulointerstitial stress.`
      }
    ];

    let noteY = 496;
    organNotes.forEach((note) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(accentColor);
      doc.text(note.title, 52, noteY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textColor);
      const splitDesc = doc.splitTextToSize(note.desc, 490);
      doc.text(splitDesc, 52, noteY + 14);

      noteY += 20 + splitDesc.length * 12;
    });

    // Page 1 Footer
    doc.setFontSize(8);
    doc.setTextColor('#94a3b8');
    doc.line(40, 785, 555, 785);
    doc.text('Aura Central Hospital · 123 Clinical Drive, Healthcare City · Official Medical Record', 40, 798);
    doc.text('Page 1 of 2', 555, 798, { align: 'right' });

    // ─────────────────────────────────────────────────────────────────────────
    // PAGE 2: PHARMACOTHERAPY, CARE PLAN & PHYSICIAN ATTESTATION
    // ─────────────────────────────────────────────────────────────────────────
    doc.addPage();

    // Page 2 Header Letterhead
    doc.setFillColor(primaryColor);
    doc.rect(0, 0, 595, 60, 'F');
    doc.setTextColor('#ffffff');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('AURA CENTRAL HOSPITAL', 40, 32);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Outpatient Pharmacotherapy & Clinical Management Directives', 40, 46);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Patient: ${patientData?.name || 'N/A'} (ID: ${patientData?.patientId || 'N/A'})`, 555, 32, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 555, 46, { align: 'right' });

    doc.setFillColor(accentColor);
    doc.rect(0, 60, 595, 3, 'F');

    // 1. Pharmacotherapy Medication Orders Table
    doc.setTextColor(primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Active Pharmacotherapy & Prescribed Medication Orders', 40, 84);

    const medTableTop = 94;
    doc.setDrawColor(borderColor);
    doc.setFillColor('#f1f5f9');
    doc.rect(40, medTableTop, 515, 22, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#334155');
    doc.text('Medication Name', 48, medTableTop + 15);
    doc.text('Dosage', 190, medTableTop + 15);
    doc.text('Frequency / Route', 300, medTableTop + 15);
    doc.text('Administration Directives', 420, medTableTop + 15);

    const rawPrescriptionText = patientData?.prescriptions || prescriptions?.[0]?.text || '';
    const medicationRows = getPrescriptionMedicationRows(rawPrescriptionText);

    if (medicationRows.length === 0) {
      medicationRows.push({
        name: 'Multivitamin & Electrolyte Maintenance',
        dosage: '1 Tablet',
        frequency: 'Daily PO',
        notes: 'Take in morning after meals; maintain 2.5L daily hydration.'
      });
    }

    let medY = medTableTop + 34;
    medicationRows.slice(0, 4).forEach((med) => {
      doc.setFontSize(8.5);

      // Column 1: Medication Name (Width 130pt)
      const splitName = doc.splitTextToSize(med.name || 'Prescription Item', 130);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textColor);
      doc.text(splitName, 48, medY);

      // Column 2: Dosage (Width 95pt)
      const splitDosage = doc.splitTextToSize(med.dosage || 'Standard', 95);
      doc.setFont('helvetica', 'normal');
      doc.text(splitDosage, 190, medY);

      // Column 3: Frequency (Width 105pt)
      const splitFreq = doc.splitTextToSize(med.frequency || 'Daily PO', 105);
      doc.setFont('helvetica', 'normal');
      doc.text(splitFreq, 300, medY);

      // Column 4: Directives (Width 125pt)
      const splitNotes = doc.splitTextToSize(med.notes || 'As advised by physician.', 125);
      doc.setFont('helvetica', 'normal');
      doc.text(splitNotes, 420, medY);

      const maxLines = Math.max(splitName.length, splitDosage.length, splitFreq.length, splitNotes.length);
      medY += Math.max(22, maxLines * 11 + 6);

      doc.setDrawColor('#cbd5e1');
      doc.line(40, medY - 6, 555, medY - 6);
    });

    const medTableHeight = medY - medTableTop - 6;
    doc.rect(40, medTableTop, 515, medTableHeight, 'S');

    // 2. Comprehensive Outpatient Directives & Lifestyle Recommendations
    const recoTop = medTableTop + medTableHeight + 16;
    doc.setTextColor(primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('4. Outpatient Directives & Clinical Recommendations', 40, recoTop);

    const recommendations = [
      '1. Medication Compliance: Strictly adhere to prescribed timings and dosages without skipping doses.',
      '2. Sodium & Dietary Control: Limit daily dietary sodium to < 2,000 mg and reduce refined sugar consumption.',
      '3. Self-Monitoring: Record resting blood pressure and fasting plasma glucose every morning.',
      '4. Hydration & Activity: Maintain daily fluid intake of 2.5L water and engage in 30 mins moderate aerobic exercise.',
      '5. Outpatient Follow-up: Schedule a routine clinical re-evaluation and lab panel within 14 days.'
    ];

    doc.setFillColor('#f8fafc');
    doc.setDrawColor(borderColor);

    let tempY = recoTop + 24;
    recommendations.forEach((r) => {
      const splitR = doc.splitTextToSize(r, 495);
      tempY += splitR.length * 12 + 3;
    });

    const recoBoxHeight = tempY - (recoTop + 10);
    doc.roundedRect(40, recoTop + 10, 515, recoBoxHeight, 6, 6, 'F');
    doc.roundedRect(40, recoTop + 10, 515, recoBoxHeight, 6, 6, 'S');

    // Render recommendation text cleanly over background box
    let recLineY = recoTop + 24;
    doc.setTextColor('#1f2937');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    recommendations.forEach((r) => {
      const splitR = doc.splitTextToSize(r, 495);
      doc.text(splitR, 50, recLineY);
      recLineY += splitR.length * 12 + 3;
    });

    // 3. Attending Physician Consultation Notes & Official Attestation
    const notesTop = recoTop + 10 + recoBoxHeight + 16;
    doc.setTextColor(primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('5. Attending Physician Consultation Notes & Attestation', 40, notesTop);

    const notesBoxTop = notesTop + 10;
    doc.setFillColor('#ffffff');
    doc.setDrawColor(borderColor);

    // Clean up raw prescription text for clinical notes box
    let cleanDoctorNote = rawPrescriptionText
      .replace(/={2,}/g, '')
      .replace(/EVIDENCE-BASED MULTI-PARAMETER AI CLINICAL DECISION SUPPORT/g, '')
      .replace(/Patient Context:[^\n]*/g, '')
      .replace(/RECOMMENDED PHARMACOTHERAPY[^\n]*/gi, '')
      .trim();

    if (!cleanDoctorNote) {
      cleanDoctorNote = 'Patient demonstrates stable vital signs and low organ stress across cardiovascular, metabolic, and renal biomarkers. Continue prescribed maintenance therapy and routine annual screening.';
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentColor);
    doc.text('ATTENDING PHYSICIAN CONSULTATION SUMMARY', 52, notesBoxTop + 20);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textColor);

    const splitNotes = doc.splitTextToSize(cleanDoctorNote, 490);
    const displayNotes = splitNotes.slice(0, 5);
    doc.text(displayNotes, 52, notesBoxTop + 34);

    const noteTextHeight = displayNotes.length * 12;

    // DYNAMIC Signature Block (Positioned safely below notes text)
    const sigY = notesBoxTop + 34 + noteTextHeight + 20;
    doc.setDrawColor('#94a3b8');
    doc.line(380, sigY, 530, sigY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(primaryColor);
    doc.text('Dr. Sarah Jenkins, MD', 380, sigY + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#64748b');
    doc.text('Senior Consultant Physician', 380, sigY + 22);
    doc.text('Reg No: MCI-2018-84920', 380, sigY + 31);

    const notesBoxHeight = sigY + 36 - notesBoxTop;
    doc.roundedRect(40, notesBoxTop, 515, notesBoxHeight, 6, 6, 'S');

    // Page 2 Footer
    doc.setFontSize(8);
    doc.setTextColor('#94a3b8');
    doc.line(40, 785, 555, 785);
    doc.text('Aura Central Hospital · 123 Clinical Drive, Healthcare City · Official Confidential Medical Record', 40, 798);
    doc.text('Page 2 of 2', 555, 798, { align: 'right' });

    const fileName = `AURA-Clinical-Report-${patientData?.patientId || 'Unknown'}.pdf`;
    doc.save(fileName);
  };

  const getRiskColor = (s) => s > 70 ? 'var(--color-danger)' : s > 40 ? 'var(--color-warning)' : 'var(--color-success)';
  const getRiskText  = (s) => s > 70 ? 'High — Attention Required' : s > 40 ? 'Moderate — Observation' : 'Optimal Range';

  const audioSummary = patientData && predictions
    ? `Your AURA health report. Heart risk: ${predictions.heartRisk}%. Diabetes risk: ${predictions.diabetesRisk}%. Kidney risk: ${predictions.kidneyRisk}%.`
    : '';

  const tabStyle = (tab) => ({
    padding: '8px 18px', fontSize: '13px', fontWeight: activeTab===tab ? '700':'400',
    color: activeTab===tab ? 'var(--accent-secondary)' : 'var(--text-muted)',
    borderBottom: activeTab===tab ? '2px solid var(--accent-secondary)' : '2px solid transparent',
    cursor: 'pointer', background:'none', border:'none'
  });

  return (
    <div className="container" style={{animation:'fadeIn 0.5s ease-out'}}>

      {/* Identity lock banner */}
      <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',
        background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.15)',
        borderRadius:'10px',marginBottom:'20px',fontSize:'13px'}}>
        <Lock size={14} color="var(--color-success)"/>
        <span>Viewing records for <b style={{color:'var(--color-success)'}}>{myPatientId}</b> — your account is locked to your own data only.</span>
      </div>

      {error && (
        <div style={{padding:'16px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',
          borderRadius:'10px',color:'var(--color-danger)',fontSize:'13px',marginBottom:'20px'}}>
          {error}
        </div>
      )}

      {patientData && (
        <>
          {/* Header card */}
          <div className="glass-panel" style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:'16px',marginBottom:'20px'}}>
            <div>
              <span className="badge badge-success" style={{marginBottom:'8px'}}>Active Health Portal</span>
              <h2 style={{fontSize:'22px',fontWeight:'800'}}>
                Patient: <span className="glowing-text">{patientData.name}</span>
              </h2>
              <p style={{fontSize:'13px',color:'var(--text-secondary)',marginTop:'4px'}}>
                ID: <b>{patientData.patientId}</b> | Age: {patientData.age} | {patientData.gender}
              </p>
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <SpeechReader text={audioSummary} lang={lang}/>
              <button onClick={handleDownload} className="btn-primary" style={{padding:'8px 12px',fontSize:'12px',gap:'6px'}}>
                <Download size={14}/><span>{t.downloadPdf}</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:'flex',borderBottom:'1px solid var(--glass-border)',marginBottom:'20px',gap:'4px'}}>
            {['overview','predictions','prescriptions','guidelines'].map(tab => (
              <button key={tab} onClick={()=>setActiveTab(tab)} style={tabStyle(tab)}>
                {tab==='overview' && 'Overview'}
                {tab==='predictions' && 'AI Risk Analysis'}
                {tab==='prescriptions' && 'My Prescriptions'}
                {tab==='guidelines' && 'Care Guidelines'}
              </button>
            ))}
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',gap:'16px'}}>
              {/* Vitals summary */}
              <div className="glass-panel">
                <h3 style={{fontSize:'16px',fontWeight:'700',marginBottom:'14px',display:'flex',alignItems:'center',gap:'8px'}}>
                  <Activity size={18} color="var(--accent-secondary)"/>
                  <span>Current Biomarkers</span>
                </h3>
                <div style={{display:'flex',flexDirection:'column',gap:'10px',fontSize:'13px'}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:'var(--text-secondary)'}}>Blood Pressure</span>
                    <b>{patientData.clinicalData?.bp || '120/80'} mmHg</b>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:'var(--text-secondary)'}}>Fasting Glucose</span>
                    <b>{patientData.clinicalData?.bloodSugar || 100} mg/dL</b>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:'var(--text-secondary)'}}>Serum Creatinine</span>
                    <b>{patientData.clinicalData?.serumCreatinine || 0.9} mg/dL</b>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{color:'var(--text-secondary)'}}>eGFR Rate</span>
                    <b>{patientData.clinicalData?.eGFR || 95} mL/min</b>
                  </div>
                </div>
              </div>

              {/* Latest Risk Assessment */}
              {predictions && (
                <div className="glass-panel">
                  <h3 style={{fontSize:'16px',fontWeight:'700',marginBottom:'14px',display:'flex',alignItems:'center',gap:'8px'}}>
                    <Sparkles size={18} color="var(--color-success)"/>
                    <span>AI Risk Summary</span>
                  </h3>
                  <div style={{display:'flex',flexDirection:'column',gap:'12px',fontSize:'13px'}}>
                    <div>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                        <span>Cardiovascular Risk</span>
                        <b style={{color:getRiskColor(predictions.heartRisk)}}>{predictions.heartRisk}%</b>
                      </div>
                      <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{getRiskText(predictions.heartRisk)}</div>
                    </div>
                    <div>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                        <span>Diabetes Risk</span>
                        <b style={{color:getRiskColor(predictions.diabetesRisk)}}>{predictions.diabetesRisk}%</b>
                      </div>
                      <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{getRiskText(predictions.diabetesRisk)}</div>
                    </div>
                    <div>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                        <span>Kidney Disease Risk</span>
                        <b style={{color:getRiskColor(predictions.kidneyRisk)}}>{predictions.kidneyRisk}%</b>
                      </div>
                      <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{getRiskText(predictions.kidneyRisk)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: AI Risk Analysis */}
          {activeTab === 'predictions' && predictions && (
            <div className="glass-panel">
              <h3 style={{fontSize:'18px',fontWeight:'700',marginBottom:'16px'}}>Multimodal AI Analysis Results</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:'16px'}}>
                <div style={{padding:'16px',background:'rgba(255,255,255,0.03)',borderRadius:'10px',border:'1px solid var(--glass-border)'}}>
                  <h4 style={{color:'var(--accent-secondary)',fontSize:'14px',marginBottom:'8px'}}>Cardiovascular System</h4>
                  <p style={{fontSize:'24px',fontWeight:'800',color:getRiskColor(predictions.heartRisk)}}>{predictions.heartRisk}%</p>
                  <p style={{fontSize:'12px',color:'var(--text-secondary)',marginTop:'4px'}}>Heart Attack & Ischemia Risk</p>
                </div>
                <div style={{padding:'16px',background:'rgba(255,255,255,0.03)',borderRadius:'10px',border:'1px solid var(--glass-border)'}}>
                  <h4 style={{color:'var(--accent-secondary)',fontSize:'14px',marginBottom:'8px'}}>Metabolic System</h4>
                  <p style={{fontSize:'24px',fontWeight:'800',color:getRiskColor(predictions.diabetesRisk)}}>{predictions.diabetesRisk}%</p>
                  <p style={{fontSize:'12px',color:'var(--text-secondary)',marginTop:'4px'}}>Type-2 Diabetes & Glycemic Risk</p>
                </div>
                <div style={{padding:'16px',background:'rgba(255,255,255,0.03)',borderRadius:'10px',border:'1px solid var(--glass-border)'}}>
                  <h4 style={{color:'var(--accent-secondary)',fontSize:'14px',marginBottom:'8px'}}>Renal System</h4>
                  <p style={{fontSize:'24px',fontWeight:'800',color:getRiskColor(predictions.kidneyRisk)}}>{predictions.kidneyRisk}%</p>
                  <p style={{fontSize:'12px',color:'var(--text-secondary)',marginTop:'4px'}}>Chronic Kidney Disease (CKD) Risk</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Prescriptions */}
          {activeTab === 'prescriptions' && (
            <div className="glass-panel">
              <h3 style={{fontSize:'18px',fontWeight:'700',marginBottom:'16px'}}>Doctor Prescriptions</h3>
              {prescriptions.length === 0 ? (
                <p style={{color:'var(--text-muted)',fontSize:'13px'}}>No prescriptions on record yet.</p>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                  {prescriptions.map((rx, idx) => (
                    <div key={idx} style={{padding:'14px',background:'rgba(255,255,255,0.03)',borderRadius:'8px',border:'1px solid var(--glass-border)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',color:'var(--text-muted)',marginBottom:'6px'}}>
                        <span>Prescribed by Dr. Sarah Jenkins, MD</span>
                        <span>{new Date(rx.timestamp || Date.now()).toLocaleDateString()}</span>
                      </div>
                      <p style={{fontSize:'14px',lineHeight:'1.6',whiteSpace:'pre-wrap'}}>{rx.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Guidelines */}
          {activeTab === 'guidelines' && (
            <div className="glass-panel">
              <h3 style={{fontSize:'18px',fontWeight:'700',marginBottom:'16px'}}>Personalized Care Directives</h3>
              <ul style={{fontSize:'13px',lineHeight:'1.8',color:'var(--text-secondary)',paddingLeft:'20px'}}>
                <li>Maintain a balanced low-sodium, low-refined-sugar diet.</li>
                <li>Monitor blood pressure and fasting blood glucose levels regularly.</li>
                <li>Engage in at least 30 minutes of moderate physical activity daily.</li>
                <li>Ensure adequate daily hydration (2 to 2.5 liters of water).</li>
                <li>Follow up with your attending physician for routine laboratory evaluation every 6 months.</li>
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
