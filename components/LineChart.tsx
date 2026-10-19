"use client";

// Simple line chart on a true 0–100% scale (so 98% and 100% don't look identical).
export default function LineChart({
  data,
  height = 190,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const W = 320;
  const left = 30;
  const right = 12;
  const top = 18;
  const bottom = 26;
  const innerW = W - left - right;
  const innerH = height - top - bottom;

  const x = (i: number) => (data.length === 1 ? left + innerW / 2 : left + (i / (data.length - 1)) * innerW);
  const y = (v: number) => top + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const area = data.length > 1 ? `${left},${top + innerH} ${points} ${x(data.length - 1)},${top + innerH}` : "";

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label="Attendance percentage by day">
      <defs>
        <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f6b4f" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#2f6b4f" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={left} x2={W - right} y1={y(g)} y2={y(g)} stroke="#e5e9e4" strokeWidth="1" />
          <text x={left - 6} y={y(g) + 3} fontSize="9" textAnchor="end" fill="#6b7a71">{g}%</text>
        </g>
      ))}
      {area && <polygon points={area} fill="url(#lc-fill)" />}
      {data.length > 1 && <polyline points={points} fill="none" stroke="#2f6b4f" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {data.map((d, i) => (
        <g key={`${d.label}-${i}`}>
          <circle cx={x(i)} cy={y(d.value)} r="4" fill="#fff" stroke="#c9992e" strokeWidth="2.5" />
          <text x={x(i)} y={y(d.value) - 9} fontSize="9" fontWeight="700" textAnchor="middle" fill="#163a2b">{d.value}%</text>
          <text x={x(i)} y={height - 8} fontSize="9" textAnchor="middle" fill="#6b7a71">{d.label}</text>
        </g>
      ))}
    </svg>
  );
}
