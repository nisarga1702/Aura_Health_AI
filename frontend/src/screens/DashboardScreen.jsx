import React, { useState, useEffect } from 'react';
import { PlusCircle, Database, Activity, RefreshCw, UserCheck, AlertTriangle, ChevronRight, Volume2 } from 'lucide-react';
import { db, syncOfflineData, checkOnlineStatus } from '../db/localDb';
import SpeechReader from '../components/SpeechReader';

export default function DashboardScreen({ user, onNavigate, t, lang }) {
  const [stats, setStats] = useState({ totalPatients: 0, highRiskCount: 0, unsyncedCount: 0 });
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);

  const StatCard = ({ icon, label, value, tag }) => (
    <div className="glass-panel stat-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="stat-icon">{icon}</div>
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{label}</div>
          <div style={{ fontSize: '28px', fontWeight: '800', fontFamily: 'var(--font-display)' }}>{value}</div>
          {tag && <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>{tag}</div>}
        </div>
      </div>
    </div>
  );

  const ActionTile = ({ title, description, icon, onClick, disabled }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="glass-card action-tile"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'rgba(255,255,255,0.06)', display: 'grid', placeItems: 'center' }}>
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: '700', fontSize: '15px' }}>{title}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{description}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tap to open</span>
        <ChevronRight size={18} />
      </div>
    </button>
  );

  // Load stats from local Dexie database
  const loadStats = async () => {
    try {
      const allPatients = await db.patients.toArray();
      const allPredictions = await db.predictions.toArray();
      
      const highRisk = allPredictions.filter(p => p.riskLevel === 'High').length;
      
      // Count unsynced items across all collections
      const unsyncedPatients = await db.patients.where('synced').equals(0).count();
      const unsyncedPredictions = await db.predictions.where('synced').equals(0).count();
      const unsyncedVitals = await db.vitalsBuffer.where('synced').equals(0).count();
      const totalUnsynced = unsyncedPatients + unsyncedPredictions + unsyncedVitals;

      setStats({
        totalPatients: allPatients.length,
        highRiskCount: highRisk,
        unsyncedCount: totalUnsynced
      });
    } catch (e) {
      console.error('Failed to load local DB stats:', e);
    }
  };

  useEffect(() => {
    loadStats();
    
    // Check network connectivity
    checkOnlineStatus().then(setOnline);
    const interval = setInterval(async () => {
      const status = await checkOnlineStatus();
      setOnline(status);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    const result = await syncOfflineData();
    setSyncing(false);
    await loadStats();
    alert(`Sync operation complete. Updated ${result.syncedCount} items to cloud.`);
  };

  // Text details for audio readout
  const audioText = `Welcome to Aura Health AI Dashboard. Currently managing ${stats.totalPatients} local patient files. There are ${stats.highRiskCount} patients flagged as high risk, and ${stats.unsyncedCount} items waiting to synchronize. Click New Patient to begin diagnosing, or view records to review clinical history.`;

  return (
    <div className="container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      
      {/* Active Theory Style Command Center Header */}
      <div className="glass-panel" style={{
        marginBottom: '28px',
        padding: '28px',
        background: 'linear-gradient(135deg, rgba(5, 7, 15, 0.8) 0%, rgba(10, 13, 26, 0.9) 100%)',
        border: '1px solid rgba(0, 242, 254, 0.3)',
        borderRadius: '24px',
        boxShadow: '0 20px 60px rgba(0, 242, 254, 0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', color: '#00f2fe', fontWeight: '800' }}>
              AURA / CLINICAL COMMAND CENTER
            </div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '900',
              letterSpacing: '1px',
              background: 'linear-gradient(135deg, #ffffff 0%, #00f2fe 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginTop: '4px'
            }}>
              PATIENT CARE & MULTIMODAL INTELLIGENCE
            </h1>
          </div>

          <SpeechReader text={audioText} lang={lang} />
        </div>

        {/* Live Command Telemetry Chips */}
        <div style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          paddingTop: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '50px', background: 'rgba(0, 242, 254, 0.1)', border: '1px solid rgba(0, 242, 254, 0.3)' }}>
            <span style={{ fontSize: '12px', color: '#00f2fe', fontWeight: '800' }}>{stats.totalPatients} PATIENTS</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '50px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '800' }}>{stats.highRiskCount} HIGH RISK</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '50px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '800' }}>{stats.unsyncedCount} PENDING SYNC</span>
          </div>
        </div>
      </div>

      {/* Sync and Connection Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: online ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
        border: `1px solid ${online ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
        borderRadius: '12px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: online ? 'var(--color-success)' : 'var(--color-warning)',
            boxShadow: `0 0 10px ${online ? 'var(--color-success)' : 'var(--color-warning)'}`
          }} />
          <span style={{ fontSize: '13px', fontWeight: '500' }}>
            {online ? t.onlineStatus : t.offlineStatus}
          </span>
        </div>
        {stats.unsyncedCount > 0 && (
          <button 
            onClick={handleSync} 
            disabled={syncing || !online}
            className="btn-primary" 
            style={{ padding: '6px 12px', fontSize: '12px', gap: '6px', opacity: online ? 1 : 0.6 }}
          >
            <RefreshCw size={14} className={syncing ? 'glowing-text' : ''} />
            <span>{t.syncButton} ({stats.unsyncedCount})</span>
          </button>
        )}
      </div>

      <div className="section-header" style={{ marginBottom: '20px' }}>
        <div>
          <h3 className="section-title">Live Clinical Command Center</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px' }}>
            Faster review, stronger prediction insights, and easy action across patient flow.
          </p>
        </div>
        <div className="info-pill">
          {online ? 'Connected — Cloud sync ready' : 'Offline mode — local cache active'}
        </div>
      </div>

      <div className="card-grid" style={{ marginBottom: '24px' }}>
        <StatCard
          icon={<UserCheck size={28} />}
          label="Registered Patients"
          value={stats.totalPatients}
          tag="Full patient registry available offline"
        />
        <StatCard
          icon={<AlertTriangle size={28} />}
          label="High Risk Cases"
          value={stats.highRiskCount}
          tag="Review immediately for escalation"
        />
        <StatCard
          icon={<Database size={28} />}
          label="Pending Sync Items"
          value={stats.unsyncedCount}
          tag={online ? 'Sync available now' : 'Will sync when online'}
        />
      </div>

      <div className="grid-2" style={{ marginBottom: '24px', gap: '24px' }}>
        <div className="glass-panel">
          <div className="section-title" style={{ marginBottom: '18px' }}>
            <span>Quick Actions</span>
          </div>
          <div style={{ display: 'grid', gap: '14px' }}>
            <ActionTile
              title={t.newPatient}
              description={user.role === 'nurse' ? 'Doctors only can diagnose.' : 'Create a new patient record and run AI predictions.'}
              icon={<PlusCircle size={20} />}
              onClick={() => onNavigate('newPatient')}
              disabled={user.role === 'nurse'}
            />
            <ActionTile
              title={t.records}
              description="Browse patient histories and prediction logs."
              icon={<Database size={20} color="var(--accent-primary)" />}
              onClick={() => onNavigate('records')}
            />
          </div>
        </div>

        <div className="glass-panel">
          <div className="section-title" style={{ marginBottom: '14px' }}>Patient Risk Distribution</div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '18px' }}>
            Comparative trend summary across heart, diabetes and kidney predictions.
          </p>
          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Heart disease alerts</span><strong style={{ color: 'var(--color-danger)' }}>42%</strong>
              </div>
              <div className="risk-bar"><span style={{ width: '42%', background: 'var(--color-danger)' }} /></div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Diabetes monitoring</span><strong style={{ color: 'var(--color-warning)' }}>28%</strong>
              </div>
              <div className="risk-bar"><span style={{ width: '28%', background: 'var(--color-warning)' }} /></div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Kidney surveillance</span><strong style={{ color: 'var(--color-success)' }}>15%</strong>
              </div>
              <div className="risk-bar"><span style={{ width: '15%', background: 'var(--color-success)' }} /></div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
