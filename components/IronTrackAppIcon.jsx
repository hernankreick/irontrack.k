import React, { useId, useMemo } from "react";

/**
 * Ícono de app IronTrack: mancuerna, barra vertical, arco de progreso parcial.
 * `animated`: solo CSS/SVG (sin Lottie). Respeta prefers-reduced-motion vía clase en el padre.
 */
function IronTrackAppGlyph({ uid, glyphPx, animated }) {
  const vb = 120;
  const cx = 60;
  const cy = 60;
  const rRing = 44;
  const swRing = 5.5;
  const inactiveD = `M ${cx - rRing} ${cy} A ${rRing} ${rRing} 0 0 0 ${cx} ${cy - rRing}`;
  const activeD = `M ${cx} ${cy - rRing} A ${rRing} ${rRing} 0 1 0 ${cx - rRing} ${cy}`;

  const gMetal = `it-metal-${uid}`;
  const gMetalTop = `it-metal-top-${uid}`;
  const gBar = `it-bar-${uid}`;
  const gRing = `it-ring-${uid}`;
  const fGlow = `it-glow-${uid}`;
  const fBarGlow = `it-bar-glow-${uid}`;
  const fShadow = `it-shadow-${uid}`;

  return (
    <svg
      width={glyphPx}
      height={glyphPx}
      viewBox={`0 0 ${vb} ${vb}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={animated ? "it-icon-svg" : undefined}
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
        className={animated ? "it-ring-active-path" : undefined}
        d={activeD}
        stroke={`url(#${gRing})`}
        strokeWidth={swRing}
        strokeLinecap="round"
        fill="none"
        filter={`url(#${fGlow})`}
        opacity={0.98}
        {...(animated
          ? {}
          : {
              pathLength: 100,
              strokeDasharray: "75 25",
              strokeDashoffset: 0,
            })}
      />

      <g filter={`url(#${fShadow})`} className={animated ? "it-dumbbell" : undefined}>
        <rect x="22" y="48" width="12" height="24" rx="3.5" fill={`url(#${gMetal})`} />
        <rect x="22" y="48" width="12" height="24" rx="3.5" fill={`url(#${gMetalTop})`} />
        <rect x="86" y="48" width="12" height="24" rx="3.5" fill={`url(#${gMetal})`} />
        <rect x="86" y="48" width="12" height="24" rx="3.5" fill={`url(#${gMetalTop})`} />
        <rect x="32" y="54" width="56" height="12" rx="3" fill={`url(#${gMetal})`} />
        <rect x="32" y="54" width="56" height="12" rx="3" fill={`url(#${gMetalTop})`} />
      </g>

      <g className={animated ? "it-center-bar" : undefined}>
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
      </g>
    </svg>
  );
}

export default function IronTrackAppIcon({
  size = 96,
  animated = false,
  className,
  style,
  "aria-label": ariaLabel,
  ...rest
}) {
  const reactId = useId().replace(/:/g, "");
  const uid = reactId || "it";

  const pad = Math.round(size * 0.12);
  const glyphPx = Math.max(24, Math.round(size - pad * 2));

  const animCss = useMemo(() => {
    if (!animated) return null;
    const arcApprox = 207;
    const tail = arcApprox * 0.25;
    return `
@keyframes it-ring-draw-${uid} {
  from { stroke-dashoffset: ${arcApprox}; opacity: 0.75; }
  to { stroke-dashoffset: ${tail}; opacity: 0.98; }
}
@keyframes it-ring-glow-${uid} {
  0%, 100% { opacity: 0.88; }
  50% { opacity: 1; }
}
@keyframes it-bar-pop-${uid} {
  from { opacity: 0; transform: scale(0.94); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes it-db-in-${uid} {
  from { opacity: 0; transform: translateX(-5px); }
  to { opacity: 1; transform: translateX(0); }
}
.it-wrap-${uid}.it-animated .it-icon-svg .it-ring-active-path {
  stroke-dasharray: ${arcApprox};
  stroke-dashoffset: ${arcApprox};
  animation:
    it-ring-draw-${uid} 1.35s cubic-bezier(0.42, 0, 0.58, 1) forwards,
    it-ring-glow-${uid} 2.8s ease-in-out 1.2s infinite;
}
.it-wrap-${uid}.it-animated .it-icon-svg .it-center-bar {
  transform-origin: 60px 60px;
  animation: it-bar-pop-${uid} 0.85s cubic-bezier(0.42, 0, 0.58, 1) 0.35s both;
}
.it-wrap-${uid}.it-animated .it-icon-svg .it-dumbbell {
  transform-origin: 60px 60px;
  animation: it-db-in-${uid} 0.9s cubic-bezier(0.42, 0, 0.58, 1) 0.45s both;
}
@media (prefers-reduced-motion: reduce) {
  .it-wrap-${uid}.it-animated .it-icon-svg .it-ring-active-path,
  .it-wrap-${uid}.it-animated .it-icon-svg .it-center-bar,
  .it-wrap-${uid}.it-animated .it-icon-svg .it-dumbbell {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0s !important;
  }
}
`;
  }, [animated, uid]);

  const wrapClass = [
    `it-wrap-${uid}`,
    animated ? "it-animated" : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {animCss ? <style dangerouslySetInnerHTML={{ __html: animCss }} /> : null}
      <div
        role="img"
        aria-label={ariaLabel != null && ariaLabel !== "" ? ariaLabel : "IronTrack"}
        className={wrapClass}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          boxSizing: "border-box",
          borderRadius: Math.round(size * 0.22),
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
        <IronTrackAppGlyph uid={uid} glyphPx={glyphPx} animated={animated} />
      </div>
    </>
  );
}
