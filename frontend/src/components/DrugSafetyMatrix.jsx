import React, { useMemo } from 'react';
import { ShieldCheck, ShieldAlert, AlertOctagon, CheckCircle2, AlertTriangle, Sparkles, PlusCircle } from 'lucide-react';

export default function DrugSafetyMatrix({ prescriptionText, clinicalData, onAutoCorrect }) {
  const egfr = Number(clinicalData?.eGFR) || 95;
  const potassium = Number(clinicalData?.potassium) || 4.2;
  const systolic = clinicalData?.bp ? parseInt(clinicalData.bp.split('/')[0]) || 120 : 120;
  const bloodSugar = Number(clinicalData?.bloodSugar) || 100;

  const textLower = (prescriptionText || '').toLowerCase();

  // Evaluated Drug Safety Rules
  const safetyResults = useMemo(() => {
    const alerts = [];

    // Detect drugs in text
    const hasMetformin = textLower.includes('metformin');
    const hasLisinopril = textLower.includes('lisinopril') || textLower.includes('enalapril') || textLower.includes('ramipril');
    const hasLosartan = textLower.includes('losartan') || textLower.includes('valsartan');
    const hasSglt2 = textLower.includes('empagliflozin') || textLower.includes('dapagliflozin') || textLower.includes('sglt2');
    const hasSpironolactone = textLower.includes('spironolactone');
    const hasNsaid = textLower.includes('nsaid') || textLower.includes('ibuprofen') || textLower.includes('naproxen');

    // 1. Metformin + Renal Impairment
    if (hasMetformin) {
      if (egfr < 30) {
        alerts.push({
          type: 'danger',
          drug: 'Metformin',
          title: 'CONTRAINDICATED: Lactic Acidosis Risk',
          detail: `eGFR is ${egfr} mL/min (<30 mL/min). Metformin must be discontinued due to risk of fatal metformin-associated lactic acidosis.`
        });
      } else if (egfr < 45) {
        alerts.push({
          type: 'warning',
          drug: 'Metformin',
          title: 'Dose Reduction & Monitoring Required',
          detail: `eGFR is ${egfr} mL/min (30-44 mL/min). Max dose 1000 mg/day; monitor renal function every 3 months.`
        });
      } else {
        alerts.push({
          type: 'success',
          drug: 'Metformin',
          title: 'Safe & Standard Indication',
          detail: `eGFR ${egfr} mL/min is adequate for standard dosing.`
        });
      }
    }

    // 2. ACEi / ARB + Hyperkalemia & Hypotension
    if (hasLisinopril || hasLosartan) {
      const drugName = hasLisinopril ? 'ACE Inhibitor (Lisinopril)' : 'ARB (Losartan)';
      if (potassium > 5.0) {
        alerts.push({
          type: 'danger',
          drug: drugName,
          title: 'HOLD / CONTRAINDICATED: Hyperkalemia',
          detail: `Serum Potassium is ${potassium} mEq/L (>5.0 mEq/L). RAS inhibition raises potassium; hold therapy until K+ < 5.0 mEq/L.`
        });
      } else if (systolic < 95) {
        alerts.push({
          type: 'warning',
          drug: drugName,
          title: 'Precaution: Low Blood Pressure',
          detail: `Systolic BP is ${systolic} mmHg. Monitor for symptomatic orthostatic hypotension.`
        });
      } else {
        alerts.push({
          type: 'success',
          drug: drugName,
          title: 'Safe Cardiorenal Protection',
          detail: `Potassium ${potassium} mEq/L and BP ${systolic} mmHg are within safe range.`
        });
      }
    }

    // 3. Dual RAS Blockade (ACEi + ARB)
    if (hasLisinopril && hasLosartan) {
      alerts.push({
        type: 'danger',
        drug: 'Lisinopril + Losartan',
        title: 'CONTRAINDICATED: Dual RAS Blockade',
        detail: 'Combining ACE Inhibitors with ARBs increases risk of severe hypotension, syncope, hyperkalemia, and acute kidney injury without added benefit.'
      });
    }

    // 4. SGLT2 Inhibitor + Renal Status
    if (hasSglt2) {
      if (egfr < 20) {
        alerts.push({
          type: 'warning',
          drug: 'SGLT2 Inhibitor',
          title: 'Reduced Glycemic Efficacy',
          detail: `eGFR is ${egfr} mL/min (<20 mL/min). Glycemic lowering is blunted, though renoprotection may persist.`
        });
      } else {
        alerts.push({
          type: 'success',
          drug: 'SGLT2 Inhibitor',
          title: 'Renoprotective & Cardioprotective',
          detail: `Indicated for T2D with CKD/cardiovascular protection.`
        });
      }
    }

    // 5. NSAID Nephrotoxicity
    if (hasNsaid && egfr < 60) {
      alerts.push({
        type: 'danger',
        drug: 'NSAIDs (Ibuprofen)',
        title: 'CONTRAINDICATED: Acute Renal Decline',
        detail: `eGFR is ${egfr} mL/min (<60 mL/min). NSAIDs inhibit renal prostaglandins, predisposing to acute tubular injury and fluid retention.`
      });
    }

    return alerts;
  }, [textLower, egfr, potassium, systolic, bloodSugar]);

  const hasDanger = safetyResults.some(a => a.type === 'danger');
  const hasWarning = safetyResults.some(a => a.type === 'warning');

  const addDrug = (drugString) => {
    const existingLines = (prescriptionText || '').split('\n').map(l => l.trim()).filter(Boolean);
    const drugBase = drugString.split(' ')[0].toLowerCase();
    const alreadyPresent = existingLines.some(l => l.toLowerCase().includes(drugBase));
    if (!alreadyPresent) {
      existingLines.push(drugString);
    }
    onAutoCorrect(existingLines.join('\n'));
  };

  const generateAutoCorrection = () => {
    let corrected = prescriptionText || '';

    if (textLower.includes('metformin') && egfr < 30) {
      corrected = corrected.replace(/metformin[^\n]*/gi, 'Empagliflozin 10 mg orally once daily (Metformin discontinued due to eGFR < 30)');
    }
    if ((textLower.includes('lisinopril') || textLower.includes('losartan')) && potassium > 5.0) {
      corrected = corrected.replace(/(lisinopril|losartan)[^\n]*/gi, 'Amlodipine 5 mg orally daily (RAS inhibitor held due to K+ > 5.0 mEq/L)');
    }
    if (textLower.includes('lisinopril') && textLower.includes('losartan')) {
      corrected = corrected.replace(/losartan[^\n]*/gi, '');
    }
    if (textLower.includes('nsaid') || textLower.includes('ibuprofen')) {
      corrected = corrected.replace(/(nsaid|ibuprofen)[^\n]*/gi, 'Acetaminophen 500 mg orally as needed for pain (NSAID avoided in renal impairment)');
    }

    const lines = corrected.split('\n').map(l => l.trim()).filter(Boolean);
    const uniqueLines = Array.from(new Set(lines));
    onAutoCorrect(uniqueLines.join('\n'));
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '18px', marginTop: '16px' }}>
      
      {/* Guardrail Header & Auto-Fix Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <h4 style={{ fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasDanger ? (
            <AlertOctagon size={18} color="var(--color-danger)" />
          ) : hasWarning ? (
            <AlertTriangle size={18} color="var(--color-warning)" />
          ) : (
            <ShieldCheck size={18} color="var(--color-success)" />
          )}
          Drug-Drug & Drug-Disease Interaction Safety Guardrail
        </h4>

        {hasDanger && (
          <button
            onClick={generateAutoCorrection}
            className="btn-primary"
            style={{ padding: '6px 12px', fontSize: '11px', background: 'var(--color-danger)', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <Sparkles size={13} /> Auto-Adjust Prescriptions for Safety
          </button>
        )}
      </div>

      {/* Interactive Quick Selector & Test Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <PlusCircle size={14} /> Quick Select Medication:
        </span>
        
        <select
          className="input-field"
          style={{ width: 'auto', fontSize: '12px', padding: '5px 10px', minWidth: '220px' }}
          onChange={(e) => {
            if (e.target.value) {
              addDrug(e.target.value);
              e.target.value = '';
            }
          }}
        >
          <option value="">Choose a drug to screen…</option>
          <option value="Metformin 1000 mg twice daily">Metformin 1000 mg (Diabetes)</option>
          <option value="Lisinopril 10 mg once daily">Lisinopril 10 mg (ACEi / Hypertension)</option>
          <option value="Losartan 50 mg once daily">Losartan 50 mg (ARB / Hypertension)</option>
          <option value="Empagliflozin 10 mg once daily">Empagliflozin 10 mg (SGLT2i)</option>
          <option value="Spironolactone 25 mg daily">Spironolactone 25 mg (Potassium Sparing)</option>
          <option value="Ibuprofen 400 mg as needed">Ibuprofen 400 mg (NSAID Pain Relief)</option>
          <option value="Atorvastatin 20 mg at bedtime">Atorvastatin 20 mg (Statin Lipid Control)</option>
          <option value="Amlodipine 5 mg once daily">Amlodipine 5 mg (CCB Hypertension)</option>
        </select>

        {/* Quick Chips */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => addDrug('Metformin 1000 mg')} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '11px' }}>+ Metformin</button>
          <button type="button" onClick={() => addDrug('Lisinopril 10 mg')} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '11px' }}>+ Lisinopril</button>
          <button type="button" onClick={() => addDrug('Losartan 50 mg')} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '11px' }}>+ Losartan</button>
          <button type="button" onClick={() => addDrug('Ibuprofen 400 mg')} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '11px' }}>+ Ibuprofen</button>
        </div>
      </div>

      {/* Safety Results List */}
      {safetyResults.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
          Use the <b>Quick Select Dropdown</b> above, click any drug chip, or type inside the prescription box to run automated safety screening.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {safetyResults.map((item, i) => {
            const isDanger = item.type === 'danger';
            const isWarning = item.type === 'warning';
            const badgeBg = isDanger ? 'rgba(239,68,68,0.1)' : isWarning ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)';
            const borderCol = isDanger ? 'var(--color-danger)' : isWarning ? 'var(--color-warning)' : 'var(--color-success)';

            return (
              <div
                key={i}
                style={{
                  padding: '12px 14px', borderRadius: '8px', background: badgeBg,
                  borderLeft: `4px solid ${borderCol}`, fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '700', color: borderCol, marginBottom: '4px' }}>
                  <span>{item.drug} — {item.title}</span>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', background: borderCol, color: '#fff' }}>
                    {item.type}
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  {item.detail}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
