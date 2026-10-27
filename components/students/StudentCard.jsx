import React from 'react';
import { Ic } from '../Ic.jsx';
import { getRutinaBadgeConfig } from '../../lib/routineStore.js';
import StudentActionsMenu from './StudentActionsMenu.jsx';
import { studentCardPalette } from './studentCardPalette.js';

/**
 * Tarjeta de alumno en Alumnos. Expandida, la ficha (children: tarjeta de rutina, notas...) va debajo como tarjetas hermanas, a todo el ancho.
 * El bloque de identidad (avatar, nombre, correo, rutina) es el control de expandir/contraer
 * (reemplaza a VER/CERRAR). Expandida muestra el resumen de 3 indicadores (`summary`, calculado en StudentsSection con los
 * mismos datos de la ficha); contraida conserva la barra compacta de dias de la semana.
 */
export default function StudentCard({
  alumno,
  rutinaAsignada,
  progresoSemanal,
  summary,
  rutinasLoaded,
  isActive,
  isMenuOpen,
  darkMode,
  msg,
  textMain,
  textMuted,
  coachAluSurface,
  coachAluBorderSoft,
  coachAluTrack,
  coachAluSubtle,
  coachAluDropdown,
  coachAluDropdownShadow,
  onVer,
  onToggleMenu,
  onEdit,
  onChat,
  onMarkPaid,
  onClearProgress,
  onDelete,
  onAsignarRutina,
  children,
}) {
  var a = alumno || {};
  var progress = progresoSemanal || {};
  var totalDays = progress.totalDays || 0;
  var doneDays = progress.completedDays || 0;
  var pct = progress.pct || 0;
  var badgeCfg = getRutinaBadgeConfig({
    rutina: rutinaAsignada,
    rutinasLoaded: rutinasLoaded,
    darkMode: darkMode,
    msg: msg,
  });
  var P = studentCardPalette({ darkMode: darkMode, coachAluSurface: coachAluSurface, coachAluBorderSoft: coachAluBorderSoft, coachAluSubtle: coachAluSubtle });
  var iconBtn = {width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",background:P.inner,color:textMuted,border:"1px solid "+P.border,borderRadius:12,cursor:"pointer",flexShrink:0};
  var nombre = a.nombre || a.email || "";

  return (
    <div data-qa-alumno-card={isActive ? "open" : "closed"} style={{position:"relative",marginBottom:isActive?14:10}}>
    <div
      style={{
        position: "relative",
        background: P.surface,
        borderRadius: 16,
        padding: "14px 14px 12px",
        border: "1px solid " + (isActive ? P.borderStrong : P.border),
        boxShadow: darkMode ? "none" : "0 1px 3px rgba(15,23,42,0.08)",
      }}
    >
      <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
        <button
          type="button"
          data-qa-alumno-toggle
          className="hov coach-stu-toggle"
          aria-expanded={!!isActive}
          aria-label={(isActive ? msg("Contraer ficha de ", "Collapse profile of ") : msg("Ver ficha de ", "View profile of ")) + nombre}
          onClick={onVer}
          style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:12,background:"transparent",border:"none",padding:0,margin:0,textAlign:"left",cursor:"pointer",fontFamily:"inherit",color:"inherit",minHeight:44}}
        >
          <span aria-hidden="true" style={{width:48,height:48,borderRadius:"50%",background:"#2563eb",color:"#fff",fontSize:21,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {(a.nombre||a.email||"?").trim().charAt(0).toUpperCase()}
          </span>
          <span style={{flex:1,minWidth:0,display:"block"}}>
            <span style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
              <span className="coach-stu-name" style={{fontSize:17,fontWeight:800,color:textMain,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{a.nombre}</span>
              <Ic name="chevron-right" size={16} color={textMuted} style={{flexShrink:0,transform:isActive?"rotate(-90deg)":"rotate(90deg)",transition:"transform .2s"}}/>
            </span>
            <span style={{display:"block",fontSize:13,color:textMuted,lineHeight:1.35,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.email}</span>
            <span style={{display:"inline-block",maxWidth:"100%",marginTop:6,fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:8,background:badgeCfg.bg,color:badgeCfg.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",verticalAlign:"top",boxSizing:"border-box"}}>{badgeCfg.t}</span>
          </span>
        </button>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <button
            type="button"
            className="hov coach-tap"
            aria-label={msg("Mensaje a ", "Message ") + nombre}
            style={iconBtn}
            onClick={onChat}
          >
            <Ic name="message-circle" size={18} color="currentColor"/>
          </button>
          <div style={{position:"relative"}}>
            <button
              type="button"
              className="hov coach-tap"
              aria-label={msg("Más opciones", "More options")}
              aria-expanded={!!isMenuOpen}
              style={iconBtn}
              onClick={onToggleMenu}
            >
              <Ic name="more-vertical" size={18} color="currentColor"/>
            </button>
            {isMenuOpen && (
              <StudentActionsMenu
                alumno={a}
                msg={msg}
                textMain={textMain}
                textMuted={textMuted}
                coachAluDropdown={coachAluDropdown}
                coachAluBorderSoft={coachAluBorderSoft}
                coachAluDropdownShadow={coachAluDropdownShadow}
                onEdit={onEdit}
                onChat={onChat}
                onMarkPaid={onMarkPaid}
                onClearProgress={onClearProgress}
                onDelete={onDelete}
              />
            )}
          </div>
        </div>
      </div>
      {isActive && summary ? (
        <div className="it-ficha-sum" style={{display:"flex",marginTop:12,paddingTop:12,borderTop:"1px solid "+P.border}}>
          {[
            { icon: "calendar", value: summary.semanaTxt, label: msg("Rutina actual", "Current routine") },
            { icon: "bar-chart-2", value: summary.diasTxt, label: msg("Esta semana", "This week") },
            { icon: "clock", value: summary.proxTxt, label: msg("Próxima sesión", "Next session") },
          ].map(function (it, i) {
            return (
              <div key={it.icon} className="it-ficha-sum-item" style={{flex:"1 1 auto",display:"flex",alignItems:"center",gap:7,minWidth:0,padding:i?"2px 0 2px 8px":"2px 8px 2px 0",marginLeft:i?0:0,borderLeft:i?"1px solid "+P.border:"none"}}>
                <Ic name={it.icon} size={19} color={textMuted} style={{flexShrink:0}}/>
                <div style={{minWidth:0}}>
                  <div data-qa-text style={{fontSize:13,fontWeight:800,color:textMain,lineHeight:1.25}}>{it.value}</div>
                  <div data-qa-text style={{fontSize:11.5,color:textMuted,lineHeight:1.3}}>{it.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (!isActive && totalDays ? (
        <div style={{marginTop:10,paddingLeft:64}}>
          <div style={{fontSize:12,fontWeight:700,color:textMuted,marginBottom:4}}>{doneDays}/{totalDays} {msg("días esta semana", "days this week")}</div>
          <div style={{height:6,background:coachAluTrack,borderRadius:4,overflow:"hidden",maxWidth:220}}>
            <div style={{width: pct + "%", height: "100%", background: "#22c55e", borderRadius: 4, transition: "width .2s ease"}}/>
          </div>
        </div>
      ) : null)}
    </div>
      {children}
    </div>
  );
}
