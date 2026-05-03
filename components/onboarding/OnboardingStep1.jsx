import React from 'react';
import {
  BLUE_GRAD,
  BTN_H,
  C,
  GLOW,
  ONBOARD_PREMIUM_BG,
  ONBOARD_PREMIUM_CARD,
  ONBOARD_PROFILE_H_PAD,
  ONBOARD_PROFILE_WRAP,
} from '../../lib/onboardingTokens.js';
import {
  ArrowSVG,
  AthleteSVG,
  BtnBack,
  CalSVG,
  ChartSVG,
  CheckSVG,
  ClipboardSVG,
  CoachSVG,
  OnboardingProgress3,
  TrendSVG,
  UserGroupSVG,
} from './OnboardingPrimitives.jsx';

/* ═══════════════════════════════════════════
   PASO 1 — ROL
═══════════════════════════════════════════ */
const Step1 = ({onNext,onBack,role: activeRole,setRole}) => {
  const cardPad = "clamp(20px, 2.2vw, 34px)";
  const roles = [
    {
      id: "entrenador",
      title: "Entrenador",
      desc: "Creás rutinas, asignás planes y seguís el progreso.",
      chips: ["Rutinas", "Alumnos", "Progreso", "Chat"],
      icon: (sel) => <CoachSVG color={sel ? "#2563EB" : "#8B9AB2"} size={28} />,
      hints: [
        { t: "+12 alumnos activos", g: (k) => <UserGroupSVG key={k} color="#8B9AB2" size={16} /> },
        { t: "Seguimiento semanal", g: (k) => <ChartSVG key={k} color="#8B9AB2" size={16} /> },
        { t: "PRs automáticos", g: (k) => <TrendSVG key={k} color="#8B9AB2" size={16} /> },
      ],
    },
    {
      id: "atleta",
      title: "Atleta",
      desc: "Seguís tu plan y registrás cada sesión.",
      chips: ["Mi plan", "Sesiones", "Historial", "PRs"],
      icon: (sel) => <AthleteSVG color={sel ? "#2563EB" : "#8B9AB2"} size={28} />,
      hints: [
        { t: "Plan semanal", g: (k) => <CalSVG key={k} color="#8B9AB2" size={16} /> },
        { t: "Registro de sesiones", g: (k) => <ClipboardSVG key={k} color="#8B9AB2" size={16} /> },
        { t: "Tus PRs", g: (k) => <ChartSVG key={k} color="#8B9AB2" size={16} /> },
      ],
    },
  ];
  return (
    <div
      style={{
        flex: 1,
        width: "100%",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        background: ONBOARD_PREMIUM_BG,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          ...ONBOARD_PROFILE_WRAP,
          padding: "clamp(16px, 3.5svh, 32px) " + ONBOARD_PROFILE_H_PAD + "px 0",
          flexShrink: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.2em",
            color: "rgba(96,165,250,0.7)",
            marginBottom: 8,
            textTransform: "uppercase",
            fontFamily: "system-ui,sans-serif",
          }}
        >
          TU PERFIL
        </div>
        <h1
          style={{
            fontSize: "clamp(34px, 3.2vw, 56px)",
            fontWeight: 900,
            color: "#F8FAFC",
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
            margin: "0 0 8px",
            fontFamily: "system-ui,sans-serif",
          }}
        >
          ¿CÓMO USÁS <span style={{ color: "#2563EB" }}>LA APP?</span>
        </h1>
        <p
          style={{
            fontSize: "clamp(16px, 1.1vw, 19px)",
            color: "rgba(255,255,255,0.52)",
            lineHeight: 1.5,
            margin: 0,
            maxWidth: "100%",
            marginLeft: "auto",
            marginRight: "auto",
            fontFamily: "system-ui,sans-serif",
          }}
        >
          Esto cambia tu experiencia en IronTrack.
        </p>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            minHeight: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            boxSizing: "border-box",
            padding: "12px 0 8px",
          }}
        >
          <div
            style={{
              ...ONBOARD_PROFILE_WRAP,
              padding: "0 " + ONBOARD_PROFILE_H_PAD + "px 8px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {roles.map((r) => {
                const sel = activeRole === r.id;
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setRole(r.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setRole(r.id))}
                    style={{
                      background: ONBOARD_PREMIUM_CARD,
                      border: "2px solid " + (sel ? "#2563EB" : "rgba(255,255,255,0.1)"),
                      borderRadius: 22,
                      padding: cardPad,
                      cursor: "pointer",
                      boxSizing: "border-box",
                      width: "100%",
                      opacity: sel ? 1 : 0.78,
                      transform: sel ? "scale(1.01)" : "scale(1)",
                      boxShadow: sel ? "0 0 0 1px rgba(37,99,235,0.2),0 0 32px rgba(37,99,235,0.2),0 8px 28px rgba(0,0,0,0.2)" : "none",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease, border-color 0.2s ease",
                      outline: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 10 }}>
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 16,
                          flexShrink: 0,
                          background: sel ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.04)",
                          border: "1px solid " + (sel ? "rgba(37,99,235,0.35)" : "rgba(255,255,255,0.08)"),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {r.icon(sel)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <div
                          style={{
                            fontSize: "clamp(20px, 1.3vw, 24px)",
                            fontWeight: 800,
                            color: "#F8FAFC",
                            letterSpacing: "0.1px",
                            marginBottom: 6,
                            fontFamily: "system-ui,sans-serif",
                          }}
                        >
                          {r.title}
                        </div>
                        <div
                          style={{
                            fontSize: "clamp(14px, 0.9vw, 16px)",
                            color: "rgba(255,255,255,0.55)",
                            lineHeight: 1.5,
                            fontFamily: "system-ui,sans-serif",
                          }}
                        >
                          {r.desc}
                        </div>
                      </div>
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          border: "2px solid " + (sel ? "#2563EB" : "rgba(255,255,255,0.2)"),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: 4,
                        }}
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#2563EB",
                            opacity: sel ? 1 : 0,
                            transform: sel ? "scale(1)" : "scale(0)",
                            transition: "all 0.2s ease",
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                      {r.chips.map((c) => (
                        <span
                          key={c}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            padding: "5px 12px",
                            borderRadius: 999,
                            background: sel ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.06)",
                            color: sel ? "#BFDBFE" : "rgba(255,255,255,0.5)",
                            fontFamily: "system-ui,sans-serif",
                            border: "1px solid " + (sel ? "rgba(37,99,235,0.35)" : "rgba(255,255,255,0.1)"),
                          }}
                        >
                          {sel && <CheckSVG size={10} color="#93C5FD" />}
                          {c}
                        </span>
                      ))}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      {r.hints.map((h, i) => (
                        <div
                          key={i}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                            color: "rgba(255,255,255,0.5)",
                            lineHeight: 1.35,
                            fontFamily: "system-ui,sans-serif",
                          }}
                        >
                          {h.g(i)}
                          <span>{h.t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "0 0 max(6px, env(safe-area-inset-bottom, 0px))",
          flexShrink: 0,
          background: ONBOARD_PREMIUM_BG,
          opacity: activeRole ? 1 : 0.9,
          transform: activeRole ? "translateY(0)" : "translateY(4px)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        <div style={{ ...ONBOARD_PROFILE_WRAP, padding: "0 " + ONBOARD_PROFILE_H_PAD + "px" }}>
          <OnboardingProgress3 text="Paso 2 de 3" filled={2} barMaxWidth="100%" progressFontSize={13} />
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 10,
              minHeight: BTN_H,
              maxWidth: 520,
              width: "100%",
              margin: "0 auto 6px",
            }}
          >
            <BtnBack onClick={onBack} />
            <button
              type="button"
              onClick={onNext}
              disabled={!activeRole}
              style={{
                flex: 1,
                minWidth: 0,
                maxWidth: 520,
                minHeight: BTN_H,
                border: "none",
                borderRadius: 16,
                background: !activeRole ? "rgba(37,99,235,0.15)" : BLUE_GRAD,
                color: !activeRole ? "rgba(255,255,255,0.4)" : C.text,
                fontFamily: "system-ui,sans-serif",
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: 0.05,
                textTransform: "none",
                cursor: activeRole ? "pointer" : "not-allowed",
                boxShadow: !activeRole ? "none" : GLOW,
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "0 10px",
              }}
            >
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {activeRole === "entrenador" ? "Continuar como entrenador" : activeRole === "atleta" ? "Continuar como atleta" : "Elegí un perfil"}
              </span>
              <ArrowSVG size={16} />
            </button>
          </div>
          <div
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
              fontWeight: 500,
              fontFamily: "system-ui,sans-serif",
              lineHeight: 1.4,
            }}
          >
            Podés cambiarlo después en ajustes.
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   PASO 2 — NOMBRE (TODOS los usuarios)
═══════════════════════════════════════════ */

export default Step1;
