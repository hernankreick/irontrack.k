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

// Isotipo recortado (sin baldosa cuadrada del ícono de app). Derivado de icon-1024.png; no reemplaza al ícono oficial.
const ONBOARD_ISOTIPO_SRC = "/isotipo-onboarding.png";
const ONBOARD_ISOTIPO_SIZE = "clamp(88px, min(40vw, calc((100dvh - var(--it-safe-top, env(safe-area-inset-top, 0px))) * 0.165)), 156px)";

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
  // Tipografía IRON/TRACK proporcional al alto: 54 px en pantallas altas, menos en bajas.
  const trackTitlePx = "clamp(40px, 6.4vh, 54px)";
  const trackBarH = "clamp(36px, 5.76vh, 49px)";

  return (
    <div
      style={{
        // Alto fijo = viewport: el scroll vive en el contenedor interior y el CTA queda sticky abajo.
        flex: "0 0 auto",
        height: "100dvh",
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
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          // Zona segura superior (notch / Dynamic Island) + aire; --it-safe-top permite emularla en QA.
          padding:
            "calc(var(--it-safe-top, env(safe-area-inset-top, 0px)) + clamp(20px, 2.4vh, 28px)) 24px 0",
          boxSizing: "border-box",
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Bloque central: scroll + centrado vertical */}
        <div
          style={{
            flex: "0 0 auto",
            width: "100%",
            maxWidth: LANDING_MAX_W,
            overflowY: "visible",
            display: "flex",
            flexDirection: "column",
            // margin auto centra si sobra alto y nunca recorta por arriba si el contenido desborda.
            margin: "auto 0",
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
              <img
                src={ONBOARD_ISOTIPO_SRC}
                alt="IronTrack"
                width={512}
                height={512}
                draggable={false}
                style={{
                  width: ONBOARD_ISOTIPO_SIZE,
                  height: ONBOARD_ISOTIPO_SIZE,
                  aspectRatio: "1 / 1",
                  display: "block",
                  objectFit: "contain",
                  flexShrink: 0,
                  marginBottom: "clamp(6px, 1.6vh, 22px)",
                }}
              />

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
                marginTop: "clamp(8px, 1.8vh, 20px)",
                marginBottom: "clamp(10px, 2vh, 22px)",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(19px, 2.6vh, 22px)",
                  fontWeight: 800,
                  color: "#FFFFFF",
                  lineHeight: 1.15,
                }}
              >
                {es ? "Convertí datos en resultados reales" : "Turn data into real results"}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.68)",
                  textAlign: "center",
                  lineHeight: 1.35,
                  marginTop: "clamp(4px, 1vh, 10px)",
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
                gap: "clamp(6px, 1.1vh, 12px)",
                marginBottom: "clamp(8px, 1.2vh, 16px)",
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
                    padding: "clamp(8px, 1.4vh, 14px) 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                  }}
                >
                  <div
                    style={{
                      width: "clamp(38px, 5vh, 44px)",
                      height: "clamp(38px, 5vh, 44px)",
                      minWidth: "clamp(38px, 5vh, 44px)",
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, textAlign: "left" }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF" }}>{f.t}</span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.68)", lineHeight: 1.3 }}>{f.s}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA + indicador + link — mismo ancho max que el contenido */}
        <div
          style={{
            // Siempre visible: sticky abajo dentro del contenedor con scroll; el contenido pasa por debajo.
            position: "sticky",
            bottom: 0,
            zIndex: 6,
            flexShrink: 0,
            alignSelf: "stretch",
            margin: "0 -24px",
            padding: "clamp(6px, 1.2vh, 12px) 24px max(12px, env(safe-area-inset-bottom, 0px))",
            background:
              "linear-gradient(180deg, rgba(5,10,20,0) 0%, rgba(5,10,20,0.94) 14px, rgba(5,10,20,0.98) 100%)",
            // Mismo tipo de capa que las tarjetas (backdrop-filter) para que no se transparenten sobre el CTA.
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxSizing: "border-box",
          }}
        >
          <div style={{ ...ONBOARD_CONTENT_WRAP, padding: 0 }}>
            <button
              type="button"
              onClick={onNext}
              className="active:scale-[0.97]"
              style={{
                width: "100%",
                maxWidth: "100%",
                height: "clamp(52px, 7.2vh, 64px)",
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
                marginTop: "clamp(8px, 1.6vh, 16px)",
                marginBottom: "clamp(6px, 1vh, 10px)",
                fontWeight: 600,
              }}
            >
              {es ? "Paso 1 de 4" : "Step 1 of 4"}
            </div>
            <LandingStepDots4 />
            <button
              type="button"
              onClick={onYaTengoCuenta}
              className="w-full cursor-pointer border-0 bg-transparent p-0 text-center"
              style={{
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexWrap: "wrap",
                columnGap: "0.3em",
                fontFamily: "system-ui,sans-serif",
                fontSize: 15,
                fontWeight: 600,
                lineHeight: 1.4,
                marginTop: 0,
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.55)" }}>
                {es ? "Ya tengo cuenta —" : "I already have an account —"}
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
