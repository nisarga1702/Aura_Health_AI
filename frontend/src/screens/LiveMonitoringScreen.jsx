import React, { useState, useEffect } from 'react';
import { Activity, ArrowLeft, ShieldAlert, Heart, Radio, Play, Pause, Save } from 'lucide-react';
import { db } from '../db/localDb';
import VitalsChart from '../components/VitalsChart';

export default function LiveMonitoringScreen({ onNavigate, t }) {
  const [isActive, setIsActive] = useState(true);
  const [heartRate, setHeartRate] = useState(72);
  const [spo2, setSpo2] = useState(98);
  const [bpSystolic, setBpSystolic] = useState(120);
  const [bpDiastolic, setBpDiastolic] = useState(80);
  
  const [isAlert, setIsAlert] = useState(false);
  const [bufferedPointsCount, setBufferedPointsCount] = useState(0);

  // Load current buffer size
  const updateBufferSize = async () => {
    const count = await db.vitalsBuffer.count();
    setBufferedPointsCount(count);
  };

  useEffect(() => {
    updateBufferSize();
  }, []);

  // Vitals simulation loop
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(async () => {
      // Simulate minor physiologic vital fluctuations
      setHeartRate(prev => {
        const delta = Math.floor(Math.random() * 5) - 2;
        const target = isAlert ? 135 : 74;
        const next = Math.max(50, Math.min(180, prev + (target - prev) * 0.15 + delta));
        return Math.round(next);
      });

      setSpo2(prev => {
        const delta = Math.floor(Math.random() * 3) - 1;
        const target = isAlert ? 89 : 98;
        const next = Math.max(80, Math.min(100, prev + (target - prev) * 0.15 + delta));
        return Math.round(next);
      });

      setBpSystolic(prev => {
        const delta = Math.floor(Math.random() * 7) - 3;
        const target = isAlert ? 155 : 122;
        const next = Math.max(80, Math.min(200, prev + (target - prev) * 0.12 + delta));
        return Math.round(next);
      });

      // Buffer this vital point to local IndexedDB (Offline buffering simulation)
      try {
        await db.vitalsBuffer.add({
          patientId: 'LOCAL-LIVE-MONITOR',
          heartRate,
          spo2,
          bpSystolic,
          bpDiastolic,
          timestamp: new Date().toISOString(),
          synced: 0 // Will sync when online
        });
        updateBufferSize();
      } catch (err) {
        console.error('Failed to buffer vitals offline:', err);
      }

    }, 2000);

    return () => clearInterval(interval);
  }, [isActive, isAlert, heartRate, spo2, bpSystolic, bpDiastolic]);

  const handleAlertTrigger = () => {
    setIsAlert(prev => !prev);
  };

  const handleClearBuffer = async () => {
    await db.vitalsBuffer.clear();
    updateBufferSize();
    alert('Local telemetry buffer cleared.');
  };

  return (
    <div className="container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => onNavigate('dashboard')} className="btn-secondary" style={{ padding: '8px 12px' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '800' }}>{t.liveMonitoring} Telemetry</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              12-Lead streaming interface with local buffering.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setIsActive(!isActive)} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }}>
            {isActive ? <Pause size={14} /> : <Play size={14} />}
            <span>{isActive ? 'Pause Feed' : 'Resume Feed'}</span>
          </button>
          
          <button
            onClick={handleAlertTrigger}
            className="btn-primary"
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              background: isAlert ? 'var(--color-danger)' : 'rgba(239, 68, 68, 0.1)',
              borderColor: 'var(--color-danger)',
              border: '1px solid',
              boxShadow: isAlert ? '0 0 15px rgba(239, 68, 68, 0.5)' : 'none',
              color: isAlert ? '#fff' : 'var(--color-danger)'
            }}
          >
            <ShieldAlert size={14} />
            <span>{isAlert ? 'Disarm Panic Alert' : 'Simulate Vitals Alarm'}</span>
          </button>
        </div>
      </div>

      {/* Real-time ECG Graph */}
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={18} color="var(--accent-secondary)" className={isActive ? 'glowing-text' : ''} />
            <span>ECG Cardiac Stream</span>
          </h3>
          <span style={{ fontSize: '11px', color: isAlert ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: '600', textTransform: 'uppercase' }}>
            {isAlert ? 'Cardiac Tachycardia Warning' : 'Normal Waveform'}
          </span>
        </div>
        
        <VitalsChart heartRate={heartRate} isAlert={isAlert} />
      </div>

      {/* Numeric Vital Displays Grid */}
      <div className="vitals-grid" style={{ marginBottom: '24px' }}>
        
        {/* Heart Rate Display */}
        <div className={`vital-card ${isAlert ? 'danger' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px' }}>
            <span>{t.heartRate}</span>
            <Heart size={14} color="var(--color-danger)" />
          </div>
          <div className="vital-value" style={{ color: isAlert ? 'var(--color-danger)' : 'var(--accent-secondary)' }}>
            {heartRate} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>BPM</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Target: 70-100 Normal</div>
        </div>

        {/* SpO2 Oxygen Display */}
        <div className={`vital-card ${spo2 < 92 ? 'danger' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px' }}>
            <span>{t.oxygen}</span>
            <Activity size={14} color="var(--accent-secondary)" />
          </div>
          <div className="vital-value" style={{ color: spo2 < 92 ? 'var(--color-danger)' : 'var(--color-success)' }}>
            {spo2}%
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Target: 95-100% Optimal</div>
        </div>

        {/* Blood Pressure Display */}
        <div className={`vital-card ${isAlert ? 'warning' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px' }}>
            <span>Blood Pressure</span>
            <ShieldAlert size={14} color="var(--color-warning)" />
          </div>
          <div className="vital-value">
            {bpSystolic}/{bpDiastolic}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>mmHg (Systolic/Diastolic)</div>
        </div>

      </div>

      {/* Offline Buffering Status */}
      <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: '600' }}>Local Telemetry Buffer (Offline-First Storage)</h4>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Currently holding <b>{bufferedPointsCount}</b> data packets locally in browser IndexedDB.
          </p>
        </div>
        <button onClick={handleClearBuffer} className="btn-secondary" style={{ padding: '8px 16px', color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.2)' }}>
          Clear Telemetry Buffer
        </button>
      </div>

    </div>
  );
}
