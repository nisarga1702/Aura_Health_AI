import React from 'react';
import { FileText, ShieldCheck, Trash2 } from 'lucide-react';

export default function PrescriptionCard({
  patientId,
  prescription,
  setPrescription,
  clinicalData,
  loading,
  onSave,
  userRole,
}) {
  const handleClear = () => {
    if (window.confirm('Clear the current prescription text? This does not delete any saved record.')) {
      setPrescription('');
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h3 style={{
        fontSize: '18px',
        borderBottom: '1px solid var(--glass-border)',
        paddingBottom: '8px',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <FileText size={18} color="var(--accent-secondary)" />
        <span>{userRole === 'doctor' ? 'Doctor Review & Prescription' : 'Personalized Review'}</span>
      </h3>

      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
        {userRole === 'doctor'
          ? 'Type your clinical assessment and prescription in the blank box below before saving to the patient record.'
          : 'Your attending doctor\'s prescription is shown below.'}
      </div>

      <textarea
        className="input-field"
        style={{ minHeight: '180px', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.7', whiteSpace: 'pre-wrap', resize: 'vertical' }}
        placeholder={
          userRole === 'doctor'
            ? 'Type doctor review and prescription notes here…'
            : 'No prescription on file yet.'
        }
        value={prescription}
        onChange={e => setPrescription(e.target.value)}
        readOnly={userRole !== 'doctor'}
      />

      {userRole === 'doctor' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={handleClear}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Trash2 size={14} />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={loading || !prescription.trim()}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ShieldCheck size={16} />
            <span>{loading ? 'Saving…' : 'Save Prescription'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
