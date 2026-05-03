import React from 'react';
import { getYTVideoId } from '../../lib/getYTVideoId.js';
import { resolveExerciseTitle, resolveVideoUrl } from '../../lib/exerciseResolve.js';
import { ExerciseVideoPlayButton } from '../ExerciseVideoPlayButton.jsx';

const LibraryAlumno = React.memo(function LibraryAlumno({allEx, es, darkMode, routines, videoOverrides, setVideoModal, msg}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  // Obtener ejercicios únicos de todas las rutinas del alumno
  const rutina = (routines||[])[0];
  const dias = rutina?.days || [];
  const ejerciciosUnicos = {};
  dias.forEach(function(d, di) {
    (d.warmup||[]).forEach(function(ex) {
      if(!ejerciciosUnicos[ex.id]) ejerciciosUnicos[ex.id] = {ex:ex, dia:d.label||("Día "+(di+1)), bloque:"warmup"};
    });
    (d.exercises||[]).forEach(function(ex) {
      if(!ejerciciosUnicos[ex.id]) ejerciciosUnicos[ex.id] = {ex:ex, dia:d.label||("Día "+(di+1)), bloque:"principal"};
    });
  });

  const lista = Object.entries(ejerciciosUnicos).map(function(entry) {
    var exId = entry[0], data = entry[1];
    var info = (allEx||[]).find(function(e) { return e.id === exId; });
    return { id: exId, info: info, ex: data.ex, dia: data.dia, bloque: data.bloque };
  });

  if(lista.length === 0) return (
    <div style={{textAlign:"center",padding:"60px 0",color:textMuted}}>
      <div style={{fontSize:48,marginBottom:12}}>💪</div>
      <div style={{fontSize:18,fontWeight:700}}>{msg("Sin ejercicios en tu rutina", "No exercises in your routine")}</div>
      <div style={{fontSize:13,marginTop:4,color:textMuted}}>{msg("Tu entrenador te asignará una rutina", "Your coach will assign you a routine")}</div>
    </div>
  );

  return (
    <div style={{paddingTop:8,paddingLeft:2,paddingRight:2}}>
      <div style={{fontSize:11,fontWeight:800,color:textMain,letterSpacing:2,marginBottom:16,textTransform:"uppercase"}}>
        {msg("MIS EJERCICIOS", "MY EXERCISES")} ({lista.length})
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {lista.map(function(item) {
        var info = item.info;
        var ex = item.ex;
        var nombre = resolveExerciseTitle(info || null, ex, es);
        var musculo = info?.muscle || "";
        var patron = info?.pattern || "";
        var videoUrl = resolveVideoUrl(info || null, ex, videoOverrides);
        var tieneVideo = !!videoUrl;
        var PAT_COLORS = {rodilla:"#22C55E",bisagra:"#8B9AB2",empuje:"#2563EB",traccion:"#60A5FA",core:"#F59E0B",movilidad:"#A78BFA",cardio:"#EF4444",oly:"#8B9AB2"};
        var barColor = PAT_COLORS[patron] || "#2563EB";

        return (
          <div key={item.id} style={{background:bgCard,border:"1px solid "+border,borderRadius:12,padding:"22px 24px"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:4,alignSelf:"stretch",borderRadius:2,background:barColor,flexShrink:0,minHeight:36}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:16,fontWeight:800,color:textMain,marginBottom:2}}>{nombre}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {musculo&&<span style={{fontSize:11,color:textMuted}}>{musculo}</span>}
                  <span style={{fontSize:10,color:textMuted,background:bgSub,borderRadius:4,padding:"1px 5px"}}>{item.dia}</span>
                  {ex.sets&&ex.reps&&<span style={{fontSize:11,fontWeight:700,color:"#A3B4CC"}}>{ex.sets}×{ex.reps}</span>}
                  {ex.kg&&<span style={{fontSize:11,color:textMuted}}>{ex.kg}kg</span>}
                </div>
              </div>
              <ExerciseVideoPlayButton
                hasVideo={tieneVideo}
                onClick={function(){var vid=getYTVideoId(videoUrl);if(vid&&setVideoModal){setVideoModal({videoId:vid,nombre:nombre})}else{window.open(videoUrl,"_blank")}}}
                ariaLabel={msg("Ver video del ejercicio","View exercise video")}
                ariaLabelDisabled={msg("Video no disponible","No video available")}
              />
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
});

export default LibraryAlumno;
