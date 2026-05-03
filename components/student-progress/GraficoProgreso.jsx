import React from 'react';

function GraficoProgreso({progress, EX, readOnly, sharedParam, sb, sessionData, es, darkMode, sesiones, allEx}) {
  const [sbData, setSbData] = React.useState([]);
  const [loadingGrafico, setLoadingGrafico] = React.useState(true);
  const [expandedEx, setExpandedEx] = React.useState(null);

  React.useEffect(()=>{
    const alumnoId = sessionData?.alumnoId || (sharedParam?(()=>{try{return JSON.parse(atob(sharedParam)).alumnoId}catch(e){return null}})():null);
    if(!alumnoId) { setLoadingGrafico(false); return; }
    sb.getProgreso(alumnoId).then(function(prog){
      if(prog) setSbData(prog);
      setLoadingGrafico(false);
    }).catch(function(){setLoadingGrafico(false)});
  },[]);

  const getDatos = (exId) => {
    const local = (progress[exId]?.sets||[]).map(s=>({kg:parseFloat(s.kg)||0,reps:parseInt(s.reps)||0,fecha:s.date})).filter(s=>s.kg>0);
    const remote = sbData.filter(d=>d.ejercicio_id===exId&&d.kg>0).map(d=>({kg:parseFloat(d.kg),reps:parseInt(d.reps)||0,fecha:d.fecha}));
    const todos = [...local,...remote].sort(function(a,b){
      var da=a.fecha?a.fecha.split('/').reverse().join('-'):'';
      var db=b.fecha?b.fecha.split('/').reverse().join('-'):'';
      return da>db?1:-1;
    });
    const seen = new Set();
    return todos.filter(d=>{ const k=d.fecha+d.kg; if(seen.has(k))return false; seen.add(k); return true; }).slice(-20);
  };

  if(loadingGrafico) return (
    <div className="px-4">
      {[0,1,2].map(i=>(
        <div key={i} className="sk mb-2.5 rounded-2xl py-8"
          style={{
            background:"linear-gradient(90deg,#111827 25%,#1a2535 50%,#111827 75%)"
          }}/>
      ))}
    </div>
  );

  // Ejercicios con datos (de la rutina del alumno + cualquiera con registros)
  const exConDatos = (allEx||EX||[]).filter(function(e){
    return (progress[e.id]?.sets||[]).some(function(s){return parseFloat(s.kg)>0}) ||
           sbData.some(function(d){return d.ejercicio_id===e.id&&parseFloat(d.kg)>0});
  });

  return (
    <div className="bg-transparent pb-6">

      {/* TÍTULO */}
      <div className="flex items-center gap-2 px-5 pb-4 pt-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"
          strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
        <h2 className="m-0 font-['Bebas_Neue',sans-serif] text-2xl tracking-wide text-white">Tu Progreso</h2>
      </div>

      {/* STAT GRID */}
      <div className="grid grid-cols-2 gap-5 mb-8">

        {/* Sesiones */}
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-[#1e3050] bg-[#131b2e] p-6">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#3B82F6" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="font-['DM_Mono',monospace] text-[34px] font-semibold leading-none text-white">
            {sesiones?.length || 0}
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sesiones</div>
            <div className="mt-0.5 text-[11px] text-slate-500">completadas</div>
          </div>
        </div>

        {/* PRs */}
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-[#1e3050] bg-[#131b2e] p-6">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#22C55E" strokeWidth="2" strokeLinecap="round">
              <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/>
              <path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
              <path d="M4 22h16"/>
              <path d="M18 2H6v7a6 6 0 0012 0V2z"/>
            </svg>
          </div>
          <div className="font-['DM_Mono',monospace] text-[34px] font-semibold leading-none text-green-500">
            {(() => {
              const mesActual = new Date().getMonth();
              return sbData.filter(d => {
                const f = d.fecha ? new Date(d.fecha) : null;
                return f && f.getMonth() === mesActual;
              }).length;
            })()}
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">PRs del mes</div>
            <div className="mt-0.5 text-[11px] text-green-500">nuevos récords</div>
          </div>
        </div>

        {/* Racha */}
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-[#1e3050] bg-[#131b2e] p-6">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#3B82F6" strokeWidth="2" strokeLinecap="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div className="font-['DM_Mono',monospace] text-[34px] font-semibold leading-none text-white">
            {(() => {
              if(!sesiones?.length) return 0;
              const dias = [...new Set(
                sesiones.map(s => (s.created_at||"").slice(0,10))
              )].sort().reverse();
              let racha = 0;
              let hoy = new Date();
              for(let i=0; i<dias.length; i++){
                const d = new Date(dias[i]);
                const diff = Math.round((hoy - d)/(1000*60*60*24));
                if(diff === i) racha++;
                else break;
              }
              return racha;
            })()}
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Racha</div>
            <div className="mt-0.5 text-[11px] text-slate-500">días consecutivos</div>
          </div>
        </div>

        {/* Mejora */}
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-[#1e3050] bg-[#131b2e] p-6">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
          </div>
          <div className="font-['DM_Mono',monospace] text-[34px] font-semibold leading-none text-green-500">
            {(() => {
              if(!exConDatos.length) return "—";
              const mejoras = exConDatos.map(e => {
                const datos = getDatos(e.id);
                if(datos.length < 2) return null;
                const primero = datos[0].kg;
                const ultimo  = datos[datos.length-1].kg;
                if(!primero) return null;
                return ((ultimo - primero) / primero) * 100;
              }).filter(v => v !== null);
              if(!mejoras.length) return "—";
              const avg = mejoras.reduce((a,b)=>a+b,0)/mejoras.length;
              return (avg>=0?"+":"")+avg.toFixed(0)+"%";
            })()}
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Mejora total</div>
            <div className="mt-0.5 text-[11px] text-green-500">promedio</div>
          </div>
        </div>

      </div>{/* /stat-grid */}

      {/* LABEL SECCIÓN */}
      <div className="mb-3.5 flex items-center gap-2 px-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-green-500">PROGRESO POR EJERCICIO</span>
        <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-500">{exConDatos.length}</span>
      </div>

      {/* ESTADO VACÍO */}
      {exConDatos.length === 0 && (
        <div className="px-5 py-10 text-center text-sm text-slate-500">
          <svg className="mx-auto mb-3 block h-9 w-9" width="36" height="36" viewBox="0 0 24 24" fill="none"
            stroke="#1a2535" strokeWidth="1.5" strokeLinecap="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Todavía no hay registros de progreso
        </div>
      )}

      {/* LISTA EJERCICIOS */}
      <div className="flex flex-col px-4">
        {exConDatos.map(function(ex){
          const datos    = getDatos(ex.id);
          const ultimo   = datos[datos.length-1];
          const primero  = datos[0];
          const subio    = !primero || !ultimo || ultimo.kg >= primero.kg;
          const pct      = primero?.kg && ultimo?.kg
            ? (((ultimo.kg - primero.kg) / primero.kg)*100).toFixed(0)
            : null;
          const esPR     = datos.length >= 2 && ultimo?.kg > primero?.kg;
          const expanded = expandedEx === ex.id;

          return (
            <div key={ex.id}
              className={
                "cursor-pointer overflow-hidden rounded-2xl border bg-[#111827] py-6 px-2 border-b border-white/5 "+
                (expanded?"border-emerald-400/35":"border-[#1a2535]")
              }
              onClick={()=> setExpandedEx(expanded ? null : ex.id)}
            >
              {/* ROW PRINCIPAL */}
              <div className="flex items-center gap-5">

                {/* Flecha */}
                <div className={
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full "+
                  (subio?"bg-green-500/15":"bg-red-500/15")
                }>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={subio?"#22C55E":"#EF4444"}
                    strokeWidth="2.5" strokeLinecap="round">
                    {subio
                      ? <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>
                      : <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>
                    }
                  </svg>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white">{ex.nombre||ex.name||"Ejercicio"}</div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    {ultimo
                      ? `Último: ${ultimo.kg}kg × ${ultimo.reps}`
                      : "Sin registros"
                    }
                    {pct !== null && (
                      <span className={subio ? "font-semibold text-green-500" : "font-semibold text-red-500"}>
                        {subio?"+":""}{pct}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Kg + PR */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {ultimo && (
                    <div className={"font-['DM_Mono',monospace] text-lg font-semibold "+(subio?"text-green-500":"text-red-500")}>{ultimo.kg}kg</div>
                  )}
                  {esPR && (
                    <div className="rounded border border-amber-500/35 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-amber-500">PR</div>
                  )}
                </div>

                {/* Chevron */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round"
                  className={"h-4 w-4 shrink-0 transition-transform duration-200 "+(expanded?"rotate-180":"")}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>

              </div>{/* /ex-row */}

              {/* DETALLE EXPANDIDO */}
              {expanded && (
                <div className="px-3 pb-4 pt-1">
                  {datos.slice(-5).reverse().map(function(d, i){
                    return (
                      <div key={i} className="flex items-center justify-between border-b border-[#1e3050]/50 px-3 py-4 text-xs">
                        <span className="text-slate-500">{d.fecha||"—"}</span>
                        <span className="font-medium text-slate-400">
                          {d.reps ? `× ${d.reps}` : ""}
                        </span>
                        <span className="font-['DM_Mono',monospace] font-semibold text-white">{d.kg}kg</span>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          );
        })}
      </div>{/* /ex-list */}

    </div>
  );
}

export default GraficoProgreso;
