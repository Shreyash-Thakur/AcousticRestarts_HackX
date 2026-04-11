import { useEffect, useRef, useState } from "react";

const scoreColor = (score) => {
  if (score >= 80) return "#15803D";   // deep forest green
  if (score >= 60) return "#B45309";   // warm amber
  return "#B91C1C";                    // deep red
};
const scoreTrackColor = (score) => {
  if (score >= 80) return "rgba(21,128,61,0.10)";
  if (score >= 60) return "rgba(180,83,9,0.10)";
  return "rgba(185,28,28,0.10)";
};

export function TrustScoreRing({ score, size = 120, showLabel = true, strokeWidth = 9 }) {
  const [animated, setAnimated] = useState(0);
  const ref = useRef(null);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;
  const color = scoreColor(score);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setAnimated(score); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [score]);

  return (
    <div ref={ref} style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={scoreTrackColor(score)}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      {showLabel && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <span style={{
            fontFamily: "var(--font-head)",
            fontSize: size > 100 ? "1.55rem" : "0.95rem",
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}>{score}</span>
          {size > 100 && (
            <span style={{
              fontSize: "0.65rem",
              color: "var(--text-dim)",
              marginTop: "0.2rem",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              fontFamily: "var(--font-body)",
            }}>
              TRUST
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function SubScoreBar({ label, value }) {
  const [width, setWidth] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setWidth(value); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value]);

  const color = scoreColor(value);

  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.83rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>{label}</span>
        <span style={{ fontSize: "0.83rem", fontWeight: 700, color, fontFamily: "var(--font-body)" }}>{value}</span>
      </div>
      <div style={{ background: scoreTrackColor(value), borderRadius: "999px", height: 6, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${width}%`,
            background: color,
            borderRadius: "999px",
            transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
  );
}
