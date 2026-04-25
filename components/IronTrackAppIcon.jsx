import React, { useEffect, useId, useState } from "react";

/**
 * Logo tipo app IronTrack (referencia visual): mancuerna oscura mate,
 * barra vertical azul (#3B82F6) con brillo suave, anillo ~270° activo
 * y cuarto superior izquierdo inactivo, fondo navy→negro con esquinas redondeadas.
 */
function IronTrackAppGlyph({ size = 120 }) {
  const uid = useId().replace(/:/g, "");
  const gMetal = `it-metal-${uid}`;
  const gMetalTop = `it-metal-top-${uid}`;
  const gBar = `it-bar-${uid}`;
  const gRing = `it-ring-${uid}`;
  const fGlow = `it-glow-${uid}`;
  const fBarGlow = `it-bar-glow-${uid}`;
  const fShadow = `it-shadow-${uid}`;

  const vb = 120;
  const cx = 60;
  const cy = 60;
  const rRing = 44;
  const swRing = 5.5;
  const inactiveD = `M ${cx - rRing} ${cy} A ${rRing} ${rRing} 0 0 0 ${cx} ${cy - rRing}`;
  const activeD = `M ${cx} ${cy - rRing} A ${rRing} ${rRing} 0 1 0 ${cx - rRing} ${cy}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${vb} ${vb}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gMetal} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4B5563" />
          <stop offset="45%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1F2937" />
        </linearGradient>
        <linearGradient id={gMetalTop} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="35%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
        </linearGradient>
        <linearGradient id={gBar} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="40%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id={gRing} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <filter id={fGlow} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={fBarGlow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
          <feFlood floodColor="#22D3EE" floodOpacity="0.35" result="cyan" />
          <feComposite in="cyan" in2="blur" operator="in" result="g" />
          <feMerge>
            <feMergeNode in="g" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={fShadow} x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      <circle
        cx={cx}
        cy={cy}
        r={rRing}
        stroke="#1E293B"
        strokeWidth={swRing}
        strokeLinecap="round"
        fill="none"
        opacity={0.95}
      />
      <path
        d={inactiveD}
        stroke="#0F172A"
        strokeWidth={swRing}
        strokeLinecap="round"
        fill="none"
        opacity={0.92}
      />
      <path
        d={inactiveD}
        stroke="#334155"
        strokeWidth={1.2}
        strokeLinecap="round"
        fill="none"
        opacity={0.35}
        transform="translate(0.35, 0.6)"
      />
      <path
        d={activeD}
        stroke={`url(#${gRing})`}
        strokeWidth={swRing}
        strokeLinecap="round"
        fill="none"
        filter={`url(#${fGlow})`}
        opacity={0.98}
      />

      <g filter={`url(#${fShadow})`}>
        <rect x="22" y="48" width="12" height="24" rx="3.5" fill={`url(#${gMetal})`} />
        <rect x="22" y="48" width="12" height="24" rx="3.5" fill={`url(#${gMetalTop})`} />
        <rect x="86" y="48" width="12" height="24" rx="3.5" fill={`url(#${gMetal})`} />
        <rect x="86" y="48" width="12" height="24" rx="3.5" fill={`url(#${gMetalTop})`} />
        <rect x="32" y="54" width="56" height="12" rx="3" fill={`url(#${gMetal})`} />
        <rect x="32" y="54" width="56" height="12" rx="3" fill={`url(#${gMetalTop})`} />
      </g>

      <rect
        x={52}
        y="34"
        width="16"
        height="52"
        rx="5"
        fill={`url(#${gBar})`}
        filter={`url(#${fBarGlow})`}
      />
      <rect
        x={52.5}
        y="34.5"
        width="15"
        height="22"
        rx="4"
        fill="rgba(255,255,255,0.18)"
        opacity={0.55}
      />
    </svg>
  );
}

export default function IronTrackAppIcon({ className, style, "aria-label": ariaLabel, ...rest }) {
  const [isDesktop, setIsDesktop] = useState(
    () => (typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false),
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia("(min-width: 768px)");
    const fn = () => setIsDesktop(m.matches);
    m.addEventListener("change", fn);
    return () => m.removeEventListener("change", fn);
  }, []);
  const box = isDesktop ? 120 : 110;
  const pad = Math.round(box * 0.12);
  const glyph = Math.round(box - pad * 2);

  return (
    <div
      role="img"
      aria-label={ariaLabel != null && ariaLabel !== "" ? ariaLabel : "IronTrack"}
      className={className}
      style={{
        width: box,
        height: box,
        minWidth: box,
        minHeight: box,
        boxSizing: "border-box",
        borderRadius: Math.round(box * 0.22),
        background: "linear-gradient(165deg, #152238 0%, #0c1220 42%, #030508 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -18px 36px rgba(0,0,0,0.45), 0 10px 28px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        padding: pad,
        ...style,
      }}
      {...rest}
    >
      <IronTrackAppGlyph size={glyph} />
    </div>
  );
}
