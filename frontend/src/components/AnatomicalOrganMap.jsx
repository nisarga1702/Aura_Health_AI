import React, { useState } from 'react';
import { Activity, ShieldAlert, Heart, Zap, Info, X } from 'lucide-react';

export default function AnatomicalOrganMap({ predictions, clinicalData, patient, t }) {
  const [selectedOrgan, setSelectedOrgan] = useState(null);

  const heartRisk = predictions?.heartRisk || 0;
  const diabetesRisk = predictions?.diabetesRisk || 0;
  const kidneyRisk = predictions?.kidneyRisk || 0;

  const getRiskColor = (score) => {
    if (score >= 70) return 'hsl(355, 85%, 55%)';
    if (score >= 40) return 'hsl(40, 95%, 55%)';
    return 'hsl(145, 80%, 45%)';
  };

  const getRiskLevelName = (score) => {
    if (score >= 70) return 'HIGH STRESS';
    if (score >= 40) return 'MODERATE STRESS';
    return 'OPTIMAL / LOW STRESS';
  };

  const organData = {
    heart: {
      name: 'Cardiovascular System (Heart)',
      risk: heartRisk,
      color: getRiskColor(heartRisk),
      level: getRiskLevelName(heartRisk),
      biomarkers: [
        { name: 'Blood Pressure', val: clinicalData?.bp || '120/80', target: '90-120 mmHg' },
        { name: 'Total Cholesterol', val: (clinicalData?.cholesterol || 180) + ' mg/dL', target: '< 200 mg/dL' },
        { name: 'LDL Cholesterol', val: (clinicalData?.ldl || 115) + ' mg/dL', target: '< 100 mg/dL' }
      ],
      description: 'The cardiovascular system shows arterial workload and coronary perfusion pressure status based on lipid and systolic BP dynamics.'
    },
    pancreas: {
      name: 'Endocrine & Metabolic System (Pancreas)',
      risk: diabetesRisk,
      color: getRiskColor(diabetesRisk),
      level: getRiskLevelName(diabetesRisk),
      biomarkers: [
        { name: 'Fasting Glucose', val: (clinicalData?.bloodSugar || 100) + ' mg/dL', target: '70-100 mg/dL' },
        { name: 'HbA1c', val: (clinicalData?.hba1c || 5.4) + '%', target: '< 5.7%' },
        { name: 'BMI', val: (clinicalData?.bmi || 22.4) + ' kg/m²', target: '18.5-24.9' }
      ],
      description: 'Endocrine beta-cell glucose regulation and peripheral insulin sensitivity index.'
    },
    kidney: {
      name: 'Renal & Excretory System (Kidneys)',
      risk: kidneyRisk,
      color: getRiskColor(kidneyRisk),
      level: getRiskLevelName(kidneyRisk),
      biomarkers: [
        { name: 'Serum Creatinine', val: (clinicalData?.serumCreatinine || 0.9) + ' mg/dL', target: '0.5-1.2 mg/dL' },
        { name: 'eGFR', val: (clinicalData?.eGFR || 95) + ' mL/min', target: '> 90 mL/min' },
        { name: 'Blood Urea', val: (clinicalData?.urea || 20) + ' mg/dL', target: '7-20 mg/dL' },
        { name: 'Potassium', val: (clinicalData?.potassium || 4.2) + ' mEq/L', target: '3.5-5.0 mEq/L' }
      ],
      description: 'Glomerular filtration efficiency, nitrogenous waste clearance, and tubule electrolyte balance.'
    }
  };

  return (
    <div className="glass-panel" style={{ marginBottom: '24px', padding: '24px', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={20} color="var(--accent-secondary)" />
            3D Anatomical Organ Health Map
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Interactive organ stress visualization. Click any organ for biomarker breakdown.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'hsl(145, 80%, 45%)' }}></span> Low
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'hsl(40, 95%, 55%)' }}></span> Moderate
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'hsl(355, 85%, 55%)' }}></span> High Stress
          </span>
        </div>
      </div>

      {/* SVG Body & Organ Canvas */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: 'rgba(255,255,255,0.01)', borderRadius: '16px', border: '1px solid var(--glass-border)',
        padding: '24px 12px', minHeight: '340px', position: 'relative'
      }}>

        <svg viewBox="0 0 400 400" width="100%" height="320" style={{ maxWidth: '420px' }}>
          {/* Subtle Body Outline Contour */}
          <path
            d="M 200,30 C 230,30 250,55 240,85 C 265,95 285,120 280,160 C 275,200 265,240 255,290 C 250,320 240,370 230,390 L 170,390 C 160,370 150,320 145,290 C 135,240 125,200 120,160 C 115,120 135,95 160,85 C 150,55 170,30 200,30 Z"
            fill="rgba(99, 102, 241, 0.03)"
            stroke="rgba(99, 102, 241, 0.15)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* 1. HEART ORGAN (Chest Left-Center) */}
          <g
            onClick={() => setSelectedOrgan(organData.heart)}
            style={{ cursor: 'pointer' }}
          >
            {/* Pulse Outer Ring */}
            <circle cx="215" cy="135" r="34" fill="none" stroke={organData.heart.color} strokeWidth="1.5" opacity="0.4">
              <animate attributeName="r" values="30;42;30" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
            </circle>

            {/* Heart Path */}
            <path
              d="M 215,145 C 215,145 195,130 195,118 C 195,108 203,102 212,106 C 215,108 215,108 215,108 C 215,108 215,108 218,106 C 227,102 235,108 235,118 C 235,130 215,145 215,145 Z"
              fill={organData.heart.color}
              stroke="#ffffff"
              strokeWidth="1.5"
              style={{
                filter: `drop-shadow(0 0 10px ${organData.heart.color})`,
                transition: 'all 0.3s'
              }}
            />
            <text x="215" y="163" textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="700">
              Heart ({heartRisk}%)
            </text>
          </g>

          {/* 2. PANCREAS / METABOLIC ORGAN (Mid Abdomen) */}
          <g
            onClick={() => setSelectedOrgan(organData.pancreas)}
            style={{ cursor: 'pointer' }}
          >
            <ellipse cx="200" cy="195" rx="30" ry="12" fill={organData.pancreas.color} stroke="#ffffff" strokeWidth="1.5"
              style={{
                filter: `drop-shadow(0 0 10px ${organData.pancreas.color})`,
                transition: 'all 0.3s'
              }}
            />
            <text x="200" y="222" textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="700">
              Pancreas ({diabetesRisk}%)
            </text>
          </g>

          {/* 3. LEFT & RIGHT KIDNEYS (Flanks) */}
          <g
            onClick={() => setSelectedOrgan(organData.kidney)}
            style={{ cursor: 'pointer' }}
          >
            {/* Left Kidney */}
            <path
              d="M 165,240 C 150,240 150,265 165,270 C 172,270 172,240 165,240 Z"
              fill={organData.kidney.color} stroke="#ffffff" strokeWidth="1.5"
              style={{ filter: `drop-shadow(0 0 8px ${organData.kidney.color})` }}
            />
            {/* Right Kidney */}
            <path
              d="M 235,240 C 250,240 250,265 235,270 C 228,270 228,240 235,240 Z"
              fill={organData.kidney.color} stroke="#ffffff" strokeWidth="1.5"
              style={{ filter: `drop-shadow(0 0 8px ${organData.kidney.color})` }}
            />
            <text x="200" y="288" textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="700">
              Kidneys ({kidneyRisk}%)
            </text>
          </g>

          {/* Connecting Neural/Vascular Lines */}
          <line x1="215" y1="145" x2="200" y2="183" stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
          <line x1="200" y1="207" x2="200" y2="240" stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
        </svg>

        {/* Quick Organ Selection Cards on the Side */}
        <div style={{ position: 'absolute', right: '16px', top: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(organData).map(([key, item]) => (
            <button
              key={key}
              onClick={() => setSelectedOrgan(item)}
              className="glass-card"
              style={{
                padding: '8px 12px', fontSize: '11px', textAlign: 'left',
                borderLeft: `4px solid ${item.color}`, background: 'rgba(255,255,255,0.03)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
              }}
            >
              <span>{key.toUpperCase()}</span>
              <b style={{ color: item.color }}>{item.risk}%</b>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Organ Detail Modal */}
      {selectedOrgan && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px'
        }}>
          <div className="glass-panel" style={{ width: 'min(500px, 92vw)', padding: '24px', borderTop: `4px solid ${selectedOrgan.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span className="badge" style={{ background: `${selectedOrgan.color}22`, color: selectedOrgan.color, border: `1px solid ${selectedOrgan.color}` }}>
                  {selectedOrgan.level} ({selectedOrgan.risk}%)
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: '800', marginTop: '6px' }}>{selectedOrgan.name}</h3>
              </div>
              <button onClick={() => setSelectedOrgan(null)} className="btn-secondary" style={{ padding: '6px 10px' }}><X size={16} /></button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: '1.6' }}>
              {selectedOrgan.description}
            </p>

            <h5 style={{ fontSize: '12px', fontWeight: '700', marginBottom: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Primary Biomarker Status & Targets
            </h5>

            <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
              {selectedOrgan.biomarkers.map((b, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)', fontSize: '12px'
                }}>
                  <span>{b.name}</span>
                  <div>
                    <strong style={{ color: 'var(--accent-secondary)', marginRight: '8px' }}>{b.val}</strong>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(Target: {b.target})</span>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedOrgan(null)} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Close Organ Insight
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
