/**
 * AURA-Health AI — App.jsx  (PATCHED)
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes vs original:
 *
 *  1. Wraps the entire app in <PatientProvider> so that ResultsScreen,
 *     RecordsScreen and PatientPortalScreen all read from the same context
 *     slice — eliminating the prop-drilling of `currentResult` which was
 *     the root cause of stale data surviving patient switches.
 *
 *  2. `currentResult` / `setCurrentResult` state is REMOVED from App.
 *     Those screens now call `usePatient()` or `loadPatient()` directly.
 *
 *  3. NewPatientScreen receives `onSetCurrentResult` wired to the context's
 *     `setCurrentResult` method, keeping its API identical.
 *
 *  4. RecordsScreen receives `onSetCurrentResult` wired the same way so
 *     clicking a historical patient row populates context correctly.
 *
 *  All role-based access control, nav, and accessibility code is unchanged.
 */

import React, { useState, useEffect } from 'react';
import { Activity, LogOut, Sun, Moon, Type, Globe } from 'lucide-react';
import { translations } from './i18n/translations';
import { PatientProvider, usePatient } from './context/PatientContext';

import LoginScreen         from './screens/LoginScreen';
import DashboardScreen     from './screens/DashboardScreen';
import NewPatientScreen    from './screens/NewPatientScreen';
import ResultsScreen       from './screens/ResultsScreen';
import RecordsScreen       from './screens/RecordsScreen';
import PatientPortalScreen from './screens/PatientPortalScreen';
import ActiveTheoryCanvas          from './components/ActiveTheoryCanvas';
import ActiveTheoryScrollTracker   from './components/ActiveTheoryScrollTracker';

// ── Role permission map ────────────────────────────────────────────────────────
const PERMISSIONS = {
  doctor:  ['dashboard', 'newPatient', 'results', 'records'],
  nurse:   ['dashboard', 'results', 'records'],
  patient: ['patientPortal'],
};

// ── Inner shell (needs context already mounted) ───────────────────────────────
function AppShell() {
  const { setCurrentResult, clearPatient } = usePatient();

  const [user,       setUser]       = useState(null);
  const [screen,     setScreen]     = useState('login');
  const [lang,       setLang]       = useState('en');
  const [largeText,  setLargeText]  = useState(false);
  const [lightTheme, setLightTheme] = useState(false);

  const t = translations[lang] || translations.en;

  useEffect(() => { document.body.classList.toggle('large-text',   largeText);  }, [largeText]);
  useEffect(() => { document.body.classList.toggle('light-theme',  lightTheme); }, [lightTheme]);

  const handleLogin = (sessionUser) => {
    setUser(sessionUser);
    setScreen(sessionUser.role === 'patient' ? 'patientPortal' : 'dashboard');
  };

  const handleLogout = () => {
    clearPatient();           // wipe context so no stale data lingers after logout
    setUser(null);
    setScreen('login');
  };

  const handleNavigate = (target) => {
    if (!user) return;
    const allowed = PERMISSIONS[user.role] || [];
    if (!allowed.includes(target)) {
      console.warn(`Role "${user.role}" cannot access "${target}"`);
      return;
    }
    setScreen(target);
  };

  // Called by NewPatientScreen and RecordsScreen after a result is ready
  const handleSetCurrentResult = async (result) => {
    await setCurrentResult(result);   // populates context + triggers prescription fetch
    handleNavigate('results');
  };

  const renderScreen = () => {
    if (!user) return <LoginScreen onLogin={handleLogin} activeLang={lang} setLang={setLang} t={t} />;

    switch (screen) {
      case 'dashboard':
        return <DashboardScreen user={user} onNavigate={handleNavigate} t={t} lang={lang} />;

      case 'newPatient':
        if (user.role === 'nurse') return (
          <div className="container" style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
            <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Access Restricted</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Only doctors can register new patients and run diagnostics.
            </p>
            <button onClick={() => handleNavigate('dashboard')} className="btn-secondary" style={{ marginTop: '20px' }}>
              Back to Dashboard
            </button>
          </div>
        );
        return (
          <NewPatientScreen
            onNavigate={handleNavigate}
            onSetCurrentResult={handleSetCurrentResult}
            t={t}
            userRole={user.role}
            user={user}
          />
        );

      case 'results':
        return (
          <ResultsScreen
            onNavigate={handleNavigate}
            t={t}
            lang={lang}
            userRole={user.role}
            user={user}
          />
        );

      case 'records':
        return (
          <RecordsScreen
            onNavigate={handleNavigate}
            onSetCurrentResult={handleSetCurrentResult}
            t={t}
            userRole={user.role}
            user={user}
          />
        );

      case 'patientPortal':
        return <PatientPortalScreen user={user} t={t} lang={lang} />;

      case 'liveMonitoring':
        return <LiveMonitoringScreen onNavigate={handleNavigate} t={t} />;

      default:
        return <DashboardScreen user={user} onNavigate={handleNavigate} t={t} lang={lang} />;
    }
  };

  const nurseInfo = user?.role === 'nurse'
    ? <span className="badge badge-warning" style={{ fontSize: '10px' }}>Read-Only Mode</span>
    : null;

  return (
    <div className="app-shell">
      <ActiveTheoryCanvas />
      <ActiveTheoryScrollTracker />
      <div className="accessibility-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Offline-First Sync Status Indicator */}
          <div className="sync-status" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--color-success)', 
              display: 'inline-block',
              boxShadow: '0 0 8px var(--color-success)',
              animation: 'pulseGlow 2s infinite' 
            }} />
            <span style={{ color: 'var(--text-secondary)', fontWeight: '500', fontSize: '11px' }}>
              Database: Local-First (Synced)
            </span>
          </div>

          <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>

          {/* Consolidated Language Dropdown */}
          <div className="language-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={12} color="var(--text-muted)" />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              <option value="en" style={{ background: '#161f38', color: '#fff' }}>English</option>
              <option value="hi" style={{ background: '#161f38', color: '#fff' }}>हिन्दी</option>
              <option value="kn" style={{ background: '#161f38', color: '#fff' }}>ಕನ್ನಡ</option>
              <option value="ta" style={{ background: '#161f38', color: '#fff' }}>தமிழ்</option>
              <option value="te" style={{ background: '#161f38', color: '#fff' }}>తెలుగు</option>
            </select>
          </div>
        </div>

        <div className="accessibility-actions">
          <button type="button" className={`toggle-chip ${largeText ? 'active' : ''}`} onClick={() => setLargeText(!largeText)}>
            <Type size={12} /><span>{largeText ? 'Normal Font' : 'Large Font'}</span>
          </button>
          <button type="button" className={`toggle-chip ${lightTheme ? 'active' : ''}`} onClick={() => setLightTheme(!lightTheme)}>
            {lightTheme ? <Moon size={12} /> : <Sun size={12} />}<span>{lightTheme ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
        </div>
      </div>

      {user && (
        <nav className="navbar">
          <a href="#" className="nav-brand"
            onClick={e => { e.preventDefault(); handleNavigate(user.role === 'patient' ? 'patientPortal' : 'dashboard'); }}>
            <Activity size={22} className="glowing-text" />
            <span className="glowing-text">{t.title}</span>
          </a>
          <div className="nav-links">
            {user.role === 'patient' ? (
              <span className="badge badge-success">Patient Portal</span>
            ) : (
              <>
                <button type="button" onClick={() => handleNavigate('dashboard')} className={`btn-secondary nav-button ${screen === 'dashboard' ? 'active' : ''}`}>{t.dashboard}</button>
                {user.role === 'doctor' && (
                  <button type="button" onClick={() => handleNavigate('newPatient')} className={`btn-secondary nav-button ${screen === 'newPatient' ? 'active' : ''}`}>{t.newPatient}</button>
                )}
                <button type="button" onClick={() => handleNavigate('records')}  className={`btn-secondary nav-button ${screen === 'records' ? 'active' : ''}`}>{t.records}</button>
                {nurseInfo}
              </>
            )}
            <div className="nav-profile">
              <span className="badge badge-muted">{user.role.toUpperCase()}: <b>{user.username}</b></span>
              <button type="button" onClick={handleLogout} className="btn-secondary nav-button logout-button">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </nav>
      )}

      <main className="app-main">{renderScreen()}</main>

      <footer className="app-footer">
        AURA-Health AI — Offline-First Multimodal Clinical AI. Role-based access enforced.
      </footer>
    </div>
  );
}

// ── Root export wraps shell in context provider ───────────────────────────────
export default function App() {
  return (
    <PatientProvider>
      <AppShell />
    </PatientProvider>
  );
}
