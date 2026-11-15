import React, { useState, useEffect, useRef } from 'react';
import { Eye, Sparkles } from 'lucide-react';

/**
 * GradCamViewer.jsx
 * High-Definition Compact Grad-CAM Heatmap Visualizer
 * Provides crisp visual attention heatmaps in a compact 480px frame.
 */
export default function GradCamViewer({ heatmapPoints = [], mode = 'ecg', imageSrc = '' }) {
  const [opacity, setOpacity] = useState(0.70);
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let active = true;
    let imageTransform = { offsetX: 0, offsetY: 0, scale: 1 };

    const clearCanvas = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawSchematic = () => {
      ctx.fillStyle = '#05070e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (mode === 'ecg') {
        // High-definition ECG Grid lines
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.12)';
        ctx.lineWidth = 1;
        for (let y = 10; y < canvas.height; y += 12) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
        for (let x = 10; x < canvas.width; x += 12) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }

        // Glowing ECG Signal trace
        ctx.strokeStyle = '#00f2fe';
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, canvas.height / 2);

        const points = [
          { x: 30, y: 70 }, { x: 50, y: 80 }, { x: 70, y: 30 }, { x: 90, y: 105 },
          { x: 110, y: 70 }, { x: 140, y: 55 }, { x: 170, y: 70 }, { x: 190, y: 30 },
          { x: 210, y: 105 }, { x: 230, y: 70 }, { x: 260, y: 55 }, { x: 290, y: 70 },
          { x: 310, y: 35 }, { x: 330, y: 105 }, { x: 350, y: 70 }, { x: 380, y: 55 },
          { x: 410, y: 70 }, { x: 430, y: 30 }, { x: 450, y: 105 }
        ];

        points.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      } else {
        // High-definition Retinal Fundus visual
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 55;

        ctx.fillStyle = 'rgba(180, 40, 20, 0.35)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const opticX = centerX - 20;
        const opticY = centerY;
        ctx.fillStyle = 'rgba(253, 224, 71, 0.8)';
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(opticX, opticY, 10, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 1.5;
        const vessels = [
          [[opticX, opticY], [opticX + 12, opticY - 12], [opticX + 30, opticY - 18], [opticX + 45, opticY - 28]],
          [[opticX, opticY], [opticX + 12, opticY + 12], [opticX + 30, opticY + 20], [opticX + 42, opticY + 35]],
          [[opticX, opticY], [opticX - 8, opticY - 15], [opticX - 20, opticY - 28]],
          [[opticX, opticY], [opticX - 8, opticY + 15], [opticX - 18, opticY + 28]],
        ];
        vessels.forEach(branch => {
          ctx.beginPath();
          ctx.moveTo(branch[0][0], branch[0][1]);
          for (let i = 1; i < branch.length; i++) ctx.lineTo(branch[i][0], branch[i][1]);
          ctx.stroke();
        });
      }
    };

    const drawImageBackground = (img) => {
      ctx.fillStyle = '#05070e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const ratio = Math.min(canvas.width / img.width, canvas.height / img.height);
      const imageWidth = img.width * ratio;
      const imageHeight = img.height * ratio;
      const offsetX = (canvas.width - imageWidth) / 2;
      const offsetY = (canvas.height - imageHeight) / 2;

      imageTransform.scale = ratio;
      imageTransform.offsetX = offsetX;
      imageTransform.offsetY = offsetY;

      ctx.drawImage(img, offsetX, offsetY, imageWidth, imageHeight);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const drawGradCamOverlay = () => {
      ctx.globalAlpha = opacity;
      const displayPoints = heatmapPoints.length > 0 ? heatmapPoints : (
        mode === 'ecg' ? [
          { x: 70, y: 30, intensity: 0.95, label: 'ST Elevation' },
          { x: 190, y: 30, intensity: 0.88, label: 'QRS Peak' },
          { x: 310, y: 35, intensity: 0.82, label: 'T-Wave Alert' },
          { x: 430, y: 30, intensity: 0.70, label: 'Rhythm Variability' }
        ] : [
          { x: 230, y: 55, intensity: 0.92, label: 'Macular Edema' },
          { x: 250, y: 45, intensity: 0.85, label: 'Vessel Leakage' },
          { x: 240, y: 80, intensity: 0.70, label: 'Microaneurysm' }
        ]
      );

      // High-Definition Radial Gradient Heatmap Points
      displayPoints.forEach(pt => {
        const transformedX = pt.x * imageTransform.scale + imageTransform.offsetX;
        const transformedY = pt.y * imageTransform.scale + imageTransform.offsetY;
        
        const grad = ctx.createRadialGradient(transformedX, transformedY, 2, transformedX, transformedY, 28);
        if (pt.intensity > 0.85) {
          grad.addColorStop(0, 'rgba(239, 68, 68, 0.95)');   // Crimson Core
          grad.addColorStop(0.4, 'rgba(245, 158, 11, 0.75)'); // Gold Mid
          grad.addColorStop(0.7, 'rgba(0, 242, 254, 0.35)');  // Cyan Edge
          grad.addColorStop(1, 'rgba(0, 242, 254, 0)');
        } else {
          grad.addColorStop(0, 'rgba(245, 158, 11, 0.9)');
          grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.5)');
          grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(transformedX, transformedY, 28, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Target reticle crosshairs & labels
      ctx.globalAlpha = 1.0;
      displayPoints.forEach(pt => {
        const transformedX = pt.x * imageTransform.scale + imageTransform.offsetX;
        const transformedY = pt.y * imageTransform.scale + imageTransform.offsetY;
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(transformedX, transformedY, 6, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(transformedX - 10, transformedY);
        ctx.lineTo(transformedX + 10, transformedY);
        ctx.moveTo(transformedX, transformedY - 10);
        ctx.lineTo(transformedX, transformedY + 10);
        ctx.stroke();

        if (opacity > 0.3 && pt.label) {
          ctx.fillStyle = 'rgba(8, 13, 26, 0.85)';
          ctx.fillRect(transformedX + 10, transformedY - 12, 100, 16);
          ctx.strokeStyle = 'rgba(0, 242, 254, 0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(transformedX + 10, transformedY - 12, 100, 16);

          ctx.fillStyle = '#00f2fe';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(pt.label, transformedX + 14, transformedY);
        }
      });
    };

    const render = () => {
      clearCanvas();
      if (imageSrc && imageSrc.startsWith('data:image')) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!active) return;
          drawImageBackground(img);
          drawGradCamOverlay();
        };
        img.onerror = () => {
          if (!active) return;
          drawSchematic();
          drawGradCamOverlay();
        };
        img.src = imageSrc;
      } else {
        drawSchematic();
        drawGradCamOverlay();
      }
    };

    render();
    return () => { active = false; };
  }, [opacity, heatmapPoints, mode, imageSrc]);

  return (
    <div className="glass-panel" style={{
      padding: '16px',
      maxWidth: '480px',
      margin: '0 auto',
      border: '1px solid rgba(0, 242, 254, 0.35)',
      boxShadow: '0 10px 30px rgba(0, 242, 254, 0.15)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 style={{ fontSize: '13px', color: '#fff', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} color="#00f2fe" />
          Grad-CAM Vision ({mode === 'ecg' ? 'ECG Wave' : 'Retinal Fundus'})
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Opacity:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            style={{ width: '70px', accentColor: '#00f2fe' }}
          />
          <span style={{ fontSize: '10px', color: '#00f2fe', fontFamily: 'monospace', fontWeight: '700' }}>{Math.round(opacity * 100)}%</span>
        </div>
      </div>

      <div style={{
        background: '#05070e',
        borderRadius: '12px',
        padding: '6px',
        border: '1px solid rgba(0, 242, 254, 0.25)',
        overflow: 'hidden'
      }}>
        <canvas
          ref={canvasRef}
          width={460}
          height={130}
          style={{ width: '100%', height: 'auto', display: 'block', filter: 'contrast(1.15) brightness(1.05)' }}
        />
      </div>

      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', background: '#ef4444', borderRadius: '50%', boxShadow: '0 0 6px #ef4444' }}></span>
          <span style={{ color: '#fff' }}>CNN High Focus</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', background: '#f59e0b', borderRadius: '50%', boxShadow: '0 0 6px #f59e0b' }}></span>
          <span style={{ color: '#fff' }}>CNN Medium Focus</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', background: '#00f2fe', borderRadius: '50%', boxShadow: '0 0 6px #00f2fe' }}></span>
          <span style={{ color: '#fff' }}>CNN Background</span>
        </div>
      </div>
    </div>
  );
}
