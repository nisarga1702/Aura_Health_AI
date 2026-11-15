import React, { useState, useEffect } from 'react';

/**
 * ActiveTheoryScrollTracker.jsx
 * Active Theory Signature Vertical Scroll Timeline & Scroll Progress Cue
 */
export default function ActiveTheoryScrollTracker() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) return;
      const progress = Math.min(Math.max(window.scrollY / totalHeight, 0), 1);
      setScrollProgress(progress);

      // Map progress to 5 signature sections
      if (progress < 0.2) setActiveSection(0);
      else if (progress < 0.4) setActiveSection(1);
      else if (progress < 0.6) setActiveSection(2);
      else if (progress < 0.8) setActiveSection(3);
      else setActiveSection(4);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const sections = [
    { num: '01', label: 'HERO' },
    { num: '02', label: 'TOPOLOGY' },
    { num: '03', label: 'COMMAND' },
    { num: '04', label: 'DIAGNOSTICS' },
    { num: '05', label: 'PREDICTIONS' }
  ];

  return (
    <>
      {/* Right Fixed Active Theory Vertical Scroll Bar */}
      <div style={{
        position: 'fixed',
        right: '24px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        zIndex: 998,
        pointerEvents: 'none'
      }}>
        {/* Track Line */}
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '2px',
          background: 'rgba(255, 255, 255, 0.1)',
          zIndex: -1
        }}>
          <div style={{
            width: '100%',
            height: `${scrollProgress * 100}%`,
            background: 'linear-gradient(to bottom, #00f2fe, #7f00ff)',
            boxShadow: '0 0 10px #00f2fe',
            transition: 'height 0.1s ease-out'
          }} />
        </div>

        {/* Section Indicators */}
        {sections.map((sec, idx) => (
          <div
            key={sec.num}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: activeSection === idx ? 1 : 0.4,
              transition: 'all 0.3s ease'
            }}
          >
            <span style={{
              fontSize: '10px',
              fontFamily: 'monospace',
              fontWeight: '800',
              color: activeSection === idx ? '#00f2fe' : '#ffffff'
            }}>
              {sec.num}
            </span>
            <div style={{
              width: activeSection === idx ? '10px' : '6px',
              height: activeSection === idx ? '10px' : '6px',
              borderRadius: '50%',
              background: activeSection === idx ? '#00f2fe' : 'rgba(255, 255, 255, 0.5)',
              boxShadow: activeSection === idx ? '0 0 12px #00f2fe' : 'none',
              transition: 'all 0.3s'
            }} />
          </div>
        ))}
      </div>
    </>
  );
}
