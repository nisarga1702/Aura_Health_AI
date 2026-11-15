import React, { useState, useEffect } from 'react';
import { Shield, Activity, Lock, User, Globe, KeyRound, Scan, Mic, Camera, CheckCircle, RefreshCw, Sparkles, Layout } from 'lucide-react';
import ActiveTheoryLanding from '../components/ActiveTheoryLanding';

export default function LoginScreen({ onLogin, activeLang, setLang, t }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showDemoInfo, setShowDemoInfo] = useState(false);
  const [viewMode, setViewMode] = useState('login'); // 'login' or 'presentation'

  // Biometric simulation state
  const [bioType, setBioType] = useState(null); // 'face' or 'voice'
  const [bioStep, setBioStep] = useState(0);
  const [bioProgress, setBioProgress] = useState(0);

  // Infer the role automatically based on username
  const inferredRole = (() => {
    const lowerUser = username.trim().toLowerCase();
    if (!lowerUser) return '';
    if (lowerUser === 'doctor' || lowerUser === 'doc_1' || lowerUser === 'doc_2') return 'doctor';
    if (lowerUser === 'nurse' || lowerUser.startsWith('nurse')) return 'nurse';
    return 'patient';
  })();

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all credentials.');
      return;
    }

    const lowerUser = username.trim().toLowerCase();
    const lowerPass = password;

    if (lowerPass === 'password') {
      if (lowerUser === 'doctor' || lowerUser === 'doc_1') {
        onLogin({ username: 'Doctor Stark', role: 'doctor', id: 'doc_1' });
      } else if (lowerUser === 'doc_2') {
        onLogin({ username: 'Doctor Strange', role: 'doctor', id: 'doc_2' });
      } else if (lowerUser === 'nurse' || lowerUser === 'nurse1') {
        onLogin({ username: 'Nurse Joy', role: 'nurse', id: 'nurse1' });
      } else if (lowerUser === 'nurse2') {
        onLogin({ username: 'Nurse Kelly', role: 'nurse', id: 'nurse2' });
      } else if (lowerUser === 'nurse3') {
        onLogin({ username: 'Nurse Jenny', role: 'nurse', id: 'nurse3' });
      } else if (lowerUser === 'nurse4') {
        onLogin({ username: 'Nurse Clara', role: 'nurse', id: 'nurse4' });
      } else {
        const patientId = lowerUser === 'patient' ? 'AURA-582910' : username.toUpperCase();
        onLogin({ username: patientId, role: 'patient', patientId });
      }
    } else {
      setError('Invalid credentials. (Use "password" for demo accounts)');
    }
  };

  // Start Biometric Authentication Simulation
  const handleStartBiometric = (type) => {
    setError('');
    setBioType(type);
    setBioStep(0);
    setBioProgress(0);
  };

  useEffect(() => {
    if (!bioType) return;

    const steps = bioType === 'face' 
      ? ['Initializing TrueDepth Camera...', 'Analyzing facial structure...', 'Matching biometric key with local secure enclave...', 'Access Granted!']
      : ['Activating microphone array...', 'Capturing voice print...', 'Analyzing unique speech patterns...', 'Access Granted!'];

    const interval = setInterval(() => {
      setBioStep((prev) => {
        if (prev >= steps.length - 1) {
          clearInterval(interval);
          setTimeout(() => {
            setBioType(null);
            if (bioType === 'face') {
              onLogin({ username: 'Dr. Carter (Bio-Auth)', role: 'doctor' });
            } else {
              onLogin({ username: 'Nurse Kelly (Bio-Auth)', role: 'nurse' });
            }
          }, 800);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [bioType]);

  useEffect(() => {
    if (!bioType) return;
    const interval = setInterval(() => {
      setBioProgress((p) => Math.min(p + 5, 100));
    }, 100);
    return () => clearInterval(interval);
  }, [bioType, bioStep]);

  const stepsText = bioType === 'face' 
    ? ['Initializing TrueDepth Camera...', 'Analyzing facial structure...', 'Matching biometric key with local secure enclave...', 'Access Granted!']
    : ['Activating microphone array...', 'Capturing voice print...', 'Analyzing unique speech patterns...', 'Access Granted!'];

  if (viewMode === 'presentation') {
    return <ActiveTheoryLanding onEnterApp={() => setViewMode('login')} />;
  }

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: 'calc(100vh - 60px)', padding: '20px' }}>
      {/* DIRECT ORIGINAL LOGIN CARD */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '75vh' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', animation: 'fadeIn 0.5s ease-out', border: '1px solid rgba(0, 242, 254, 0.3)', boxShadow: '0 20px 60px rgba(0, 242, 254, 0.2)' }}>
            
            {/* App Logo */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                boxShadow: '0 0 25px rgba(0, 242, 254, 0.5)',
                marginBottom: '16px'
              }}>
                <Activity size={32} color="#fff" />
              </div>
              <h2 className="glowing-text" style={{ fontSize: '28px', fontWeight: '800' }}>{t.title}</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{t.subtitle}</p>
            </div>

            {/* Dynamic Inferred Role Badge */}
            {inferredRole && (
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span className={`badge ${inferredRole === 'doctor' ? 'badge-success' : inferredRole === 'nurse' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '11px', textTransform: 'capitalize', letterSpacing: '0.5px' }}>
                  Inferred Role: <b>{inferredRole}</b>
                </span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t.username}</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input-field"
                    style={{ paddingLeft: '38px' }}
                    placeholder="Enter username (e.g. doctor, nurse, patient)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t.password}</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    className="input-field"
                    style={{ paddingLeft: '38px' }}
                    placeholder="•••••••• (use 'password')"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <p style={{ color: 'var(--color-danger)', fontSize: '12px', marginBottom: '12px', textAlign: 'center' }}>
                  {error}
                </p>
              )}

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
                <Shield size={16} />
                <span>{t.login}</span>
              </button>
            </form>

            <button
              type="button"
              onClick={() => setViewMode('presentation')}
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}
            >
              <Layout size={16} />
              <span>Explore Clinical Intelligence</span>
            </button>

            {/* Quick Demo Credentials Selection */}
            <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Quick One-Click Demo Access
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setUsername('doctor'); setPassword('password'); }}
                  style={{ padding: '10px 6px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                >
                  👨‍⚕️ Doctor Stark
                </button>
                <button
                  type="button"
                  onClick={() => { setUsername('nurse'); setPassword('password'); }}
                  style={{ padding: '10px 6px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                >
                  👩‍⚕️ Nurse Joy
                </button>
                <button
                  type="button"
                  onClick={() => { setUsername('patient'); setPassword('password'); }}
                  style={{ padding: '10px 6px', borderRadius: '10px', background: 'rgba(0, 242, 254, 0.1)', border: '1px solid rgba(0, 242, 254, 0.3)', color: '#00f2fe', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                >
                  👤 Patient Portal
                </button>
              </div>
            </div>

            {/* Biometric Simulation Modals */}
            {bioType && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(13, 20, 38, 0.95)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-md)',
                zIndex: 10,
                padding: '24px'
              }}>
                {bioType === 'face' ? (
                  <Camera size={64} style={{ color: 'var(--accent-secondary)', marginBottom: '16px' }} />
                ) : (
                  <Mic size={64} style={{ color: 'var(--accent-primary)', marginBottom: '16px' }} />
                )}
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>
                  {bioType === 'face' ? 'Facial Biometric Lock' : 'Voiceprint Key Registry'}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  {stepsText[bioStep]}
                </p>
                <div style={{ width: '80%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${bioProgress}%`, height: '100%', background: 'linear-gradient(90deg, #00f2fe, #7f00ff)' }} />
                </div>
              </div>
            )}

          </div>
        </div>
    </div>
  );
}
