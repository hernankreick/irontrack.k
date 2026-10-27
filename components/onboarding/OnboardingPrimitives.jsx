import React from 'react';
import {
  BLUE_GRAD,
  BTN_H,
  C,
  GLOW,
  GLOW_G,
  GREEN_GRAD,
  ONBOARD_CONTENT_WRAP,
  ONBOARD_PROFILE_H_PAD,
} from '../../lib/onboardingTokens.js';

/* ═══════════════════════ SVG ICONS ═══════════════════════ */
export const CoachSVG = ({color="#64748B",size=26}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

export const AthleteSVG = ({color="#64748B",size=26}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

export const UserOneSVG = ({color,size=32}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);

export const UserGroupSVG = ({color,size=32}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9"  cy="7" r="3.5"/>
    <circle cx="16" cy="8" r="2.5"/>
    <path d="M1 20c0-3.3 3.1-6 8-6s8 2.7 8 6"/>
    <path d="M18 14c2.5.5 4 2 4 4"/>
  </svg>
);

export const UserTeamSVG = ({color,size=32}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5"  cy="8" r="2.5"/>
    <circle cx="12" cy="6" r="3"/>
    <circle cx="19" cy="8" r="2.5"/>
    <path d="M1 20c0-2.5 1.8-4.5 4-5"/>
    <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6"/>
    <path d="M19 15c2.2.5 4 2.5 4 5"/>
  </svg>
);

export const ChartSVG = ({color="#3B82F6",size=16}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

export const ClipboardSVG = ({ color = "#3B82F6", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="3" width="14" height="20" rx="2"/>
    <path d="M9 3V2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/>
  </svg>
);

export const CalSVG = ({color="#22C55E",size=16}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8"  y1="2" x2="8"  y2="6"/>
    <line x1="3"  y1="10" x2="21" y2="10"/>
  </svg>
);

export const CheckSVG = ({color="white",size=18}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export const ArrowSVG = ({size=16}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

export const InfoSVG = ({color="#3B82F6",size=13}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

export const TrendSVG = ({color="#22C55E",size=16}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

export const PersonSVG = ({color="#3B82F6",size=22}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);

export const BackArrowSVG = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7"/>
  </svg>
);

/* ═══════════════════════ SHARED UI ════════════════════════ */

/* Dots — total visible según rol */
export const Dots = ({total,current,marginBottom=18}) => (
  <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom}}>
    {Array.from({length:total}).map((_,i)=>(
      <div key={i} style={{
        height:4,borderRadius:2,transition:"all .35s",
        width:i===current?28:6,
        background:i===current?C.blue:i<current?"rgba(37,99,235,0.45)":"rgba(255,255,255,0.12)",
      }}/>
    ))}
  </div>
);

export const Tag = ({children,color}) => (
  <div style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:9,fontWeight:700,
    letterSpacing:"2.5px",color:color||C.blueL,textTransform:"uppercase",marginBottom:12}}>
    <div style={{width:3,height:10,background:color||C.blue,borderRadius:2}}/>
    {children}
  </div>
);

export const BtnPrimary = ({children,onClick,done=false,disabled=false}) => (
  <button onClick={onClick} disabled={disabled} style={{
    flex:1,                       /* ocupa el espacio restante */
    height:BTN_H,
    minWidth:0,                   /* permite shrink si hace falta */
    background:done?GREEN_GRAD:disabled?"rgba(255,255,255,0.05)":BLUE_GRAD,
    border:"none",borderRadius:16,color:disabled?C.muted:C.text,
    fontFamily:"system-ui,sans-serif",
    fontSize:13,fontWeight:800,letterSpacing:"1px",
    textTransform:"uppercase",
    whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
    cursor:disabled?"not-allowed":"pointer",
    boxShadow:done?GLOW_G:disabled?"none":GLOW,
    transition:"all .35s cubic-bezier(.16,1,.3,1)",
    display:"flex",alignItems:"center",justifyContent:"center",gap:8,
  }}>
    {done && <CheckSVG size={18}/>}
    {!done && !disabled && <ArrowSVG size={16}/>}
    {children}
  </button>
);

export const BtnBack = ({onClick}) => (
  <button onClick={onClick} style={{
    flexShrink:0,                 /* nunca se achica */
    height:BTN_H,                 /* idéntico al BtnPrimary */
    width:100,                    /* ancho fijo */
    background:"none",
    border:`1px solid ${C.borderSub}`,
    borderRadius:12,color:C.sub,
    fontSize:13,fontWeight:600,
    cursor:"pointer",
    display:"flex",alignItems:"center",justifyContent:"center",gap:6,
    fontFamily:"system-ui,sans-serif",
    whiteSpace:"nowrap",
  }}>
    <BackArrowSVG/> Atrás
  </button>
);

/** “Paso X de 3” + barra de 3 segmentos (onboarding perfiles). */
export const OnboardingProgress3 = ({ text, filled, barMaxWidth, progressFontSize = 12 }) => (
  <div>
    <div
      style={{
        textAlign: "center",
        fontSize: progressFontSize,
        fontWeight: 600,
        color: "rgba(255,255,255,0.55)",
        marginBottom: 4,
        letterSpacing: 0.2,
        fontFamily: "system-ui,sans-serif",
      }}
    >
      {text}
    </div>
    <div
      style={{
        display: "flex",
        gap: 4,
        marginBottom: 8,
        marginLeft: "auto",
        marginRight: "auto",
        ...(barMaxWidth === "100%" ? { width: "100%" } : { maxWidth: barMaxWidth != null ? barMaxWidth : 260 }),
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: i < filled ? "#2563EB" : "rgba(255,255,255,0.14)",
            transition: "background 0.25s ease",
          }}
        />
      ))}
    </div>
  </div>
);

/* Contenido del bloque inferior (progreso + fila de botones). El bloque fijo (safe-area, fondo, ancho) lo aporta OnboardingShell. */
export const BtnRow = ({ total, current, children, progressLabel, progressBarFilled, progressBarWidth }) => (
  <div>
    <div data-onb-kb-hide="">
      {progressLabel != null && progressLabel !== "" ? (
        typeof progressBarFilled === "number" ? (
          <OnboardingProgress3 text={progressLabel} filled={progressBarFilled} barMaxWidth={progressBarWidth != null ? progressBarWidth : 260} progressFontSize={13} />
        ) : (
          <div style={{textAlign:"center",fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.5)",marginBottom:8,letterSpacing:"0.2px",fontFamily:"system-ui,sans-serif"}}>
            {progressLabel}
          </div>
        )
      ) : (
        <Dots total={total} current={current} marginBottom={10}/>
      )}
    </div>
    <div style={{
      display:"flex",flexDirection:"row",
      gap:10,
      height:BTN_H,
    }}>
      {children}
    </div>
  </div>
);

/* Teclado en iOS/Android modernos: el layout viewport NO cambia, solo visualViewport. Mientras el teclado esta abierto
   (visualViewport mas bajo que window.innerHeight) la raiz del shell mide visualViewport (--onb-vh / --onb-vt, que se
   eliminan al cerrarlo, asi que sin teclado el layout es el de siempre) y el input enfocado se lleva al centro del area con scroll. */
export const useOnbViewport = (rootRef) => {
  React.useEffect(() => {
    const el = rootRef.current;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!el || !vv) return undefined;
    let raf = 0;
    const timers = [];
    const apply = () => {
      raf = 0;
      const open = vv.scale <= 1.01 && window.innerHeight - vv.height > 100;
      if (open) {
        el.style.setProperty("--onb-vh", vv.height + "px");
        el.style.setProperty("--onb-vt", vv.offsetTop + "px");
        el.setAttribute("data-onb-kb", "1");
        const ae = document.activeElement;
        if (ae && el.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.scrollIntoView) ae.scrollIntoView({ block: "center" });
      } else {
        el.style.removeProperty("--onb-vh");
        el.style.removeProperty("--onb-vt");
        el.removeAttribute("data-onb-kb");
      }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
    // El teclado de iOS anima ~300 ms: al enfocar/desenfocar se recalcula tras la animacion ademas de los eventos del visualViewport.
    const onFocus = () => { schedule(); timers.push(setTimeout(schedule, 120), setTimeout(schedule, 350)); };
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    el.addEventListener("focusin", onFocus);
    el.addEventListener("focusout", onFocus);
    schedule();
    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      el.removeEventListener("focusin", onFocus);
      el.removeEventListener("focusout", onFocus);
      if (raf) cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [rootRef]);
};

const SAFE_TOP = "var(--it-safe-top, env(safe-area-inset-top, 0px))";

/* Shell compartido de las pantallas 2-5 del onboarding (perfil, nombre, alumnos, final).
   Raiz fixed que cubre el area visible; zona segura superior fija; area central con scroll INTERNO; bloque inferior
   (`bottom`: boton principal / navegacion) hermano fuera del scroll, siempre visible sobre la zona segura inferior. */
export const OnboardingShell = ({ children, bottom, bg = C.bg, wrap = ONBOARD_CONTENT_WRAP, justify = "flex-start", backdrop = null, enter }) => {
  const rootRef = React.useRef(null);
  useOnbViewport(rootRef);
  const animated = enter !== undefined;
  return (
    <div
      ref={rootRef}
      data-onb-root=""
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: "var(--onb-vt, 0px)",
        height: "var(--onb-vh, 100%)",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
        // Horizontal con notch/isla: el contenido no queda bajo las zonas seguras laterales.
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
        background: bg,
        fontFamily: "system-ui,sans-serif",
        ...(animated ? { opacity: enter ? 1 : 0, transition: "opacity .5s cubic-bezier(.16,1,.3,1)" } : null),
      }}
    >
      {backdrop}
      <div data-onb-top="" style={{ flexShrink: 0, height: SAFE_TOP, position: "relative", zIndex: 5 }} />
      <div
        data-onb-scroll=""
        style={{
          position: "relative",
          zIndex: 5,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            ...wrap,
            minHeight: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: justify,
            padding: "clamp(10px, 2vh, 20px) " + ONBOARD_PROFILE_H_PAD + "px 16px",
            ...(animated ? { transform: enter ? "translateY(0)" : "translateY(18px)", transition: "transform .5s cubic-bezier(.16,1,.3,1)" } : null),
          }}
        >
          {children}
        </div>
      </div>
      <div data-onb-bottom="" style={{ position: "relative", zIndex: 5, flexShrink: 0, background: bg, padding: "8px 0 max(12px, env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ ...wrap, padding: "0 " + ONBOARD_PROFILE_H_PAD + "px" }}>{bottom}</div>
      </div>
    </div>
  );
};

export const LandingStepDots4 = () => (
  <div
    style={{
      display: "flex",
      gap: 8,
      justifyContent: "center",
      marginBottom: 0,
    }}
  >
    {[0, 1, 2, 3].map((i) => (
      <div
        key={i}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: i === 0 ? "#2563EB" : "rgba(255,255,255,0.22)",
          transition: "background .25s",
        }}
      />
    ))}
  </div>
);
