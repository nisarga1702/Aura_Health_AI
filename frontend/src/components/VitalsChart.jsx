import React, { useEffect, useRef } from 'react';

export default function VitalsChart({ heartRate = 72, isAlert = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    
    // Scale for High-DPI screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Buffer of points to draw
    const points = [];
    const maxPoints = 300;
    
    // Initialise points list
    for (let i = 0; i < maxPoints; i++) {
      points.push(height / 2);
    }

    let t = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Grid Lines (clinical look)
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 20;
      
      // Vertical grid
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      // Horizontal grid
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Generate new point simulating ECG wave
      // Cycle length is determined by heart rate
      const cycleLength = Math.max(30, Math.floor(3600 / heartRate)); 
      const phase = t % cycleLength;
      let nextY = height / 2;

      // Draw P-Q-R-S-T wave complex at specific phases
      if (phase === Math.floor(cycleLength * 0.1)) {
        // P Wave
        nextY -= 10; 
      } else if (phase === Math.floor(cycleLength * 0.25)) {
        // Q Wave
        nextY += 5;
      } else if (phase === Math.floor(cycleLength * 0.28)) {
        // R Wave (big peak)
        nextY -= 65;
      } else if (phase === Math.floor(cycleLength * 0.32)) {
        // S Wave (trough)
        nextY += 20;
      } else if (phase === Math.floor(cycleLength * 0.45)) {
        // T Wave
        nextY -= 15;
      }

      // Add a bit of micro-noise to look organic
      nextY += (Math.random() - 0.5) * 2;

      points.push(nextY);
      if (points.length > maxPoints) {
        points.shift();
      }

      // 3. Draw ECG Line
      ctx.beginPath();
      ctx.strokeStyle = isAlert ? 'rgb(239, 68, 68)' : 'rgb(6, 182, 212)';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = isAlert ? 15 : 10;
      ctx.shadowColor = isAlert ? 'rgba(239, 68, 68, 0.5)' : 'rgba(6, 182, 212, 0.4)';
      ctx.lineJoin = 'round';

      for (let i = 0; i < points.length; i++) {
        const x = (i / (maxPoints - 1)) * width;
        const y = points[i];
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Reset shadows
      ctx.shadowBlur = 0;

      t++;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [heartRate, isAlert]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '220px' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          background: 'rgba(10, 15, 30, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(6, 182, 212, 0.2)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'rgba(0,0,0,0.6)',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'monospace',
          color: isAlert ? 'rgb(239, 68, 68)' : 'rgb(6, 182, 212)',
          border: `1px solid ${isAlert ? 'rgba(239, 68, 68, 0.3)' : 'rgba(6, 182, 212, 0.3)'}`
        }}
      >
        12-LEAD STREAM SIMULATOR
      </div>
    </div>
  );
}
