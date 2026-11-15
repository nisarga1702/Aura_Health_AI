import React from 'react';
import { ArrowRight, ShieldCheck, Cpu, Database, Activity, Sparkles } from 'lucide-react';
import ActiveTheoryCenterpiece from './ActiveTheoryCenterpiece';

/**
 * ActiveTheoryLanding.jsx
 * Active Theory Creative Tech Presentation Layer & Hero Landing Section
 */
export default function ActiveTheoryLanding({ onEnterApp }) {
  return (
    <div style={{ position: 'relative', zIndex: 1, padding: '40px 24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Top Brand Bar */}
      <div style={{
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        padding: '16px 0',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '60px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#00f2fe',
            boxShadow: '0 0 15px #00f2fe'
          }} />
          <span style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '4px', color: '#fff' }}>AURA</span>
        </div>
        <div style={{ fontSize: '11px', letterSpacing: '2px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase' }}>
          Multimodal Clinical Intelligence Platform
        </div>
      </div>

      {/* Hero Section */}
      <div style={{ textAlign: 'center', margin: '60px 0 80px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 20px',
          borderRadius: '50px',
          background: 'rgba(0, 242, 254, 0.1)',
          border: '1px solid rgba(0, 242, 254, 0.3)',
          color: '#00f2fe',
          fontSize: '12px',
          fontWeight: '700',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          marginBottom: '28px'
        }}>
          <Sparkles className="w-4 h-4 text-cyan-400" />
          PhysioNet 88k ECG • PSO Optimization • Offline-First
        </div>

        <h1 style={{
          fontSize: 'clamp(40px, 7vw, 84px)',
          fontWeight: '900',
          lineHeight: 1.05,
          letterSpacing: '-2px',
          margin: '0 auto 24px',
          maxWidth: '1000px',
          background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.9) 40%, #00f2fe 70%, #7f00ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 20px 80px rgba(0, 242, 254, 0.3)'
        }}>
          INTELLIGENT HEALTHCARE.<br />
          ONE PATIENT. ONE COMPLETE PICTURE.
        </h1>

        <p style={{
          fontSize: '18px',
          color: 'var(--text-secondary)',
          maxWidth: '680px',
          margin: '0 auto 40px',
          lineHeight: 1.6
        }}>
          A Next-Generation Clinical Intelligence System unifying 12-Lead ECG signals, retinal fundus computer vision, laboratory serum biomarkers, and Particle Swarm Optimization ensemble predictions.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onEnterApp}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              padding: '18px 40px',
              borderRadius: '50px',
              background: 'linear-gradient(135deg, #00f2fe 0%, #7f00ff 100%)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '900',
              letterSpacing: '2px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 10px 40px rgba(0, 242, 254, 0.4)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            ENTER CLINICAL COMMAND CENTER <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Interactive Centerpiece */}
      <ActiveTheoryCenterpiece />

      {/* Feature Pillar Highlights */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        marginTop: '60px'
      }}>
        {[
          { title: '12-LEAD ECG DEEP RESNET', desc: 'Trained on 88,301 PhysioNet recordings across 9 clinical sources.', icon: <Activity className="w-6 h-6 text-cyan-400" /> },
          { title: 'PSO OPTIMIZED ENSEMBLE', desc: '7-Model ensemble combining XGBoost, LightGBM, CatBoost, and RandomForest.', icon: <Cpu className="w-6 h-6 text-purple-400" /> },
          { title: 'EXPLAINABLE Grad-CAM VISION', desc: 'Retinal fundus feature attention mapping with visual heatmaps.', icon: <Sparkles className="w-6 h-6 text-amber-400" /> },
          { title: 'OFFLINE-FIRST SYNC BUFFER', desc: 'IndexedDB local storage with automated background synchronization.', icon: <ShieldCheck className="w-6 h-6 text-emerald-400" /> }
        ].map((feat, idx) => (
          <div key={idx} style={{
            padding: '28px',
            borderRadius: '20px',
            background: 'rgba(13, 20, 38, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(12px)',
            transition: 'transform 0.3s'
          }}>
            <div style={{ marginBottom: '16px' }}>{feat.icon}</div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#fff', letterSpacing: '1px', marginBottom: '8px' }}>{feat.title}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{feat.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
