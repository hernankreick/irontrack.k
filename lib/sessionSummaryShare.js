export async function shareSessionSummaryImageUi({ resumenSesion, msg, toast2 }) {
  try {
    // Generar imagen con Canvas
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    // Fondo degradado oscuro
    const grad = ctx.createLinearGradient(0,0,0,1080);
    grad.addColorStop(0,"#0F1923");
    grad.addColorStop(1,"#1E2D40");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,1080,1080);
    // Línea roja superior
    ctx.fillStyle = "#2563EB";
    ctx.fillRect(0,0,1080,8);
    // Logo
    ctx.fillStyle = "#2563EB";
    ctx.font = "900 72px 'Arial Black', Arial";
    ctx.fillText("IRON TRACK", 80, 120);
    // Nombre rutina
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 52px Arial";
    const rName = (resumenSesion.rutinaName||"").toUpperCase();
    ctx.fillText(rName.slice(0,22), 80, 220);
    // Línea separadora
    ctx.fillStyle = "#2D4057";
    ctx.fillRect(80, 260, 920, 2);
    // Stats grandes
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
      ctx.fillText(String(s.val), x, 420);
      ctx.fillStyle = "#8B9AB2";
      ctx.font = "700 24px Arial";
      ctx.fillText(s.label, x, 460);
    });
    // PRs
    if(resumenSesion.prsNuevos > 0){
      ctx.fillStyle = "#60A5FA";
      ctx.font = "900 48px 'Arial Black', Arial";
      ctx.fillText(""+resumenSesion.prsNuevos+" PR "+(msg("NUEVO", "NEW"))+(resumenSesion.prsNuevos>1?"S":"")+"!", 80, 560);
    }
    // Semana
    ctx.fillStyle = "#8B9AB2";
    ctx.font = "700 32px Arial";
    ctx.fillText((msg("SEMANA", "WEEK"))+" "+resumenSesion.semana+" / 4", 80, 650);
    // Hashtag
    ctx.fillStyle = "#2D4057";
    ctx.font = "700 28px Arial";
    ctx.fillText("#IronTrack  #Fitness  #Entrenamiento", 80, 980);
    // Línea roja inferior
    ctx.fillStyle = "#2563EB";
    ctx.fillRect(0,1072,1080,8);
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
