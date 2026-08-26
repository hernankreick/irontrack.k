import { formatKg } from "./formatKg.js";

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
    // Generar imagen con Canvas (formato 9:16, historias)
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const X = 80, CW = W - X * 2;

    // Fondo
    ctx.fillStyle = "#0A0F1A";
    ctx.fillRect(0,0,W,H);
    // Línea azul superior
    ctx.fillStyle = "#2563EB";
    ctx.fillRect(0,0,W,8);

    // Cursor vertical: cada bloque avanza "y" solo si efectivamente se dibuja.
    let y = 120;

    // Logo
    ctx.fillStyle = "#2563EB";
    ctx.font = "900 72px 'Arial Black', Arial";
    ctx.fillText("IRONTRACK", X, y);
    y += 100;

    // Nombre rutina
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 52px Arial";
    const rName = (resumenSesion.rutinaName||"").toUpperCase();
    const rNameDisplay = rName.length > 22 ? rName.slice(0,22)+"…" : rName;
    ctx.fillText(rNameDisplay, X, y);
    y += 40;

    // Línea separadora
    ctx.fillStyle = "#2D4057";
    ctx.fillRect(X, y, CW, 2);
    y += 160;

    // Stats grandes
    const stats = [
      {val: resumenSesion.durMin+"'", label: msg("DURACIÓN", "DURATION")},
      {val: resumenSesion.ejercicios, label: msg("EJERCICIOS", "EXERCISES")},
      {val: resumenSesion.totalSets, label: "SETS"},
      {val: Math.round(resumenSesion.volTotal||0).toLocaleString("es-AR"), label: "KG"},
    ];
    stats.forEach((s,i)=>{
      const sx = X + i*240;
      ctx.fillStyle = "#2563EB";
      ctx.font = "900 80px 'Arial Black', Arial";
      ctx.fillText(String(s.val), sx, y);
      ctx.fillStyle = "#8B9AB2";
      ctx.font = "700 24px Arial";
      ctx.fillText(s.label, sx, y+40);
    });
    y += 80;

    // PR principal (destacado, sin emoji) — si no hay PRs, el cursor no avanza
    // y el resto del contenido sube al lugar donde iría este bloque.
    const prs = resumenSesion.prs || [];
    if (prs.length > 0) {
      const prsWithPct = prs.map(p => ({ ...p, pct: p.prevKg > 0 ? (p.diff / p.prevKg) : 0 }));
      const mainPr = prsWithPct.reduce((max, p) => (p.pct > max.pct ? p : max), prsWithPct[0]);
      const panelH = prs.length > 1 ? 160 : 120;
      drawRoundedRect(ctx, X, y, CW, panelH, 20);
      ctx.fillStyle = "#0D1424";
      ctx.fill();
      drawCheckBadge(ctx, X+60, y+60, 32);
      ctx.fillStyle = "#2563EB";
      ctx.font = "800 30px Arial";
      ctx.fillText(msg("NUEVO PR", "NEW PR"), X+115, y+50);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "800 34px Arial";
      const prNameRaw = String(mainPr.ejercicio || "");
      const prName = prNameRaw.length > 24 ? prNameRaw.slice(0, 24)+"…" : prNameRaw;
      ctx.fillText(prName + "  ·  " + formatKg(mainPr.kg), X+115, y+90);
      if (prs.length > 1) {
        ctx.fillStyle = "#8B9AB2";
        ctx.font = "700 26px Arial";
        ctx.fillText("+" + (prs.length - 1) + " " + msg("más", "more"), X+115, y+130);
      }
      y += panelH + 60;
    }

    // Semana
    ctx.fillStyle = "#8B9AB2";
    ctx.font = "700 32px Arial";
    const totalSemanas = resumenSesion.totalSemanas || 4;
    ctx.fillText((msg("SEMANA", "WEEK"))+" "+resumenSesion.semana+" / "+totalSemanas, X, y);
    y += 100;

    // Hashtag
    ctx.fillStyle = "#2D4057";
    ctx.font = "700 28px Arial";
    ctx.fillText("#IronTrack  #Fitness  #Entrenamiento", X, y);
    y += 60;

    // Línea azul inferior
    ctx.fillStyle = "#2563EB";
    ctx.fillRect(0,y,W,8);

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
