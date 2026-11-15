import React from 'react';
import { TrendingUp } from 'lucide-react';

export default function RiskElevationXYChart({ heartRisk = 0, diabetesRisk = 0, kidneyRisk = 0, isPrint = false }) {
  const categories = [
    { key: 'heart', label: 'Cardiovascular', score: Number(heartRisk.toFixed(1)), isPredicted: heartRisk > 50 },
    { key: 'diabetes', label: 'Diabetes (T2D)', score: Number(diabetesRisk.toFixed(1)), isPredicted: diabetesRisk > 50 },
    { key: 'kidney', label: 'Kidney (CKD)', score: Number(kidneyRisk.toFixed(1)), isPredicted: kidneyRisk > 50 },
  ];

  // Canvas Dimensions
  const width = 600;
  const height = isPrint ? 200 : 250;
  const paddingLeft = 65;
  const paddingRight = 65;
  const paddingTop = 35;
  const paddingBottom = 55;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const yTicks = [100, 80, 60, 40, 20, 0];

  // Compute X and Y coordinates for line graph points
  const points = categories.map((cat, index) => {
    const x = paddingLeft + (index / (categories.length - 1)) * innerWidth;
    const y = paddingTop + ((100 - cat.score) / 100) * innerHeight;
    return { ...cat, x, y };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div
      className={isPrint ? "" : "glass-panel"}
      style={{
        padding: isPrint ? '12px' : '24px',
        marginBottom: '24px',
        background: isPrint ? '#ffffff' : undefined,
        border: isPrint ? '1px solid #cbd5e1' : undefined,
        borderRadius: isPrint ? '8px' : undefined
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ fontSize: isPrint ? '14px' : '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: isPrint ? '#0f172a' : 'var(--text-primary)' }}>
            <TrendingUp size={isPrint ? 18 : 22} color={isPrint ? '#0284c7' : 'var(--accent-primary)'} />
            Risk Elevation Line Graph (X/Y Axis)
          </h3>
          <p style={{ fontSize: isPrint ? '10px' : '12px', color: isPrint ? '#475569' : 'var(--text-secondary)', marginTop: '2px' }}>
            Diagnostic risk trajectory plotted across disease categories on X and Y coordinate axes.
          </p>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '14px', fontSize: isPrint ? '10px' : '11px', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: isPrint ? '#166534' : 'var(--text-secondary)' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} /> Normal (0–40%)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: isPrint ? '#991b1b' : 'var(--text-secondary)' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} /> High Risk ({'>'}70%)
          </span>
        </div>
      </div>

      {/* SVG LINE GRAPH WITH X AND Y AXES */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: '480px', overflow: 'visible' }}>
          
          {/* Y-Axis Grid Lines & Ticks */}
          {yTicks.map(tick => {
            const yPos = paddingTop + ((100 - tick) / 100) * innerHeight;
            return (
              <g key={tick}>
                {/* Horizontal Gridline */}
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={width - paddingRight}
                  y2={yPos}
                  stroke={tick === 70 ? (isPrint ? '#ef4444' : 'rgba(239,68,68,0.5)') : tick === 40 ? (isPrint ? '#f59e0b' : 'rgba(245,158,11,0.4)') : (isPrint ? '#e2e8f0' : 'rgba(255,255,255,0.08)')}
                  strokeDasharray={tick === 70 || tick === 40 ? "4 4" : "none"}
                  strokeWidth={tick === 70 ? 1.5 : 1}
                />
                {/* Y-Axis Label */}
                <text
                  x={paddingLeft - 10}
                  y={yPos + 4}
                  textAnchor="end"
                  fontSize={isPrint ? "10" : "11"}
                  fill={isPrint ? "#475569" : "var(--text-secondary)"}
                  fontWeight="600"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* Y-AXIS LINE */}
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={height - paddingBottom}
            stroke={isPrint ? "#0f172a" : "var(--text-muted)"}
            strokeWidth="2"
          />

          {/* X-AXIS LINE */}
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke={isPrint ? "#0f172a" : "var(--text-muted)"}
            strokeWidth="2"
          />

          {/* Y-AXIS TITLE */}
          <text
            x={15}
            y={height / 2}
            transform={`rotate(-90 15 ${height / 2})`}
            textAnchor="middle"
            fontSize={isPrint ? "10" : "11"}
            fontWeight="700"
            fill={isPrint ? "#334155" : "var(--text-muted)"}
          >
            Risk Elevation (%)
          </text>

          {/* X-AXIS TITLE */}
          <text
            x={width / 2}
            y={height - 6}
            textAnchor="middle"
            fontSize={isPrint ? "10" : "11"}
            fontWeight="700"
            fill={isPrint ? "#334155" : "var(--text-muted)"}
          >
            Diagnostic Modules (X-Axis)
          </text>

          {/* LINE GRAPH PATH */}
          <polyline
            fill="none"
            stroke={isPrint ? "#0284c7" : "url(#lineGradient)"}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
          />

          {/* SVG Gradient definition */}
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>

          {/* DATA POINTS & LABELS */}
          {points.map((pt, i) => {
            const pointColor = pt.score >= 70 ? '#ef4444' : pt.score >= 40 ? '#f59e0b' : '#10b981';
            return (
              <g key={i}>
                {/* Vertical Guide Line to X-Axis */}
                <line
                  x1={pt.x}
                  y1={pt.y}
                  x2={pt.x}
                  y2={height - paddingBottom}
                  stroke={isPrint ? "#cbd5e1" : "rgba(255,255,255,0.12)"}
                  strokeDasharray="2 2"
                />

                {/* Outer Ring */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="7"
                  fill={isPrint ? "#ffffff" : "#0f172a"}
                  stroke={pointColor}
                  strokeWidth="3"
                />
                {/* Inner Dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="3"
                  fill={pointColor}
                />

                {/* Score Value Tag above Point */}
                <g transform={`translate(${pt.x}, ${pt.y - 14})`}>
                  <rect
                    x="-24"
                    y="-14"
                    width="48"
                    height="18"
                    rx="4"
                    fill={isPrint ? "#ffffff" : "rgba(15, 23, 42, 0.9)"}
                    stroke={pointColor}
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="-2"
                    textAnchor="middle"
                    fontSize={isPrint ? "10" : "11"}
                    fontWeight="800"
                    fill={isPrint ? pointColor : "#ffffff"}
                  >
                    {pt.score}%
                  </text>
                </g>

                {/* X-Axis Category Name */}
                <text
                  x={pt.x}
                  y={height - paddingBottom + 18}
                  textAnchor="middle"
                  fontSize={isPrint ? "10" : "11"}
                  fontWeight="700"
                  fill={isPrint ? "#0f172a" : "var(--text-primary)"}
                >
                  {pt.label}
                </text>

                {/* Predicted YES / NO Tag under X-Axis */}
                <text
                  x={pt.x}
                  y={height - paddingBottom + 32}
                  textAnchor="middle"
                  fontSize={isPrint ? "9" : "10"}
                  fontWeight="800"
                  fill={pt.isPredicted ? "#b91c1c" : "#15803d"}
                >
                  {pt.isPredicted ? "⚠️ Predicted: YES" : "✅ Predicted: NO"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
