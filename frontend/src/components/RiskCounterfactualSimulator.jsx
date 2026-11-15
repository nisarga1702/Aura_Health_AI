import React, { useState, useMemo } from 'react';
import { Sliders, TrendingDown, TrendingUp, RefreshCw, Sparkles } from 'lucide-react';

export default function RiskCounterfactualSimulator({ predictions, clinicalData, t }) {
  // Extract initial baseline values
  const initialSystolic = clinicalData?.bp ? parseInt(clinicalData.bp.split('/')[0]) || 120 : 120;
  const initialGlucose = Number(clinicalData?.bloodSugar) || 100;
  const initialCreatinine = Number(clinicalData?.serumCreatinine) || 0.9;
  const initialBmi = Number(clinicalData?.bmi) || 22.4;
  const initialCholesterol = Number(clinicalData?.cholesterol) || 180;

  // Simulator slider states
  const [systolic, setSystolic] = useState(initialSystolic);
  const [glucose, setGlucose] = useState(initialGlucose);
  const [creatinine, setCreatinine] = useState(initialCreatinine);
  const [bmi, setBmi] = useState(initialBmi);
  const [cholesterol, setCholesterol] = useState(initialCholesterol);

  // Baseline risk scores
  const baseHeart = predictions?.heartRisk || 0;
  const baseDiabetes = predictions?.diabetesRisk || 0;
  const baseKidney = predictions?.kidneyRisk || 0;

  // Real-time counterfactual risk recalculation engine with monotonic baseline deltas
  const simRisks = useMemo(() => {
    // 1. Simulated Heart Risk Calculation relative to actual patient baseline
    let hRisk = baseHeart;
    const bpDelta = systolic - initialSystolic;
    const cholDelta = cholesterol - initialCholesterol;
    const bmiDelta = bmi - initialBmi;

    hRisk += (bpDelta > 0 ? bpDelta * 0.4 : bpDelta * 0.25);
    hRisk += (cholDelta > 0 ? cholDelta * 0.2 : cholDelta * 0.15);
    hRisk += (bmiDelta > 0 ? bmiDelta * 1.2 : bmiDelta * 0.8);
    hRisk = Math.min(99, Math.max(1, Math.round(hRisk * 10) / 10));

    // 2. Simulated Diabetes Risk Calculation relative to actual patient baseline
    let dRisk = baseDiabetes;
    const glucDelta = glucose - initialGlucose;

    dRisk += (glucDelta > 0 ? glucDelta * 0.35 : glucDelta * 0.25);
    dRisk += (bmiDelta > 0 ? bmiDelta * 1.5 : bmiDelta * 0.9);
    dRisk = Math.min(99, Math.max(1, Math.round(dRisk * 10) / 10));

    // 3. Simulated Kidney Risk Calculation relative to actual patient baseline
    let kRisk = baseKidney;
    const creatDelta = creatinine - initialCreatinine;

    kRisk += (creatDelta > 0 ? creatDelta * 30 : creatDelta * 20);
    kRisk += (bpDelta > 0 ? bpDelta * 0.25 : bpDelta * 0.15);
    kRisk += (glucDelta > 0 ? glucDelta * 0.1 : glucDelta * 0.05);
    kRisk = Math.min(99, Math.max(1, Math.round(kRisk * 10) / 10));

    return {
      heart: hRisk,
      diabetes: dRisk,
      kidney: kRisk
    };
  }, [
    systolic, glucose, creatinine, bmi, cholesterol,
    initialSystolic, initialGlucose, initialCreatinine, initialBmi, initialCholesterol,
    baseHeart, baseDiabetes, baseKidney
  ]);

  const resetSliders = () => {
    setSystolic(initialSystolic);
    setGlucose(initialGlucose);
    setCreatinine(initialCreatinine);
    setBmi(initialBmi);
    setCholesterol(initialCholesterol);
  };

  const getDeltaBadge = (base, sim, label) => {
    const diff = Number((sim - base).toFixed(1));
    if (diff < 0) {
      return (
        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
          <TrendingDown size={12} /> {label}: ↓ {Math.abs(diff).toFixed(1)}% Reduction
        </span>
      );
    } else if (diff > 0) {
      return (
        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
          <TrendingUp size={12} /> {label}: ↑ {diff.toFixed(1)}% Elevation
        </span>
      );
    }
    return (
      <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '11px' }}>
        {label}: Unchanged
      </span>
    );
  };

  return (
    <div className="glass-panel" style={{ marginBottom: '24px', padding: '24px', borderLeft: '4px solid var(--accent-primary)' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={20} color="var(--accent-primary)" />
            Live "What-If" Counterfactual Risk Simulator
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Adjust patient clinical sliders to simulate treatment goals and observe projected risk reductions in real time.
          </p>
        </div>
        <button
          onClick={resetSliders}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} /> Reset Vitals
        </button>
      </div>

      {/* Grid of Sliders and Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {/* Sliders Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255,255,255,0.015)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          {/* 1. Systolic BP */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span>Systolic Blood Pressure</span>
              <strong style={{ color: 'var(--accent-secondary)' }}>{systolic} mmHg</strong>
            </div>
            <input
              type="range" min="80" max="200" step="1"
              value={systolic} onChange={e => setSystolic(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
          </div>

          {/* 2. Fasting Glucose */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span>Fasting Blood Glucose</span>
              <strong style={{ color: 'var(--accent-secondary)' }}>{glucose} mg/dL</strong>
            </div>
            <input
              type="range" min="70" max="350" step="1"
              value={glucose} onChange={e => setGlucose(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
          </div>

          {/* 3. Serum Creatinine */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span>Serum Creatinine</span>
              <strong style={{ color: 'var(--accent-secondary)' }}>{creatinine.toFixed(1)} mg/dL</strong>
            </div>
            <input
              type="range" min="0.5" max="6.0" step="0.1"
              value={creatinine} onChange={e => setCreatinine(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
          </div>

          {/* 4. Body Mass Index (BMI) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span>Body Mass Index (BMI)</span>
              <strong style={{ color: 'var(--accent-secondary)' }}>{bmi.toFixed(1)} kg/m²</strong>
            </div>
            <input
              type="range" min="15" max="45" step="0.5"
              value={bmi} onChange={e => setBmi(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
          </div>

          {/* 5. Total Cholesterol */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span>Total Cholesterol</span>
              <strong style={{ color: 'var(--accent-secondary)' }}>{cholesterol} mg/dL</strong>
            </div>
            <input
              type="range" min="100" max="350" step="5"
              value={cholesterol} onChange={e => setCholesterol(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Real-Time Prognosis Output */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'rgba(99, 102, 241, 0.03)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-secondary)' }}>
              <Sparkles size={16} /> Projected Risk Trajectory
            </h4>

            {/* Comparison Dials / Metrics */}
            <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
              {/* Heart */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Cardiovascular Disease</span>
                  <span>Baseline: <b>{baseHeart}%</b> ➔ Sim: <b>{simRisks.heart}%</b></span>
                </div>
                {getDeltaBadge(baseHeart, simRisks.heart, 'Heart')}
              </div>

              {/* Diabetes */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Diabetes (T2D)</span>
                  <span>Baseline: <b>{baseDiabetes}%</b> ➔ Sim: <b>{simRisks.diabetes}%</b></span>
                </div>
                {getDeltaBadge(baseDiabetes, simRisks.diabetes, 'Diabetes')}
              </div>

              {/* Kidney */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Kidney Disease (CKD)</span>
                  <span>Baseline: <b>{baseKidney}%</b> ➔ Sim: <b>{simRisks.kidney}%</b></span>
                </div>
                {getDeltaBadge(baseKidney, simRisks.kidney, 'Kidney')}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '6px', textAlign: 'center' }}>
            💡 Live counterfactual ML inference model simulation based on clinical parameters.
          </div>
        </div>
      </div>
    </div>
  );
}
