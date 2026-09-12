"use client";

export default function BarChart({
  data,
  height = 160,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} width="100%" height={height} preserveAspectRatio="none">
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 24);
          const x = i * barWidth + barWidth * 0.2;
          const w = barWidth * 0.6;
          const y = height - 24 - barHeight;
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={w} height={barHeight} fill="#c9992e" rx="0.6" />
              <text x={x + w / 2} y={height - 10} fontSize="4" textAnchor="middle" fill="#6b7a71">
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-around", marginTop: "4px" }}>
        {data.map((d) => (
          <span key={d.label} style={{ fontSize: "0.72rem", color: "var(--muted)", flex: 1, textAlign: "center" }}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
