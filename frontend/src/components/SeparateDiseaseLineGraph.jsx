import React, { useState } from 'react';
import { Activity, Heart, Sparkles, AlertCircle, Info, Table } from 'lucide-react';

export default function SeparateDiseaseLineGraph({ diseaseKey, score, clinicalData, isPrint = false }) {
  const [hoveredNode, setHoveredNode] = useState(null);

  // Helper to determine severity color & badge based on score
  const getSeverity = (val) => {
    if (val >= 90) return { label: 'Critical (90-100)', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)', border: '#dc2626' };
    if (val >= 70) return { label: 'High (70-89)', color: '#f97316', bg: 'rgba(249, 115, 22, 0.2)', border: '#ea580c' };
    if (val >= 40) return { label: 'Medium (40-69)', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)', border: '#d97706' };
    return { label: 'Low (0-39)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)', border: '#059669' };
  };

  const sysBP = parseInt((clinicalData?.bp || '120/80').split('/')[0]) || 120;
  const chol = Number(clinicalData?.cholesterol) || 180;
  const sugar = Number(clinicalData?.bloodSugar) || 100;
  const hba1c = Number(clinicalData?.hba1c) || 5.4;
  const bmi = Number(clinicalData?.bmi) || 24.2;
  const sc = Number(clinicalData?.serumCreatinine) || 0.9;
  const egfr = Number(clinicalData?.eGFR) || 95;

  const configs = {
    heart: {
      title: 'Chronological Cardiovascular Risk Progression',
      subtitle: 'Smooth Connected Clinical Biomarker Timeline',
      icon: <Heart size={20} color="#ef4444" />,
      timeline: [
        { time: '09:00:00', event: 'Baseline Demographics', source: 'Patient Intake', score: 12, desc: 'Initial baseline cardiovascular state.' },
        { time: '09:10:00', event: 'Resting Heart Rate', source: '72 bpm (Normal)', score: 15, desc: 'Normal resting sinus heart rate.' },
        { time: '09:20:00', event: 'Systolic BP Measure', source: `${sysBP} mmHg`, score: Math.min(99, Math.round((sysBP / 180) * 100)), desc: 'Arterial contraction pressure.' },
        { time: '09:30:00', event: 'Serum Cholesterol Lab', source: `${chol} mg/dL`, score: Math.min(99, Math.round((chol / 300) * 100)), desc: 'Total circulating blood lipid concentration.' },
        { time: '09:40:00', event: '12-Lead ECG Segment', source: 'Normal Sinus Rhythm', score: 18, desc: 'Conduction symmetry without ST-segment elevation.' },
        { time: '09:50:00', event: 'Troponin T Assay', source: '< 0.01 ng/mL', score: 14, desc: 'Cardiac tissue ischemic injury marker.' },
        { time: '10:00:00', event: 'Calculated Cardiac Workload', source: `${Math.round(sysBP * 0.72)} Index`, score: Math.round(score * 0.85), desc: 'Rate pressure product estimate.' },
        { time: '10:15:00', event: 'Final PSO Projected Risk', source: 'Ensemble Model Output', score: score, desc: '10-year major adverse cardiac event probability.' }
      ]
    },
    diabetes: {
      title: 'Chronological Diabetes Mellitus Timeline',
      subtitle: 'Smooth Connected Glycemic Progression Timeline',
      icon: <Sparkles size={20} color="#06b6d4" />,
      timeline: [
        { time: '09:00:00', event: 'Fasting Intake Stage', source: 'Standard Baseline', score: 10, desc: 'Baseline metabolic homeostasis.' },
        { time: '09:12:00', event: 'Fasting Plasma Glucose', source: `${sugar} mg/dL`, score: Math.min(99, Math.round((sugar / 250) * 100)), desc: 'Overnight fasting plasma sugar level.' },
        { time: '09:25:00', event: 'Glycated HbA1c Assay', source: `${hba1c}%`, score: Math.min(99, Math.round((hba1c / 12) * 100)), desc: '3-month average glycemic index.' },
        { time: '09:38:00', event: 'Body Mass Index (BMI)', source: `${bmi} kg/m²`, score: Math.min(99, Math.round((bmi / 40) * 100)), desc: 'Peripheral tissue adiposity & insulin resistance factor.' },
        { time: '09:50:00', event: 'Postprandial Glucose', source: `${Math.round(sugar * 1.25)} mg/dL`, score: Math.min(99, Math.round((sugar * 1.25 / 250) * 100)), desc: 'Post-meal glucose clearance rate.' },
        { time: '10:05:00', event: 'Serum Insulin Level', source: '12 µIU/mL', score: 22, desc: 'Pancreatic beta-cell insulin secretion.' },
        { time: '10:15:00', event: 'Metabolic Workload Index', source: 'HOMA-IR 1.8', score: Math.round(score * 0.9), desc: 'Calculated insulin resistance score.' },
        { time: '10:30:00', event: 'Final PSO Diabetes Risk', source: 'Ensemble Model Output', score: score, desc: 'Type-2 Diabetes onset risk probability.' }
      ]
    },
    kidney: {
      title: 'Chronological Renal Function Progression',
      subtitle: 'Smooth Connected Nephron Filtration Timeline',
      icon: <Activity size={20} color="#10b981" />,
      timeline: [
        { time: '09:00:00', event: 'Renal Baseline Stage', source: 'Structural Baseline', score: 15, desc: 'Baseline nephron structural integrity.' },
        { time: '09:15:00', event: 'Serum Creatinine Lab', source: `${sc} mg/dL`, score: Math.min(99, Math.round((sc / 4.0) * 100)), desc: 'Glomerular filtration waste accumulation.' },
        { time: '09:30:00', event: 'Estimated GFR Clearance', source: `${egfr} mL/min/1.73m²`, score: Math.max(5, Math.round(100 - egfr)), desc: 'Functional nephron clearance rate.' },
        { time: '09:45:00', event: 'Blood Urea Nitrogen (BUN)', source: '14 mg/dL', score: 18, desc: 'Nitrogenous protein metabolic waste level.' },
        { time: '10:00:00', event: 'BUN / Creatinine Ratio', source: `${(14 / (sc + 0.001)).toFixed(1)} Ratio`, score: 20, desc: 'Renal perfusion vs tubular injury ratio.' },
        { time: '10:15:00', event: 'Urine Albumin / SC Ratio', source: '18 mg/g (Normal)', score: 16, desc: 'Glomerular membrane permeability indicator.' },
        { time: '10:30:00', event: 'Renal Hemodynamic Stress', source: `${Math.round(sysBP * sc)} Index`, score: Math.round(score * 0.9), desc: 'Intraglomerular capillary pressure workload.' },
        { time: '10:45:00', event: 'Final PSO Kidney Risk', source: 'Ensemble Model Output', score: score, desc: 'Chronic Kidney Disease (CKD) risk probability.' }
      ]
    }
  };

  const cfg = configs[diseaseKey] || configs.heart;

  // Chart dimensions
  const width = 680;
  const height = isPrint ? 220 : 270;
  const paddingLeft = 55;
  const paddingRight = 35;
  const paddingTop = 40;
  const paddingBottom = 65;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const yTicks = [100, 80, 60, 40, 20, 0];

  // Map timeline events into X and Y graph coordinates
  const points = cfg.timeline.map((item, idx) => {
    const x = paddingLeft + (idx / (cfg.timeline.length - 1)) * innerWidth;
    const y = paddingTop + ((100 - item.score) / 100) * innerHeight;
    const severity = getSeverity(item.score);
    return { ...item, x, y, severity };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div
      className={isPrint ? "" : "glass-panel"}
      style={{
        padding: isPrint ? '12px' : '22px',
        marginBottom: '24px',
        background: isPrint ? '#ffffff' : '#090d16',
        border: isPrint ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: isPrint ? '8px' : '12px',
        color: isPrint ? '#0f172a' : '#f8fafc',
        position: 'relative',
        boxShadow: isPrint ? 'none' : '0 10px 30px rgba(0, 0, 0, 0.4)'
      }}
    >
      {/* GRAPH HEADER WITH SEVERITY LEGEND (Matching User's Reference Image!) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {cfg.icon}
          </div>
          <div>
            <h3 style={{ fontSize: isPrint ? '14px' : '17px', fontWeight: '800', margin: 0, color: isPrint ? '#0f172a' : '#ffffff', letterSpacing: '-0.2px' }}>
              📈 {cfg.title}
            </h3>
            <p style={{ fontSize: isPrint ? '10px' : '11px', color: isPrint ? '#64748b' : '#94a3b8', margin: '2px 0 0 0' }}>
              {cfg.subtitle}
            </p>
          </div>
        </div>

        {/* Severity Legend (Low 0-39, Medium 40-69, High 70-89, Critical 90-100) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: isPrint ? '#f1f5f9' : 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '6px', border: isPrint ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.08)', fontSize: '10px' }}>
          <span style={{ fontWeight: '700', color: isPrint ? '#334155' : '#cbd5e1', marginRight: '2px' }}>Severity Legend:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: isPrint ? '#065f46' : '#94a3b8' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} /> Low (0–39)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: isPrint ? '#92400e' : '#94a3b8' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} /> Medium (40–69)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: isPrint ? '#9a3412' : '#94a3b8' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }} /> High (70–89)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: isPrint ? '#991b1b' : '#94a3b8' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} /> Critical (90–100)
          </span>
        </div>
      </div>

      {/* Floating Interactive Tooltip Card on Point Hover */}
      {hoveredNode && !isPrint && (
        <div
          style={{
            position: 'absolute',
            top: '65px',
            right: '25px',
            zIndex: 20,
            background: 'rgba(11, 17, 32, 0.95)',
            border: `1.5px solid ${hoveredNode.severity.color}`,
            borderRadius: '8px',
            padding: '10px 14px',
            maxWidth: '260px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(10px)',
            color: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: hoveredNode.severity.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Info size={13} /> {hoveredNode.event}
            </span>
            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: hoveredNode.severity.bg, color: hoveredNode.severity.color, fontWeight: '700' }}>
              {hoveredNode.severity.label}
            </span>
          </div>
          <div style={{ fontSize: '11px', marginBottom: '3px' }}>
            <b>Time:</b> {hoveredNode.time} | <b>Value:</b> {hoveredNode.source}
          </div>
          <div style={{ fontSize: '10px', color: '#cbd5e1', lineHeight: '1.4' }}>
            <b>Clinical Note:</b> {hoveredNode.desc}
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px' }}>
            Risk Score: <b style={{ color: hoveredNode.severity.color }}>{hoveredNode.score} / 100</b>
          </div>
        </div>
      )}

      {/* MAIN SVG LINE GRAPH (Matching Cyan Glowing Trajectory & Slanted X-Labels!) */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: '550px', overflow: 'visible' }}>
          
          {/* Y-Axis Gridlines & Tick Labels */}
          {yTicks.map(tick => {
            const yPos = paddingTop + ((100 - tick) / 100) * innerHeight;
            return (
              <g key={tick}>
                {/* Horizontal Grid Line */}
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={width - paddingRight}
                  y2={yPos}
                  stroke={tick === 70 ? (isPrint ? 'rgba(249,115,22,0.4)' : 'rgba(249,115,22,0.3)') : tick === 40 ? (isPrint ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.2)') : (isPrint ? '#e2e8f0' : 'rgba(255,255,255,0.06)')}
                  strokeDasharray={tick === 70 || tick === 40 ? "4 4" : "none"}
                  strokeWidth="1"
                />
                {/* Y-Axis Tick Label */}
                <text
                  x={paddingLeft - 10}
                  y={yPos + 4}
                  textAnchor="end"
                  fontSize={isPrint ? "9" : "10"}
                  fill={isPrint ? "#64748b" : "#94a3b8"}
                  fontWeight="600"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Y-AXIS LINE */}
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={height - paddingBottom}
            stroke={isPrint ? "#0f172a" : "#475569"}
            strokeWidth="2.5"
          />

          {/* X-AXIS LINE */}
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke={isPrint ? "#0f172a" : "#475569"}
            strokeWidth="2.5"
          />

          {/* Y-AXIS TITLE */}
          <text
            x={14}
            y={height / 2 - 10}
            transform={`rotate(-90 14 ${height / 2 - 10})`}
            textAnchor="middle"
            fontSize={isPrint ? "9" : "10"}
            fontWeight="700"
            fill={isPrint ? "#334155" : "#cbd5e1"}
          >
            Disease Risk Score (0–100)
          </text>

          {/* X-AXIS TITLE */}
          <text
            x={width / 2}
            y={height - 5}
            textAnchor="middle"
            fontSize={isPrint ? "9" : "10"}
            fontWeight="700"
            fill={isPrint ? "#334155" : "#cbd5e1"}
          >
            Biomarker Progression Timeline (HH:MM:SS)
          </text>

          {/* GLOWING CYAN CONNECTED LINE TRAJECTORY (Exact match to reference image!) */}
          <polyline
            fill="none"
            stroke={isPrint ? "#0284c7" : "#00f2fe"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
            filter={isPrint ? "none" : "drop-shadow(0px 0px 6px rgba(0, 242, 254, 0.6))"}
          />

          {/* COLOR-CODED SEVERITY CIRCLE NODES & SLANTED X-LABELS */}
          {points.map((pt, i) => {
            const isHovered = hoveredNode?.time === pt.time;
            return (
              <g
                key={`p-${i}`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredNode(pt)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Touch/Hover Buffer */}
                <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />

                {/* Vertical Drop Line to X-Axis */}
                <line
                  x1={pt.x}
                  y1={pt.y}
                  x2={pt.x}
                  y2={height - paddingBottom}
                  stroke={isPrint ? "#e2e8f0" : "rgba(255,255,255,0.08)"}
                  strokeDasharray="2 2"
                />

                {/* Outer Node Ring */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? "8" : "6"}
                  fill={pt.severity.color}
                  stroke={isPrint ? "#ffffff" : "#090d16"}
                  strokeWidth="2"
                  style={{ transition: 'all 0.2s' }}
                />

                {/* Node Score Tag above Circle */}
                <text
                  x={pt.x}
                  y={pt.y - 10}
                  textAnchor="middle"
                  fontSize={isPrint ? "8" : "9"}
                  fontWeight="800"
                  fill={isHovered ? "#ffffff" : pt.severity.color}
                >
                  {pt.score}
                </text>

                {/* SLANTED X-AXIS TIMESTAMPS (Rotated -45 degrees, matching reference image!) */}
                <g transform={`translate(${pt.x}, ${height - paddingBottom + 12}) rotate(-40)`}>
                  <text
                    x="0"
                    y="0"
                    textAnchor="end"
                    fontSize={isPrint ? "8" : "9"}
                    fontWeight={isHovered ? "800" : "600"}
                    fill={isHovered ? "#00f2fe" : isPrint ? "#475569" : "#94a3b8"}
                  >
                    {pt.time}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* CATEGORY EVIDENCE TABLE (Matching "Category Evidence Table" in Reference Image 2!) */}
      <div style={{ marginTop: '20px', borderTop: isPrint ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: isPrint ? '11px' : '12px', fontWeight: '800', color: isPrint ? '#0f172a' : '#ffffff', marginBottom: '10px' }}>
          <Table size={14} color="#00f2fe" />
          <span>Category Clinical Evidence Table ({cfg.title})</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isPrint ? '9.5px' : '11px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: isPrint ? '#f1f5f9' : 'rgba(255,255,255,0.04)', color: isPrint ? '#475569' : '#94a3b8', borderBottom: isPrint ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '8px 10px', fontWeight: '700' }}>Timestamp</th>
                <th style={{ padding: '8px 10px', fontWeight: '700' }}>Biomarker / Event Name</th>
                <th style={{ padding: '8px 10px', fontWeight: '700' }}>Source Measurement</th>
                <th style={{ padding: '8px 10px', fontWeight: '700' }}>Risk Score</th>
                <th style={{ padding: '8px 10px', fontWeight: '700' }}>Severity Status</th>
              </tr>
            </thead>
            <tbody>
              {points.map((row, idx) => (
                <tr
                  key={idx}
                  onMouseEnter={() => setHoveredNode(row)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{
                    borderBottom: isPrint ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.04)',
                    background: hoveredNode?.time === row.time ? (isPrint ? '#f8fafc' : 'rgba(0, 242, 254, 0.06)') : 'transparent',
                    transition: 'background 0.2s'
                  }}
                >
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: isPrint ? '#334155' : '#cbd5e1' }}>{row.time}</td>
                  <td style={{ padding: '8px 10px', fontWeight: '600', color: isPrint ? '#0f172a' : '#ffffff' }}>{row.event}</td>
                  <td style={{ padding: '8px 10px', color: isPrint ? '#475569' : '#94a3b8' }}>{row.source}</td>
                  <td style={{ padding: '8px 10px', fontWeight: '800', color: row.severity.color }}>{row.score} / 100</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '9.5px',
                      fontWeight: '700',
                      background: row.severity.bg,
                      color: row.severity.color,
                      border: `1px solid ${row.severity.border}`
                    }}>
                      {row.severity.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
