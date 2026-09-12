"use client";

export default function DonutChart({
  segments,
  size = 140,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offsetSoFar = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e9e4" strokeWidth="14" />
        {segments.map((s) => {
          const fraction = s.value / total;
          const dash = fraction * circumference;
          const circle = (
            <circle
              key={s.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offsetSoFar}
              transform="rotate(-90 50 50)"
            />
          );
          offsetSoFar += dash;
          return circle;
        })}
        <text x="50" y="54" textAnchor="middle" fontSize="16" fontFamily="Georgia, serif" fill="#163a2b">
          {total}
        </text>
      </svg>
      <div>
        {segments.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", fontSize: "0.85rem" }}>
            <span style={{ width: "10px", height: "10px", background: s.color, display: "inline-block", borderRadius: "2px" }} />
            <span style={{ color: "var(--slate)" }}>{s.label}</span>
            <span style={{ fontWeight: 600 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
