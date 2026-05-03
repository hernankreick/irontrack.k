import React from 'react';
import {
  LANDING_CTA_GRAD,
  LANDING_GYM_URL,
  LANDING_MAX_W,
  LANDING_OVERLAY_GRAD,
  ONBOARD_CONTENT_WRAP,
} from '../../lib/onboardingTokens.js';
import {
  ChartSVG,
  ClipboardSVG,
  LandingStepDots4,
  UserGroupSVG,
} from './OnboardingPrimitives.jsx';
import IronTrackAppIcon from '../IronTrackAppIcon.jsx';

const Step0 = ({es, onNext, onYaTengoCuenta}) => {
  const [vis,setVis] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setVis(true), 100);
    return () => clearTimeout(t);
  }, []);
  const a = (d = 0) => ({
    opacity: vis ? 1 : 0,
    transform: vis ? "translateY(0)" : "translateY(14px)",
    transition: `all .6s cubic-bezier(.16,1,.3,1) ${d}ms`,
  });
  const trackTitlePx = 54;
  const trackBarH = Math.round(trackTitlePx * 0.9);

  return (
    <div
      style={{
        flex: 1,
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        background: "#050A14",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Fondo gimnasio + blur sutil (capa con overflow) */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "120%",
            height: "120%",
            transform: "translate(-50%,-50%)",
            backgroundImage: 'url("' + LANDING_GYM_URL + '")',
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            filter: "brightness(0.3) saturate(0.5) blur(3px)",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: LANDING_OVERLAY_GRAD,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 5,
          flex: 1,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "48px 24px 32px",
          boxSizing: "border-box",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Bloque central: scroll + centrado vertical */}
        <div
          style={{
            flex: "0 1 auto",
            minHeight: 0,
            width: "calc(100vw - 48px)",
            maxWidth: LANDING_MAX_W,
            overflowY: "visible",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            transform: "translateY(-4%)",
          }}
        >
          <div
            style={{ ...ONBOARD_CONTENT_WRAP, padding: 0 }}
          >
            <div
              style={{
                ...a(0),
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                marginBottom: 0,
              }}
            >
              <IronTrackAppIcon size="clamp(128px, 34vw, 172px)" animated={false} style={{ marginBottom: 28 }} />

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textTransform: "uppercase",
                }}
              >
                <div
                  style={{
                    fontSize: trackTitlePx,
                    fontWeight: 900,
                    color: "#FFFFFF",
                    lineHeight: 0.9,
                    letterSpacing: "-1px",
                    textShadow: "0 2px 24px rgba(0,0,0,0.85)",
                  }}
                >
                  IRON
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 0,
                    gap: 8,
                    marginLeft: 4,
                  }}
                >
                  <div
                    style={{
                      width: 3,
                      height: trackBarH,
                      minHeight: 36,
                      background: "#2563EB",
                      borderRadius: 2,
                      boxShadow: "0 0 8px rgba(37,99,235,0.4)",
                    }}
                  />
                  <div
                    style={{
                      fontSize: trackTitlePx,
                      fontWeight: 900,
                      color: "#2563EB",
                      lineHeight: 0.9,
                      letterSpacing: "-1px",
                      textShadow: "0 0 20px rgba(37,99,235,0.35)",
                    }}
                  >
                    TRACK
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                ...a(100),
                textAlign: "center",
                marginTop: 20,
                marginBottom: 22,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#FFFFFF",
                  lineHeight: 1.15,
                }}
              >
                {es ? "Convertí datos en resultados reales" : "Turn data into real results"}
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: "rgba(255,255,255,0.68)",
                  textAlign: "center",
                  lineHeight: 1.4,
                  marginTop: 10,
                }}
              >
                {es
                  ? "Rutinas, alumnos y progresión — en un solo lugar."
                  : "Routines, athletes, and progression — in one place."}
              </div>
            </div>

            <div
              style={{
                ...a(200),
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 8,
              }}
            >
              {[
                {
                  icon: <ClipboardSVG color="#2563EB" size={20} />,
                  t: es ? "Rutinas personalizadas" : "Personalized routines",
                  s: es ? "Diseñadas para cada objetivo." : "Built for every goal.",
                },
                {
                  icon: <UserGroupSVG color="#2563EB" size={20} />,
                  t: es ? "Seguimiento de alumnos" : "Athlete tracking",
                  s: es
                    ? "Controlá el progreso en tiempo real."
                    : "Track progress in real time.",
                },
                {
                  icon: <ChartSVG color="#2563EB" size={20} />,
                  t: es ? "Progresión inteligente" : "Smart progression",
                  s: es ? "Mejorá semana a semana." : "Improve week by week.",
                },
              ].map((f, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(13,20,36,0.78)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 16,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      minWidth: 44,
                      borderRadius: 12,
                      background: "rgba(6,10,20,0.7)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {f.icon}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, textAlign: "left" }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF" }}>{f.t}</span>
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.68)", lineHeight: 1.35 }}>{f.s}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA + indicador + link — mismo ancho max que el contenido */}
        <div
          style={{
            position: "relative",
            zIndex: 6,
            flexShrink: 0,
            width: "calc(100vw - 48px)",
            maxWidth: LANDING_MAX_W,
            paddingTop: 8,
            paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))",
            background: "transparent",
            boxSizing: "border-box",
            transform: "translateY(-4%)",
          }}
        >
          <div style={{ ...ONBOARD_CONTENT_WRAP, padding: "12px 0 8px" }}>
            <button
              type="button"
              onClick={onNext}
              className="active:scale-[0.97]"
              style={{
                width: "100%",
                maxWidth: "100%",
                height: 64,
                borderRadius: 16,
                border: "none",
                cursor: "pointer",
                background: LANDING_CTA_GRAD,
                color: "#FFFFFF",
                fontFamily: "system-ui,sans-serif",
                fontSize: 14,
                fontWeight: 900,
                letterSpacing: 1,
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                boxShadow: "0 12px 32px rgba(0,0,0,0.28)",
                transition: "transform 120ms ease",
                boxSizing: "border-box",
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>→</span>
              {es ? "EMPEZAR GRATIS" : "GET STARTED FREE"}
            </button>
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.55)",
                textAlign: "center",
                marginTop: 18,
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              {es ? "Paso 1 de 4" : "Step 1 of 4"}
            </div>
            <LandingStepDots4 />
            <button
              type="button"
              onClick={onYaTengoCuenta}
              className="mt-3 w-full cursor-pointer border-0 bg-transparent p-0 text-center"
              style={{
                fontFamily: "system-ui,sans-serif",
                fontSize: 15,
                fontWeight: 600,
                lineHeight: 1.4,
                marginTop: 14,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.55)" }}>
                {es ? "Ya tengo cuenta — " : "I already have an account — "}
              </span>
              <span style={{ color: "#2563EB", fontWeight: 700 }}>{es ? "ingresar" : "sign in"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step0;
