import React from 'react';
import { Ic } from '../Ic.jsx';
import { getYTVideoId } from '../../lib/getYTVideoId.js';
import { resolveVideoUrl } from '../../lib/exerciseResolve.js';
import { formatKg } from '../../lib/formatKg.js';

function MetricIcon({ name, color }) {
  return (
    <div style={{
      width:28,
      height:28,
      borderRadius:10,
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      background:"rgba(255,255,255,0.035)",
      color:color || "#94A3B8",
    }}>
      <Ic name={name} size={15} color={color || "#94A3B8"} strokeWidth={1.9}/>
    </div>
  );
}

function resolvePrThumbnail(pr, allEx, videoOverrides) {
  var info = (allEx || []).find(function (e) { return String(e.id) === String(pr && pr.exId); });
  var videoUrl = resolveVideoUrl(info || null, { id: pr && pr.exId }, videoOverrides || {});
  var videoId = getYTVideoId(videoUrl || "");
  return videoId ? "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg" : "";
}

function mergeSessionPRs(primary, fallback) {
  var out = [];
  var seen = {};
  [primary, fallback].forEach(function (list) {
    (Array.isArray(list) ? list : []).forEach(function (pr, index) {
      if (!pr || !pr.exId) return;
      var kg = Number(pr.kg);
      if (!(kg > 0)) return;
      var key = String(pr.exId) + "|" + String(kg);
      if (seen[key]) return;
      seen[key] = true;
      out.push(Object.assign({ _idx: index }, pr));
    });
  });
  return out;
}

function SessionSummaryStatsPanel({
  resumenSesion,
  sessionPRList,
  msg,
  allEx,
  videoOverrides,
}) {
  var prList = mergeSessionPRs(sessionPRList, resumenSesion && resumenSesion.prs);
  var prCount = resumenSesion.prsNuevos || prList.length || 0;
  var featuredPr = prList[0] || null;
  var listPrs = prList;
  var streak = resumenSesion.rachaActual || resumenSesion.racha || resumenSesion.streak || 1;
  var metrics = [
    { key:"duration", icon:"clock", label:msg("Duración", "Duration"), value:resumenSesion.durMin + " min", accent:"#F8FAFC" },
    { key:"exercises", icon:"activity", label:msg("Ejercicios", "Exercises"), value:resumenSesion.ejercicios, accent:"#F8FAFC" },
    { key:"volume", icon:"bar-chart-2", label:msg("Volumen total", "Total volume"), value:formatKg(resumenSesion.volTotal), accent:"#F8FAFC" },
    { key:"pr", icon:"award", label:"PR", value:prCount > 0 ? prCount : msg("Sin PR", "No PR"), accent:prCount > 0 ? "#FACC15" : "#94A3B8" },
  ];

  return (
    <div style={{color:"#F8FAFC"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:18,marginBottom:44}}>
        <div style={{
          width:34,
          height:34,
          borderRadius:14,
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          background:"rgba(37,99,235,0.13)",
          border:"1px solid rgba(37,99,235,0.18)",
        }}>
          <Ic name="check-sm" size={19} color="#2563EB" strokeWidth={2.5}/>
        </div>
        <div style={{
          fontSize:12,
          fontWeight:900,
          letterSpacing:1.8,
          color:"#F8FAFC",
          lineHeight:1,
          paddingTop:3,
          whiteSpace:"nowrap",
        }}>
          IRON TRACK
        </div>
      </div>

      <div style={{marginBottom:34}}>
        <div style={{fontSize:"clamp(42px, 12vw, 58px)",lineHeight:0.94,fontWeight:900,letterSpacing:0,color:"#F8FAFC"}}>
          {msg("Entrenamiento", "Workout")}
        </div>
        <div style={{fontSize:"clamp(42px, 12vw, 58px)",lineHeight:0.94,fontWeight:900,letterSpacing:0,color:"#2563EB",marginTop:4}}>
          {msg("completado", "completed")}
        </div>
        <div style={{fontSize:14,lineHeight:1.5,color:"#94A3B8",fontWeight:550,marginTop:18}}>
          {resumenSesion.diaLabel} · {resumenSesion.rutinaName} · {resumenSesion.fecha}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4, minmax(0, 1fr))",gap:8,marginBottom:20}}>
        {metrics.map(function (metric, index) {
          return (
            <div
              key={metric.key}
              data-motion="summary-metric"
              data-motion-index={index}
              style={{
                minWidth:0,
                borderRadius:18,
                padding:"12px 9px 11px",
                background:"rgba(13,20,36,0.72)",
                border:"1px solid rgba(255,255,255,0.05)",
                backdropFilter:"blur(16px)",
                WebkitBackdropFilter:"blur(16px)",
              }}
            >
              <MetricIcon name={metric.icon} color={metric.accent}/>
              <div style={{fontSize:17,fontWeight:900,lineHeight:1.12,color:metric.accent,marginTop:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {metric.value}
              </div>
              <div style={{fontSize:10.5,fontWeight:700,lineHeight:1.2,color:"#94A3B8",marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {metric.label}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        borderRadius:24,
        padding:18,
        background:"rgba(13,20,36,0.72)",
        border:"1px solid rgba(255,255,255,0.05)",
        backdropFilter:"blur(18px)",
        WebkitBackdropFilter:"blur(18px)",
        marginBottom:12,
        position:"relative",
        overflow:"hidden",
      }}>
        <div style={{position:"absolute",left:0,top:18,bottom:18,width:2,background:"rgba(250,204,21,0.55)",borderRadius:2}}/>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:prList.length ? 18 : 0}}>
          <div>
            <div style={{fontSize:23,fontWeight:900,letterSpacing:0,color:"#F8FAFC",lineHeight:1.15}}>
              {msg("Nuevos PR", "New PRs")}
            </div>
            <div style={{fontSize:13,lineHeight:1.45,color:"#94A3B8",fontWeight:520,marginTop:5}}>
              {prCount > 0
                ? msg("Mejoras registradas durante esta sesión.", "Progress recorded in this session.")
                : msg("Sesión sólida. Los PR van a llegar.", "Solid session. PRs will come.")}
            </div>
          </div>
          <div style={{
            minWidth:38,
            height:30,
            padding:"0 10px",
            borderRadius:999,
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            background:prCount > 0 ? "rgba(250,204,21,0.10)" : "rgba(255,255,255,0.035)",
            border:"1px solid " + (prCount > 0 ? "rgba(250,204,21,0.18)" : "rgba(255,255,255,0.05)"),
            color:prCount > 0 ? "#FACC15" : "#94A3B8",
            fontSize:13,
            fontWeight:900,
          }}>
            {prCount}
          </div>
        </div>

        {featuredPr && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[featuredPr].map(function (pr, index) {
              var thumb = resolvePrThumbnail(pr, allEx, videoOverrides);
              var prev = Number(pr.prevKg);
              var kg = Number(pr.kg);
              var pct = Number.isFinite(prev) && Number.isFinite(kg) && kg > 0
                ? Math.max(18, Math.min(100, Math.round((prev / kg) * 100)))
                : 62;
              return (
                <div
                  key={(pr.exId || "pr") + "-" + index}
                  data-motion="summary-pr-row"
                  data-motion-index={index}
                  style={{
                    display:"grid",
                    gridTemplateColumns:"72px minmax(0, 1fr) auto",
                    gap:12,
                    alignItems:"center",
                    padding:10,
                    borderRadius:18,
                    background:"rgba(255,255,255,0.025)",
                  }}
                >
                  <div style={{width:72,height:54,borderRadius:14,overflow:"hidden",background:"rgba(255,255,255,0.04)",position:"relative"}}>
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        loading="lazy"
                        style={{width:"100%",height:"100%",objectFit:"cover",display:"block",filter:"saturate(0.92) contrast(1.02)"}}
                        onError={function (e) { e.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <Ic name="activity" size={18} color="#94A3B8" strokeWidth={1.8}/>
                      </div>
                    )}
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                      <div style={{fontSize:14.5,fontWeight:850,color:"#F8FAFC",lineHeight:1.25,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {pr.ejercicio}
                      </div>
                      <span style={{flexShrink:0,borderRadius:999,padding:"2px 6px",background:"rgba(250,204,21,0.10)",border:"1px solid rgba(250,204,21,0.16)",color:"#FACC15",fontSize:9,fontWeight:900,letterSpacing:0.6}}>
                        NEW
                      </span>
                    </div>
                    <div style={{fontSize:11.5,color:"#94A3B8",fontWeight:650,marginTop:6}}>
                      {msg("Anterior", "Previous")} {formatKg(pr.prevKg)}
                    </div>
                    <div style={{height:3,borderRadius:999,background:"rgba(148,163,184,0.16)",overflow:"hidden",marginTop:9}}>
                      <div style={{width:pct + "%",height:"100%",borderRadius:999,background:"rgba(250,204,21,0.72)"}}/>
                    </div>
                  </div>
                  <div style={{textAlign:"right",paddingLeft:2}}>
                    <div style={{fontSize:23,fontWeight:950,lineHeight:1,color:"#F8FAFC",whiteSpace:"nowrap"}}>
                      {formatKg(pr.kg)}
                    </div>
                    <div style={{fontSize:11.5,fontWeight:800,color:"#FACC15",marginTop:7,whiteSpace:"nowrap"}}>
                      +{formatKg(pr.diff)}
                    </div>
                  </div>
                </div>
              );
            })}
            {listPrs.length > 1 && (
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:2}}>
                <div style={{fontSize:10,fontWeight:850,letterSpacing:1.1,textTransform:"uppercase",color:"rgba(148,163,184,0.78)",padding:"0 2px"}}>
                  {msg("Todos los PR de la sesión", "All PRs this session")}
                </div>
                {listPrs.map(function (pr, index) {
                  var thumb = resolvePrThumbnail(pr, allEx, videoOverrides);
                  return (
                    <div
                      key={(pr.exId || "pr") + "-" + (pr.kg || "") + "-list-" + index}
                      data-motion="summary-pr-list-row"
                      data-motion-index={index}
                      style={{
                        display:"grid",
                        gridTemplateColumns:"42px minmax(0, 1fr) auto",
                        gap:10,
                        alignItems:"center",
                        padding:"9px 10px",
                        borderRadius:15,
                        background:"rgba(255,255,255,0.018)",
                      }}
                    >
                      <div style={{width:42,height:34,borderRadius:10,overflow:"hidden",background:"rgba(255,255,255,0.04)"}}>
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            loading="lazy"
                            style={{width:"100%",height:"100%",objectFit:"cover",display:"block",filter:"saturate(0.92) contrast(1.02)"}}
                            onError={function (e) { e.currentTarget.style.display = "none"; }}
                          />
                        ) : (
                          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <Ic name="activity" size={14} color="#94A3B8" strokeWidth={1.8}/>
                          </div>
                        )}
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                          <div style={{fontSize:13.5,fontWeight:820,color:"#F8FAFC",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                            {pr.ejercicio}
                          </div>
                          <span style={{flexShrink:0,borderRadius:999,padding:"1px 5px",background:"rgba(250,204,21,0.10)",border:"1px solid rgba(250,204,21,0.15)",color:"#FACC15",fontSize:8.5,fontWeight:900,letterSpacing:0.5}}>
                            NEW
                          </span>
                        </div>
                        <div style={{fontSize:11,color:"#94A3B8",fontWeight:650,marginTop:4}}>
                          {msg("Anterior", "Previous")} {formatKg(pr.prevKg)}
                        </div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:15,fontWeight:930,color:"#F8FAFC",whiteSpace:"nowrap"}}>
                          {formatKg(pr.kg)}
                        </div>
                        <div style={{fontSize:10.5,fontWeight:800,color:"#FACC15",marginTop:4,whiteSpace:"nowrap"}}>
                          +{formatKg(pr.diff)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{
        borderRadius:20,
        padding:"15px 16px",
        background:"rgba(13,20,36,0.58)",
        border:"1px solid rgba(255,255,255,0.05)",
        display:"flex",
        alignItems:"center",
        justifyContent:"space-between",
        gap:16,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          <MetricIcon name="zap" color="#94A3B8"/>
          <div style={{fontSize:14,fontWeight:760,color:"#F8FAFC",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
            {msg("Racha actual", "Current streak")}
          </div>
        </div>
        <div style={{fontSize:14,fontWeight:900,color:"#F8FAFC",whiteSpace:"nowrap"}}>
          {streak} {msg("entrenamientos", "workouts")}
        </div>
      </div>
    </div>
  );
}

export default SessionSummaryStatsPanel;
