import React, { useState } from 'react';
import { Activity, Heart, Eye, Droplet, Zap, Cpu, ArrowDown } from 'lucide-react';

/**
 * ActiveTheoryCenterpiece.jsx
 * Active Theory Style Interactive Clinical Intelligence Topology Map
 */
export default function ActiveTheoryCenterpiece({ onSelectModule }) {
  const [activeNode, setActiveNode] = useState('ecg');

  const nodes = [
    { id: 'ecg', label: '12-LEAD ECG SIGNAL', type: 'input', icon: <Activity className="w-5 h-5 text-cyan-400" />, desc: 'PhysioNet 88k ECGs • PyTorch xResNet1D Deep ResNet' },
    { id: 'heart', label: 'CARDIOVASCULAR', type: 'modal', icon: <Heart className="w-5 h-5 text-red-400" />, desc: 'UCI & MIMIC-IV Combined Biomarkers' },
    { id: 'blood', label: 'LAB BLOOD SERUM', type: 'modal', icon: <Droplet className="w-5 h-5 text-amber-400" />, desc: 'Automated OCR Lab Value Extraction' },
    { id: 'retina', label: 'RETINAL FUNDUS', type: 'modal', icon: <Eye className="w-5 h-5 text-purple-400" />, desc: 'Grad-CAM Explainable Vision Attention' },
    { id: 'ai', label: 'PSO AI ENGINE', type: 'engine', icon: <Cpu className="w-6 h-6 text-emerald-400" />, desc: 'Particle Swarm Optimization & 7-Model Ensemble' },
    { id: 'cardio', label: 'CARDIO RISK (99.8%)', type: 'output', icon: <Zap className="w-4 h-4 text-cyan-400" />, desc: 'PSO-XGBoost + Stacking' },
    { id: 'diabetes', label: 'DIABETES (99.9%)', type: 'output', icon: <Zap className="w-4 h-4 text-amber-400" />, desc: 'PSO-ExtraTrees Classifier' },
    { id: 'ckd', label: 'CKD (99.9%)', type: 'output', icon: <Zap className="w-4 h-4 text-purple-400" />, desc: 'PSO-RandomForest Classifier' },
  ];

  return (
    <div style={{
      position: 'relative',
      padding: '40px 20px',
      margin: '30px 0',
      background: 'rgba(10, 13, 26, 0.4)',
      border: '1px solid rgba(0, 242, 254, 0.2)',
      borderRadius: '24px',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      overflow: 'hidden'
    }}>
      {/* Title Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{
          fontSize: '11px',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          color: '#00f2fe',
          fontWeight: '700',
          marginBottom: '8px'
        }}>
          Interactive Multimodal Topology
        </div>
        <h2 style={{
          fontSize: '28px',
          fontWeight: '900',
          letterSpacing: '2px',
          background: 'linear-gradient(135deg, #ffffff 0%, #00f2fe 50%, #7f00ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          AURA CLINICAL INTELLIGENCE CENTERPIECE
        </h2>
      </div>

      {/* Topology Diagram Container */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        position: 'relative'
      }}>
        {/* Node 1: ECG Signal Input */}
        <div
          onClick={() => setActiveNode('ecg')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 28px',
            borderRadius: '50px',
            background: activeNode === 'ecg' ? 'rgba(0, 242, 254, 0.2)' : 'rgba(15, 23, 42, 0.8)',
            border: activeNode === 'ecg' ? '2px solid #00f2fe' : '1px solid rgba(0, 242, 254, 0.3)',
            boxShadow: activeNode === 'ecg' ? '0 0 30px rgba(0, 242, 254, 0.4)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 2
          }}
        >
          <div style={{ animation: 'pulse 2s infinite' }}>◉</div>
          <span style={{ fontWeight: '800', letterSpacing: '1px', fontSize: '13px', color: '#fff' }}>12-LEAD ECG SIGNAL</span>
        </div>

        {/* Connecting Lines */}
        <div style={{ width: '2px', height: '24px', background: 'linear-gradient(to bottom, #00f2fe, #7f00ff)' }} />

        {/* Node Layer 2: Modalities (Heart, Blood, Retina) */}
        <div style={{
          display: 'flex',
          justify: 'center',
          gap: '20px',
          flexWrap: 'wrap',
          width: '100%',
          maxWidth: '700px'
        }}>
          {[
            { id: 'heart', label: 'HEART', color: '#ef4444' },
            { id: 'blood', label: 'BLOOD', color: '#f59e0b' },
            { id: 'retina', label: 'RETINA', color: '#a855f7' }
          ].map(m => (
            <div
              key={m.id}
              onClick={() => setActiveNode(m.id)}
              style={{
                flex: '1',
                minWidth: '130px',
                textAlign: 'center',
                padding: '12px 18px',
                borderRadius: '16px',
                background: activeNode === m.id ? `rgba(${m.color === '#ef4444' ? '239, 68, 68' : m.color === '#f59e0b' ? '245, 158, 11' : '168, 85, 247'}, 0.25)` : 'rgba(15, 23, 42, 0.6)',
                border: `1px solid ${m.color}`,
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: activeNode === m.id ? `0 0 20px ${m.color}` : 'none'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#fff', letterSpacing: '1px' }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Connecting Lines */}
        <div style={{ width: '2px', height: '24px', background: 'linear-gradient(to bottom, #7f00ff, #10b981)' }} />

        {/* Node Layer 3: AI Engine */}
        <div
          onClick={() => setActiveNode('ai')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 36px',
            borderRadius: '50px',
            background: 'linear-gradient(135deg, rgba(127, 0, 255, 0.3) 0%, rgba(16, 185, 129, 0.3) 100%)',
            border: '2px solid #10b981',
            boxShadow: '0 0 35px rgba(16, 185, 129, 0.4)',
            cursor: 'pointer',
            zIndex: 2
          }}
        >
          <Cpu style={{ color: '#10b981' }} />
          <span style={{ fontWeight: '900', letterSpacing: '2px', fontSize: '14px', color: '#fff' }}>AURA MULTIMODAL AI ENGINE</span>
        </div>

        <ArrowDown style={{ color: '#10b981', opacity: 0.8 }} />

        {/* Node Layer 4: Output Predictions (Cardio, Diabetes, CKD) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px',
          width: '100%',
          maxWidth: '750px'
        }}>
          {[
            { id: 'cardio', label: 'CARDIO RISK', score: '99.85%', color: '#00f2fe' },
            { id: 'diabetes', label: 'DIABETES RISK', score: '99.92%', color: '#f59e0b' },
            { id: 'ckd', label: 'CKD RISK', score: '99.90%', color: '#a855f7' }
          ].map(out => (
            <div
              key={out.id}
              onClick={() => setActiveNode(out.id)}
              style={{
                padding: '16px',
                borderRadius: '16px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: `1px solid ${out.color}`,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700' }}>{out.label}</div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: out.color, marginTop: '4px' }}>{out.score}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Active Node Description Card */}
      {activeNode && (
        <div style={{
          marginTop: '30px',
          padding: '16px 24px',
          borderRadius: '16px',
          background: 'rgba(0, 242, 254, 0.08)',
          border: '1px solid rgba(0, 242, 254, 0.3)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#00f2fe', letterSpacing: '1px' }}>
            NODE TELEMETRY: {nodes.find(n => n.id === activeNode)?.label}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {nodes.find(n => n.id === activeNode)?.desc}
          </div>
        </div>
      )}
    </div>
  );
}
