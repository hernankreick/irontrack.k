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
  BtnBack,
  BtnRow,
  CalSVG,
  ChartSVG,
  CheckSVG,
  CoachSVG,
  PersonSVG,
} from './OnboardingPrimitives.jsx';

const Step2Name = ({onNext,onBack,role,name,setName}) => {
  const isCoach = role==="entrenador";
  const inputRef = React.useRef(null);
  const [vis,setVis] = React.useState(false);
  const [inputFocus, setInputFocus] = React.useState(false);
  const nm = typeof name === "string" ? name.trim() : "";
  const initial = nm ? nm.charAt(0).toUpperCase() : "?";
  const previewPad = "clamp(20px, 2.2vw, 34px)";
  const inputH = "clamp(58px, 4.5vw, 72px)";

  React.useEffect(()=>{
    const t1=setTimeout(()=>setVis(true),60);
    const t2=setTimeout(()=>inputRef.current?.focus(),300);
    return()=>{clearTimeout(t1);clearTimeout(t2);};
  },[]);

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
        opacity: vis ? 1 : 0,
        transform: vis ? "translateY(0)" : "translateY(18px)",
        transition: "all .5s cubic-bezier(.16,1,.3,1)",
      }}
    >
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
            padding: "clamp(8px, 1.2svh, 20px) 0 12px",
          }}
        >
          <div
            style={{
              ...ONBOARD_PROFILE_WRAP,
              padding: "0 " + ONBOARD_PROFILE_H_PAD + "px",
            }}
          >
        <div
          style={{
            textAlign: "center",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.2em",
            color: "rgba(96,165,250,0.7)",
            marginBottom: 8,
            textTransform: "uppercase",
            fontFamily: "system-ui,sans-serif",
          }}
        >
          {isCoach ? "TU IDENTIDAD PROFESIONAL" : "SOBRE VOS"}
        </div>
        <h1
          style={{
            fontSize: "clamp(34px, 3.2vw, 56px)",
            fontWeight: 900,
            color: "#F8FAFC",
            lineHeight: 1.1,
            letterSpacing: "-0.4px",
            margin: "0 0 10px",
            fontFamily: "system-ui,sans-serif",
          }}
        >
          {isCoach ? (
            <>¿CÓMO TE <span style={{ color: "#2563EB" }}>VAN A LLAMAR?</span></>
          ) : (
            <>¿CÓMO QUERÉS <span style={{ color: "#2563EB" }}>QUE TE LLAMEMOS?</span></>
          )}
        </h1>
        <p
          style={{
            fontSize: "clamp(16px, 1.1vw, 19px)",
            color: "rgba(255,255,255,0.52)",
            lineHeight: 1.5,
            margin: "0 0 16px",
            fontFamily: "system-ui,sans-serif",
            maxWidth: "100%",
            textAlign: "center",
          }}
        >
          {isCoach ? "Este es el nombre que van a ver en la app." : "Así te va a ver tu entrenador en la app."}
        </p>

        <div style={{ width: "100%", textAlign: "left" }}>
        <div style={{ position: "relative", marginBottom: 16 }}>
          <div style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", zIndex: 1 }}>
            <PersonSVG color={inputFocus || nm ? "#2563EB" : "#4B6480"} size={25} />
          </div>
          <input
            ref={inputRef}
            value={name}
            onChange={e=>setName(e.target.value)}
            onFocus={()=>setInputFocus(true)}
            onBlur={()=>setInputFocus(false)}
            onKeyDown={e=>e.key==="Enter"&&nm&&onNext()}
            placeholder="Ej: Hernán"
            style={{
              width: "100%",
              height: inputH,
              minHeight: 58,
              background: "rgba(13,20,36,0.65)",
              border: inputFocus ? "1.5px solid #2563EB" : "1.5px solid " + (nm ? "#2563EB" : "rgba(255,255,255,0.1)"),
              borderRadius: 16,
              color: "#F8FAFC",
              fontSize: "clamp(20px, 1.4vw, 24px)",
              fontWeight: 600,
              padding: "0 60px 0 54px",
              outline: "none",
              fontFamily: "system-ui,sans-serif",
              boxSizing: "border-box",
              transition: "border .2s ease, box-shadow .2s ease, background .2s ease",
              boxShadow: inputFocus ? "0 0 0 3px rgba(37,99,235,0.22), 0 0 20px rgba(37,99,235,0.12)" : "none",
            }}
          />
        {!!nm && (
          <div
            key={nm}
            style={{
            position: "absolute",
            right: 12,
            top: "50%",
            marginTop: -18,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#2563EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(37,99,235,0.45)",
            transition: "transform 0.28s cubic-bezier(0.34,1.4,0.64,1)",
            transform: "scale(1)",
            }}
          >
            <CheckSVG size={18}/>
          </div>
        )}
        </div>

        <div style={{
          background:ONBOARD_PREMIUM_CARD,
          border:"1px solid rgba(37,99,235,0.12)",
          borderRadius:20,
          padding: previewPad,
          marginBottom: 0,
          width: "100%",
          opacity: nm ? 1 : 0.35, transition: "opacity 0.25s ease",
        }}>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:"rgba(255,255,255,0.38)",textTransform:"uppercase",marginBottom:12,fontFamily:"system-ui,sans-serif"}}>ASÍ VA A APARECER TU PERFIL</div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <div
              key={initial + nm}
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #2563EB, #1d4ed8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "clamp(24px, 1.4vw, 30px)",
                fontWeight: 900,
                color: "#fff",
                flexShrink: 0,
                fontFamily: "system-ui,sans-serif",
                transition: "transform 0.2s ease",
                transform: "scale(1)",
              }}
            >
              {nm ? initial : "?"}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: "clamp(24px, 1.4vw, 32px)",
                  fontWeight: 900,
                  color: "#F8FAFC",
                  lineHeight: 1.1,
                  letterSpacing: "0.02em",
                  fontFamily: "system-ui,sans-serif",
                  transition: "opacity 0.2s ease",
                  textTransform: isCoach && nm ? "uppercase" : "none",
                }}
              >
                {nm ? (isCoach ? nm.toUpperCase() : nm) : "Tu nombre"}
              </div>
              {isCoach ? (
                <div style={{ fontSize: 13, color: "#60A5FA", marginTop: 5, fontWeight: 700, fontFamily: "system-ui,sans-serif" }}>Alumnos activos: 0</div>
              ) : (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4, fontWeight: 600, fontFamily: "system-ui,sans-serif" }}>Próxima sesión: —</div>
              )}
            </div>
          </div>

          {isCoach ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%" }}>
              <div
                style={{
                  padding: "12px 10px",
                  borderRadius: 12,
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "system-ui,sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span style={{ opacity: 0.6 }}>+</span> <CalSVG color="#8B9AB2" size={16} />
                <span style={{ textAlign: "center" }}>Crear rutina</span>
              </div>
              <div
                style={{
                  padding: "12px 10px",
                  borderRadius: 12,
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "system-ui,sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span style={{ opacity: 0.6 }}>+</span> <CoachSVG color="#8B9AB2" size={16} />
                <span style={{ textAlign: "center" }}>Agregar alumno</span>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: "100%" }}>
              <div
                style={{
                  padding: "12px 10px",
                  borderRadius: 12,
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "system-ui,sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span style={{ opacity: 0.6 }}>+</span> <CalSVG color="#8B9AB2" size={16} />
                <span>Ver mi plan</span>
              </div>
              <div
                style={{
                  padding: "12px 10px",
                  borderRadius: 12,
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "system-ui,sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span style={{ opacity: 0.6 }}>+</span> <ChartSVG color="#8B9AB2" size={16} />
                <span>Registrar sesión</span>
              </div>
            </div>
          )}

        <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(22,101,52,0.28)",borderRadius:12,padding:"16px 18px",border:"1px solid rgba(52,211,153,0.35)",marginTop:16,width:"100%",boxSizing:"border-box"}}>
          <CheckSVG color="#4ADE80" size={20}/>
          <span style={{fontSize:15,color:"#BBF7D0",fontWeight:700,fontFamily:"system-ui,sans-serif",lineHeight:1.4,flex:1}}>
            {isCoach ? "Tu cuenta de entrenador está lista." : "Tu perfil de atleta está listo."}
          </span>
        </div>
        </div>
        </div>
        </div>
        </div>
      </div>

      <BtnRow
        total={3}
        current={2}
        progressLabel="Paso 3 de 3"
        progressBarFilled={3}
        footerBg={ONBOARD_PREMIUM_BG}
        contentWrap={ONBOARD_PROFILE_WRAP}
        progressBarWidth="100%"
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 10,
            width: "100%",
            maxWidth: 520,
            margin: "0 auto",
            minHeight: BTN_H,
            height: BTN_H,
            alignItems: "stretch",
          }}
        >
        <BtnBack onClick={onBack}/>
        <button
          type="button"
          onClick={onNext}
          disabled={!nm}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: BTN_H,
            background: !nm ? "rgba(255,255,255,0.06)" : BLUE_GRAD,
            border: "none",
            borderRadius: 16,
            color: !nm ? C.muted : C.text,
            fontFamily: "system-ui,sans-serif",
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 0.2,
            textTransform: "none",
            cursor: !nm ? "not-allowed" : "pointer",
            boxShadow: !nm ? "none" : GLOW,
            transition: "all 0.25s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Crear mi perfil</span>
          <ArrowSVG size={16} />
        </button>
        </div>
      </BtnRow>
    </div>
  );
};

export default Step2Name;
