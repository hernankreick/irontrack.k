import React from 'react';
import { getTheme } from '../../lib/uiHelpers.js';

export default function RecordatoriosPanel({es, darkMode, toast2, msg}) {
  const {bg, bgCard, bgSub, border, textMain, textMuted} = getTheme(darkMode);
const DIAS = es
  ? ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]
  : ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const [notifDias, setNotifDias] = React.useState(()=>{
  try{ return JSON.parse(localStorage.getItem("it_notif_dias")||"[]"); }catch(e){return [];}
});
const [notifHora, setNotifHora] = React.useState(()=>
  localStorage.getItem("it_notif_hora")||"08:00"
);
const [notifActivo, setNotifActivo] = React.useState(()=>
  localStorage.getItem("it_notif_on")==="true"
);
const toggleDia = (i) => {
  const next = notifDias.includes(i)
    ? notifDias.filter(d=>d!==i)
    : [...notifDias,i];
  setNotifDias(next);
  localStorage.setItem("it_notif_dias", JSON.stringify(next));
};
const guardar = async () => {
  localStorage.setItem("it_notif_hora", notifHora);
  localStorage.setItem("it_notif_on", "true");
  setNotifActivo(true);
  var perm = typeof Notification !== "undefined" ? Notification.permission : "denied";
  if ("Notification" in window && perm === "default") {
    perm = await Notification.requestPermission();
  }
  if ("Notification" in window && perm === "granted") {
    toast2(msg("Recordatorios activados ✓", "Reminders set ✓"));
    checkTrainingReminderTick();
  } else if ("Notification" in window) {
    toast2(msg(
      "Preferencias guardadas, pero el navegador bloqueó las notificaciones. Permití notificaciones para este sitio en la configuración del navegador.",
      "Preferences saved, but the browser blocked notifications. Allow notifications for this site in your browser settings."
    ));
  } else {
    toast2(msg("Recordatorios guardados (este navegador no soporta notificaciones de escritorio).", "Reminders saved (this browser does not support desktop notifications)."));
  }
};
const apagar = () => {
  localStorage.setItem("it_notif_on","false");
  setNotifActivo(false);
  toast2(msg("Recordatorios desactivados", "Reminders off"));
};
return(
  <div style={{marginBottom:24}}>
    <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:2,marginBottom:12,textTransform:"uppercase"}}>
      🔔 {msg("Recordatorios de entrenamiento", "Training reminders")}
    </div>
    <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
      {DIAS.map((d,i)=>(
        <button key={"it-notif-dow-"+i} onClick={()=>toggleDia(i)}
          style={{flex:1,minWidth:36,padding:"8px 4px",borderRadius:8,border:"1px solid "+
            (notifDias.includes(i)?"#2563EB":"#2D4057"),
            background:notifDias.includes(i)?"#2563EB":"transparent",
            color:notifDias.includes(i)?"#fff":textMuted,
            fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          {d}
        </button>
      ))}
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
      <div style={{fontSize:13,color:textMuted,fontWeight:500,flex:1}}>
        {msg("Hora del recordatorio", "Reminder time")}
      </div>
      <input type="time" value={notifHora}
        onChange={e=>{setNotifHora(e.target.value);localStorage.setItem("it_notif_hora",e.target.value);}}
        style={{background:bgSub,color:textMain,border:"1px solid "+border,
          borderRadius:8,padding:"8px 12px",fontSize:15,fontFamily:"inherit",outline:"none"}}/>
    </div>
    {notifActivo?(
      <div style={{display:"flex",gap:8}}>
        <div style={{flex:1,padding:"8px 12px",background:"#22C55E12",border:"1px solid #22C55E33",
          borderRadius:12,fontSize:13,color:"#22C55E",fontWeight:600,display:"flex",alignItems:"center",gap:8}}>
          🔔 {es?`Activo · ${notifDias.length} días · ${notifHora}`:`On · ${notifDias.length} days · ${notifHora}`}
        </div>
        <button onClick={apagar}
          style={{padding:"8px 16px",background:"#EF444422",color:"#EF4444",border:"1px solid #EF444433",
            borderRadius:12,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          {msg("Apagar", "Off")}
        </button>
      </div>
    ):(
      <button onClick={guardar} disabled={notifDias.length===0}
        style={{width:"100%",padding:"12px",
          background:notifDias.length>0?"#2563EB":"#2D4057",
          color:notifDias.length>0?"#fff":textMuted,
          border:"none",borderRadius:12,fontSize:15,fontWeight:700,
          cursor:notifDias.length>0?"pointer":"not-allowed",fontFamily:"inherit"}}>
        {notifDias.length===0
          ?(msg("Seleccioná al menos un día", "Select at least one day"))
          :(msg("Activar recordatorios", "Activate reminders"))}
      </button>
    )}
  </div>
);
}

/**
 * Dispara recordatorio si coincide día/hora (app abierta / pestaña activa).
 * Notificación del sistema solo con permiso granted; vibración y tono siempre que el navegador lo permita.
 */
export function checkTrainingReminderTick() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem("it_notif_on") !== "true") return;
    var diasRaw = localStorage.getItem("it_notif_dias") || "[]";
    var dias = JSON.parse(diasRaw);
    if (!Array.isArray(dias) || dias.length === 0) return;
    dias = dias.map(function (d) { return typeof d === "string" ? parseInt(d, 10) : d; }).filter(function (x) { return x === 0 || x > 0; });
    if (dias.length === 0) return;
    var hora = (localStorage.getItem("it_notif_hora") || "08:00").trim();
    var hparts = hora.split(":");
    var targetH = parseInt(hparts[0], 10);
    var targetM = parseInt(hparts[1] != null ? hparts[1] : "0", 10);
    if (isNaN(targetH) || isNaN(targetM)) return;
    var now = new Date();
    var jsD = now.getDay();
    var uiIdx = jsD === 0 ? 6 : jsD - 1;
    if (dias.indexOf(uiIdx) === -1) return;
    var pad = function (n) { return String(n).padStart(2, "0"); };
    if (now.getHours() !== targetH || now.getMinutes() !== targetM) return;
    var hhmm = pad(now.getHours()) + ":" + pad(now.getMinutes());
    var stamp = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + "_" + hhmm;
    if (localStorage.getItem("it_notif_last_fired") === stamp) return;
    localStorage.setItem("it_notif_last_fired", stamp);
    playTrainingReminderFeedback();
    if ("Notification" in window && Notification.permission === "granted") {
      var lang = localStorage.getItem("it_lang") || "es";
      var title = "IronTrack — ¡Hora de entrenar!";
      var body = "Tocá para abrir la app y registrar tu sesión.";
      if (lang === "en") {
        title = "IronTrack — Time to train!";
        body = "Open the app to log your workout.";
      } else if (lang === "pt") {
        title = "IronTrack — Hora de treinar!";
        body = "Abra o app para registrar a sessão.";
      }
      new Notification(title, {
        body: body,
        tag: "irontrack-training-" + stamp,
        silent: false,
        vibrate: [200, 100, 200, 100, 280],
      });
    }
  } catch (e) { /* ignore */ }
}

/** Vibración + tono corto cuando suena el recordatorio (complementa la notificación del sistema). */
function playTrainingReminderFeedback() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([200, 90, 200, 90, 280]);
    }
  } catch (e) { /* ignore */ }
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx = new AC();
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 740;
    o.connect(g);
    g.connect(ctx.destination);
    var t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.start(t);
    o.stop(t + 0.22);
    o.onended = function () {
      try { ctx.close(); } catch (e2) { /* ignore */ }
    };
  } catch (e3) { /* ignore (autoplay / AudioContext) */ }
}
