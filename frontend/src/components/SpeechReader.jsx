import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export default function SpeechReader({ text, lang = 'en' }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [synth, setSynth] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setSynth(window.speechSynthesis);
    }
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = () => {
    if (!synth) return;

    if (isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Map application language to speech voices
    if (lang === 'hi') {
      utterance.lang = 'hi-IN';
    } else if (lang === 'kn') {
      utterance.lang = 'kn-IN';
    } else if (lang === 'ta') {
      utterance.lang = 'ta-IN';
    } else if (lang === 'te') {
      utterance.lang = 'te-IN';
    } else {
      utterance.lang = 'en-US';
    }

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    setIsSpeaking(true);
    synth.speak(utterance);
  };

  return (
    <button
      onClick={speak}
      className="btn-secondary"
      style={{
        padding: '8px 12px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '12px',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
      title="Text to Speech Accessibility Instruction"
    >
      {isSpeaking ? (
        <>
          <VolumeX size={14} className="glowing-text" />
          <span>Stop Audio</span>
        </>
      ) : (
        <>
          <Volume2 size={14} />
          <span>Play Audio Guide</span>
        </>
      )}
    </button>
  );
}
