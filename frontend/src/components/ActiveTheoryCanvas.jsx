import React, { useEffect, useRef } from 'react';

/**
 * ActiveTheoryCanvas.jsx
 * Active Theory Creative Tech Particle & Waveform Canvas Background
 * Interactive Canvas Particle Field + Cursor Vector Forces + ECG Pulse Waveform
 */
export default function ActiveTheoryCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Mouse Tracking
    const mouse = { x: width / 2, y: height / 2, radius: 150 };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Particle Initialization
    const particleCount = Math.min(180, Math.floor(width / 8));
    const particles = [];

    const colors = [
      'rgba(0, 242, 254, ',   // Cyan
      'rgba(127, 0, 255, ',   // Electric Violet
      'rgba(16, 185, 129, ',  // Emerald
      'rgba(245, 158, 11, '   // Gold
    ];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: Math.random() * 2 + 1,
        colorPrefix: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.6 + 0.2,
        baseX: Math.random() * width,
        baseY: Math.random() * height,
      });
    }

    // ECG Waveform Pulse Parameters
    let wavePhase = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Subtle Atmospheric Radial Gradients
      const grad1 = ctx.createRadialGradient(mouse.x, mouse.y, 10, mouse.x, mouse.y, 450);
      grad1.addColorStop(0, 'rgba(0, 242, 254, 0.08)');
      grad1.addColorStop(0.5, 'rgba(127, 0, 255, 0.03)');
      grad1.addColorStop(1, 'rgba(5, 7, 15, 0)');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Moving ECG Pulse Waveform Line across Canvas Center
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';

      wavePhase += 0.04;
      const centerY = height * 0.5;

      for (let x = 0; x < width; x += 3) {
        let yOffset = Math.sin(x * 0.01 + wavePhase) * 15;

        // Simulate QRS pulse spike periodically
        if (Math.abs((x % 300) - 150) < 15) {
          const pulseProgress = (x % 300) - 150;
          yOffset = -Math.sin(pulseProgress / 15 * Math.PI) * 60;
        }

        const y = centerY + yOffset;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 3. Render Particles & Vector Connection Lines
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Move Particle
        p.x += p.vx;
        p.y += p.vy;

        // Bounce on boundaries
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Mouse Repulsion & Magnetic Force
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          const angle = Math.atan2(dy, dx);
          p.x -= Math.cos(angle) * force * 3;
          p.y -= Math.sin(angle) * force * 3;
        }

        // Draw Particle Circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.colorPrefix}${p.alpha})`;
        ctx.fill();

        // Connect nearby particles with thin vector lines
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const pdx = p.x - p2.x;
          const pdy = p.y - p2.y;
          const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

          if (pdist < 110) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const lineAlpha = (1 - pdist / 110) * 0.15;
            ctx.strokeStyle = `rgba(0, 242, 254, ${lineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0
      }}
    />
  );
}
