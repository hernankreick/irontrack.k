function formatKg(kg) {
  return Math.round(kg || 0).toLocaleString("es-AR") + " kg";
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCheckBadge(ctx, cx, cy, radius) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#2563EB";
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.45, cy);
  ctx.lineTo(cx - radius * 0.1, cy + radius * 0.4);
  ctx.lineTo(cx + radius * 0.5, cy - radius * 0.4);
  ctx.stroke();
}

export async function shareSessionSummaryImageUi({ resumenSesion, msg, toast2 }) {
  try {
    // Generar imagen con Canvas
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    // Fondo
    ctx.fillStyle = "#0A0F1A";
    ctx.fillRect(0,0,1080,1080);
    // Línea azul superior
    ctx.fillStyle = "#2563EB";
    ctx.fillRect(0,0,1080,8);
    // Logo
    ctx.fillStyle = "#2563EB";
    ctx.font = "900 72px 'Arial Black', Arial";
    ctx.fillText("IRONTRACK", 80, 120);
    // Nombre rutina
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 52px Arial";
    const rName = (resumenSesion.rutinaName||"").toUpperCase();
    const rNameDisplay = rName.length > 22 ? rName.slice(0,22)+"…" : rName;
    ctx.fillText(rNameDisplay, 80, 220);
    // Línea separadora
    ctx.fillStyle = "#2D4057";
    ctx.fillRect(80, 260, 920, 2);
    // Stats grandes
    const stats = [
      {val: resumenSesion.durMin+"'", label: msg("DURACIÓN", "DURATION")},
      {val: resumenSesion.ejercicios, label: msg("EJERCICIOS", "EXERCISES")},
      {val: resumenSesion.totalSets, label: "SETS"},
      {val: Math.round(resumenSesion.volTotal||0).toLocaleString("es-AR"), label: "KG"},
    ];
    stats.forEach((s,i)=>{
      const x = 80 + i*240;
      ctx.fillStyle = "#2563EB";
      ctx.font = "900 80px 'Arial Black', Arial";
      ctx.fillText(String(s.val), x, 420);
      ctx.fillStyle = "#8B9AB2";
      ctx.font = "700 24px Arial";
      ctx.fillText(s.label, x, 460);
    });
    // PR principal (destacado, sin emoji)
    const prs = resumenSesion.prs || [];
    if (prs.length > 0) {
      const mainPr = prs.reduce((max, p) => (p.diff > max.diff ? p : max), prs[0]);
      const panelH = prs.length > 1 ? 160 : 120;
      drawRoundedRect(ctx, 80, 500, 920, panelH, 20);
      ctx.fillStyle = "#0D1424";
      ctx.fill();
      drawCheckBadge(ctx, 140, 560, 32);
      ctx.fillStyle = "#2563EB";
      ctx.font = "800 30px Arial";
      ctx.fillText(msg("NUEVO PR", "NEW PR"), 195, 550);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "800 34px Arial";
      const prNameRaw = String(mainPr.ejercicio || "");
      const prName = prNameRaw.length > 24 ? prNameRaw.slice(0, 24)+"…" : prNameRaw;
      ctx.fillText(prName + "  ·  " + formatKg(mainPr.kg), 195, 590);
      if (prs.length > 1) {
        ctx.fillStyle = "#8B9AB2";
        ctx.font = "700 26px Arial";
        ctx.fillText("+" + (prs.length - 1) + " " + msg("más", "more"), 195, 630);
      }
    }
    // Semana
    ctx.fillStyle = "#8B9AB2";
    ctx.font = "700 32px Arial";
    const totalSemanas = resumenSesion.totalSemanas || 4;
    ctx.fillText((msg("SEMANA", "WEEK"))+" "+resumenSesion.semana+" / "+totalSemanas, 80, 730);
    // Hashtag
    ctx.fillStyle = "#2D4057";
    ctx.font = "700 28px Arial";
    ctx.fillText("#IronTrack  #Fitness  #Entrenamiento", 80, 980);
    // Línea azul inferior
    ctx.fillStyle = "#2563EB";
    ctx.fillRect(0,1072,1080,8);
    // Convertir a blob y compartir
    canvas.toBlob(async(blob)=>{
      if(!blob) return;
      const file = new File([blob],"irontrack-sesion.png",{type:"image/png"});
      const volTxt = formatKg(resumenSesion.volTotal);
      const txt = "Nueva sesión completada — "+resumenSesion.rutinaName+" | "+resumenSesion.durMin+"min | "+resumenSesion.ejercicios+" ejercicios | "+volTxt+( resumenSesion.prsNuevos>0?" | "+resumenSesion.prsNuevos+" PR nuevo"+(resumenSesion.prsNuevos>1?"s":"")+"!":"")+" #IronTrack";
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({files:[file], title:"IRONTRACK", text:txt});
      } else if(navigator.share){
        await navigator.share({title:"IRONTRACK", text:txt});
      } else {
        // Fallback: descargar imagen
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href=url; a.download="irontrack-sesion.png"; a.click();
        URL.revokeObjectURL(url);
        toast2(msg("Imagen guardada!", "Image saved!"));
      }
    },"image/png");
  } catch(e){ console.error(e); toast2(msg("Error al compartir", "Share error")); }
}
