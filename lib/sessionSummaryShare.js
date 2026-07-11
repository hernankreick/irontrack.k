export async function shareSessionSummaryImageUi({ resumenSesion, msg, toast2 }) {
  try {
    // Generar imagen con Canvas (formato historia 9:16)
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    function roundedRectPath(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    // Fondo degradado oscuro
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,"#0F1923");
    grad.addColorStop(1,"#1E2D40");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,H);
    // Barra de acento superior (azul)
    ctx.fillStyle = "#2563EB";
    ctx.fillRect(0,0,W,8);

    // Badge "SEMANA X/4" — pill arriba a la derecha
    roundedRectPath(760, 30, 240, 56, 28);
    ctx.fillStyle = "rgba(37,99,235,0.18)";
    ctx.fill();
    ctx.strokeStyle = "#2563EB";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#2563EB";
    ctx.font = "800 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText((msg("SEMANA", "WEEK"))+" "+resumenSesion.semana+"/4", 880, 68);
    ctx.textAlign = "left";

    // Logo
    ctx.fillStyle = "#2563EB";
    ctx.font = "900 72px 'Arial Black', Arial";
    ctx.fillText("IRON TRACK", 80, 170);
    // Fecha
    ctx.fillStyle = "#8B9AB2";
    ctx.font = "700 30px Arial";
    ctx.fillText(resumenSesion.fecha || "", 80, 215);
    // Nombre rutina
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 52px Arial";
    const rName = (resumenSesion.rutinaName||"").toUpperCase();
    ctx.fillText(rName.slice(0,22), 80, 300);
    // Línea separadora
    ctx.fillStyle = "#2D4057";
    ctx.fillRect(80, 345, 920, 2);

    // PRs — hero centrado en el tercio superior + lista de PRs individuales
    const prList = Array.isArray(resumenSesion.prs) ? resumenSesion.prs : [];
    const hasPr = resumenSesion.prsNuevos > 0 && prList.length > 0;
    if (hasPr) {
      ctx.fillStyle = "#60A5FA";
      ctx.font = "900 118px 'Arial Black', Arial";
      ctx.textAlign = "center";
      ctx.fillText(""+resumenSesion.prsNuevos+" PR "+(msg("NUEVO", "NEW"))+(resumenSesion.prsNuevos>1?"S":"")+"!", W/2, 560);
      ctx.textAlign = "left";

      const rowsToShow = prList.slice(0,3);
      rowsToShow.forEach(function(pr,i){
        const y = 700 + i*70;
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "700 38px Arial";
        ctx.fillText(String(pr.ejercicio||"").slice(0,20), 80, y);
        ctx.fillStyle = "#2563EB";
        ctx.font = "800 38px Arial";
        ctx.textAlign = "right";
        ctx.fillText(pr.kg+"kg", 1000, y);
        ctx.textAlign = "left";
      });
      if (prList.length > 3) {
        ctx.fillStyle = "#8B9AB2";
        ctx.font = "700 30px Arial";
        ctx.fillText("+"+(prList.length-3)+" "+(msg("más","more")), 80, 700 + 3*70);
      }
    }

    // Stats grandes
    const statsY = hasPr ? 1520 : 850;
    const stats = [
      {val: resumenSesion.durMin+"'", label: msg("DURACIÓN", "DURATION")},
      {val: resumenSesion.ejercicios, label: msg("EJERCICIOS", "EXERCISES")},
      {val: resumenSesion.totalSets, label: "SETS"},
      {val: (resumenSesion.volTotal/1000).toFixed(1)+"t", label: msg("TONELAJE", "VOLUME")},
    ];
    stats.forEach((s,i)=>{
      const x = 80 + i*240;
      ctx.fillStyle = "#2563EB";
      ctx.font = "900 80px 'Arial Black', Arial";
      ctx.fillText(String(s.val), x, statsY);
      ctx.fillStyle = "#8B9AB2";
      ctx.font = "700 24px Arial";
      ctx.fillText(s.label, x, statsY+40);
    });
    // Hashtag
    ctx.fillStyle = "#64748B";
    ctx.font = "700 28px Arial";
    ctx.fillText("#IronTrack  #Fitness  #Entrenamiento", 80, 1830);
    // Barra de acento inferior (azul)
    ctx.fillStyle = "#2563EB";
    ctx.fillRect(0,H-8,W,8);
    // Convertir a blob y compartir
    canvas.toBlob(async(blob)=>{
      if(!blob) return;
      const file = new File([blob],"irontrack-sesion.png",{type:"image/png"});
        const txt = "💪 "+resumenSesion.rutinaName+" | "+resumenSesion.durMin+"min | "+resumenSesion.ejercicios+" ejercicios | "+resumenSesion.volTotal.toLocaleString()+"kg"+( resumenSesion.prsNuevos>0?" | 🏆 "+resumenSesion.prsNuevos+" PR!":"")+" #IronTrack";
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({files:[file], title:"IRON TRACK", text:txt});
      } else if(navigator.share){
        await navigator.share({title:"IRON TRACK", text:txt});
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
