import React, { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronUp, Droplets, ShieldAlert } from 'lucide-react';

export default function KidneyClinicalSummary({ patient, predictions, activeTab }) {
  const [expanded, setExpanded] = useState(true);

  if (!patient || !predictions) return null;

  const cd = patient.clinicalData || {};
  const eGFR = Number(cd.eGFR || 95);
  const creatinine = Number(cd.serumCreatinine || 0.9);
  const urea = Number(cd.urea || 20);
  const uacr = Number(cd.uacr || 5);
  const potassium = Number(cd.potassium || 4.2);
  const sodium = Number(cd.sodium || 138);
  const bp = cd.bp || '120/80';
  const riskScore = predictions.kidneyRisk ?? 0;

  // Derive KDIGO GFR Stage (G1 to G5)
  const getGfrStage = (gfr) => {
    if (gfr >= 90) return { stage: 'G1', label: 'Normal or High', color: 'var(--color-success)', risk: 'Low' };
    if (gfr >= 60) return { stage: 'G2', label: 'Mildly Decreased', color: 'var(--color-success)', risk: 'Low' };
    if (gfr >= 45) return { stage: 'G3a', label: 'Mildly to Moderately Decreased', color: 'var(--color-warning)', risk: 'Moderate' };
    if (gfr >= 30) return { stage: 'G3b', label: 'Moderately to Severely Decreased', color: 'var(--color-warning)', risk: 'High' };
    if (gfr >= 15) return { stage: 'G4', label: 'Severely Decreased', color: 'var(--color-danger)', risk: 'Very High' };
    return { stage: 'G5', label: 'Kidney Failure (ESRD)', color: 'var(--color-danger)', risk: 'Critical' };
  };

  // Derive KDIGO Albuminuria Stage (A1 to A3)
  const getAlbuminuriaStage = (acr) => {
    if (acr < 30) return { stage: 'A1', label: 'Normal to Mildly Increased (< 30 mg/g)', color: 'var(--color-success)' };
    if (acr <= 300) return { stage: 'A2', label: 'Microalbuminuria (30-300 mg/g)', color: 'var(--color-warning)' };
    return { stage: 'A3', label: 'Macroalbuminuria (> 300 mg/g)', color: 'var(--color-danger)' };
  };

  const gfrInfo = getGfrStage(eGFR);
  const acrInfo = getAlbuminuriaStage(uacr);

  const isHighRisk = riskScore > 70 || eGFR < 60 || creatinine > 1.4;
  const isModRisk = riskScore > 40 || uacr > 30 || potassium > 5.0;

  return (
    <div className="glass-panel" style={{ marginBottom: '24px', borderLeft: `4px solid ${gfrInfo.color}` }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', userSelect: 'none',
          paddingBottom: expanded ? '12px' : '0',
          borderBottom: expanded ? '1px solid var(--glass-border)' : 'none',
          marginBottom: expanded ? '16px' : '0',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={18} color={gfrInfo.color} />
          Kidney Health & KDIGO Renal Function Summary
          <span className={`badge ${isHighRisk ? 'badge-danger' : isModRisk ? 'badge-warning' : 'badge-success'}`} style={{ marginLeft: '6px' }}>
            KDIGO Stage {gfrInfo.stage} {acrInfo.stage}
          </span>
        </h3>
        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top 3 Metric Highlight Cards */}
          <div className="grid-3" style={{ gap: '12px' }}>
            <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>eGFR Filtration</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: gfrInfo.color, marginTop: '4px' }}>
                {eGFR} <span style={{ fontSize: '11px', fontWeight: '500' }}>mL/min/1.73m²</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Stage {gfrInfo.stage}: {gfrInfo.label}
              </div>
            </div>

            <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Serum Creatinine</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: creatinine > 1.2 ? 'var(--color-warning)' : 'var(--color-success)', marginTop: '4px' }}>
                {creatinine} <span style={{ fontSize: '11px', fontWeight: '500' }}>mg/dL</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Reference: 0.5 – 1.2 mg/dL ({creatinine <= 1.2 ? 'Normal Clearance' : 'Elevated Retention'})
              </div>
            </div>

            <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>UACR (Albuminuria)</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: acrInfo.color, marginTop: '4px' }}>
                {uacr} <span style={{ fontSize: '11px', fontWeight: '500' }}>mg/g</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Category {acrInfo.stage}: {acrInfo.label}
              </div>
            </div>
          </div>

          {/* Full Renal Biomarkers Grid */}
          <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Droplets size={14} color="var(--accent-secondary)" /> Complete Renal & Electrolyte Laboratory Profile
            </h4>
            <div className="grid-3" style={{ gap: '10px', fontSize: '12px' }}>
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Blood Urea Nitrogen (BUN):</span> <b>{urea} mg/dL</b> <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(Normal: 7-20)</span>
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Serum Potassium (K+):</span> <b style={{ color: potassium > 5.0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>{potassium} mEq/L</b> <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(3.5-5.0)</span>
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Serum Sodium (Na+):</span> <b>{sodium} mEq/L</b> <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(135-145)</span>
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Systolic Blood Pressure:</span> <b>{bp} mmHg</b> <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(Target: &lt;130)</span>
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Peripheral Edema:</span> <b>{cd.symptoms?.includes('swelling') ? 'Present' : 'Absent'}</b>
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Overall Renal Risk Score:</span> <b style={{ color: gfrInfo.color }}>{riskScore}%</b>
              </div>
            </div>
          </div>

          {/* KDIGO Staging Risk Heatmap */}
          <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              KDIGO Clinical Progression Matrix (eGFR vs. Albuminuria)
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <th style={{ padding: '6px', textAlign: 'left' }}>GFR Category</th>
                    <th style={{ padding: '6px' }}>A1 (&lt;30 mg/g)</th>
                    <th style={{ padding: '6px' }}>A2 (30-300 mg/g)</th>
                    <th style={{ padding: '6px' }}>A3 (&gt;300 mg/g)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { cat: 'G1 (≥90)', name: 'G1' },
                    { cat: 'G2 (60-89)', name: 'G2' },
                    { cat: 'G3a (45-59)', name: 'G3a' },
                    { cat: 'G3b (30-44)', name: 'G3b' },
                    { cat: 'G4 (15-29)', name: 'G4' },
                    { cat: 'G5 (<15)', name: 'G5' },
                  ].map((gRow) => {
                    const isSelectedG = gfrInfo.stage === gRow.name;
                    return (
                      <tr key={gRow.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '6px', textAlign: 'left', fontWeight: '600', color: isSelectedG ? 'var(--accent-secondary)' : 'var(--text-primary)' }}>
                          {gRow.cat} {isSelectedG && '◄'}
                        </td>
                        {['A1', 'A2', 'A3'].map((aCol) => {
                          const isMatch = isSelectedG && acrInfo.stage === aCol;
                          const bg = isMatch
                            ? 'var(--accent-primary)'
                            : gRow.name === 'G1' || gRow.name === 'G2'
                            ? (aCol === 'A1' ? 'rgba(16,185,129,0.1)' : aCol === 'A2' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.2)')
                            : 'rgba(239,68,68,0.25)';
                          return (
                            <td key={aCol} style={{ padding: '6px', background: bg, borderRadius: '4px', fontWeight: isMatch ? '800' : '400', color: isMatch ? '#fff' : 'var(--text-primary)' }}>
                              {isMatch ? 'Active Patient' : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Clinical Directives & Dosing Precautions */}
          <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', borderLeft: '4px solid var(--accent-secondary)' }}>
            <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-secondary)', marginBottom: '6px' }}>
              Nephron Clearance & Pharmacotherapy Safety Directives
            </h4>
            <p style={{ fontSize: '12px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
              {eGFR >= 60 && creatinine <= 1.2
                ? `Patient demonstrates normal renal filtration capacity (eGFR ${eGFR} mL/min/1.73m², Serum Creatinine ${creatinine} mg/dL). No renal dose adjustments required for standard pharmacotherapy.`
                : `Renal clearance is compromised (eGFR ${eGFR} mL/min/1.73m², Serum Creatinine ${creatinine} mg/dL). Monitor intraglomerular pressure and adjust medication dosages accordingly.`
              }
              {potassium > 5.0 && ' ⚠️ WARNING: Serum Potassium is elevated (> 5.0 mEq/L). Defer ACEi/ARB initiation until hyperkalemia resolves.'}
              {eGFR < 30 && ' ⚠️ CONTRAINDICATION: Discontinue Metformin due to lactic acidosis risk at eGFR < 30 mL/min.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
