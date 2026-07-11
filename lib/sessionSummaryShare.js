import { toBlob } from "html-to-image";

// El nodo capturado suele tener background:"transparent" (para dejar ver el
// overlay detrás); subimos por los ancestros hasta encontrar un fondo real.
function resolveBackgroundColor(el) {
  var current = el;
  while (current) {
    var bg = getComputedStyle(current).backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
    current = current.parentElement;
  }
  return "#0d1424";
}

export async function shareSessionSummaryImageUi({ node, resumenSesion, msg, toast2 }) {
  if (!node) return;
  // Ocultar los thumbnails de YouTube solo durante la captura (riesgo de
  // CORS/tainted-canvas si se dejan visibles), restaurados apenas termina.
  const imgs = node.querySelectorAll("img");
  const prevVisibility = [];
  imgs.forEach(function (img) {
    prevVisibility.push(img.style.visibility);
    img.style.visibility = "hidden";
  });
  try {
    const modalBg = resolveBackgroundColor(node.parentElement);
    const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: modalBg });
    if (!blob) return;
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
  } catch(e){ console.error(e); toast2(msg("Error al compartir", "Share error")); }
  finally {
    imgs.forEach(function (img, i) { img.style.visibility = prevVisibility[i]; });
  }
}
