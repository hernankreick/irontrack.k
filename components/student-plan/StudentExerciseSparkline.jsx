import React from 'react';

export default function StudentExerciseSparkline({ progress, _dm, textMuted, msg }) {
  const setsAlu = Object.values(progress||{})
    .flatMap(pg => (pg.sets||[]))
    .filter(s => s.kg > 0)
    .sort((x,y) => new Date(x.date||0) - new Date(y.date||0));
  if(setsAlu.length < 3) return null;
  // Agrupar por semana relativa (ultimas 8 semanas)
  const now = Date.now();
  const buckets = {};
  setsAlu.forEach(s => {
    const d = new Date(s.date||now);
    const weekAgo = Math.floor((now - d.getTime()) / (7*24*60*60*1000));
    const bucket = Math.min(weekAgo, 7);
    if(!buckets[bucket]) buckets[bucket] = [];
    buckets[bucket].push(s.kg);
  });
  const weeks = Array.from({length:8},(_,i)=>7-i);
  const data = weeks.map(w => {
    const vals = buckets[w];
    return vals ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  }).filter(v => v !== null);
  if(data.length < 2) return null;
  const first = data[0], last = data[data.length-1];
  const pct = first>0 ? Math.round((last-first)/first*100) : 0;
  const color = pct > 0 ? "#22C55E" : pct < -2 ? "#F59E0B" : "#2563EB";
  const fill  = pct > 0 ? "rgba(34,197,94,.1)" : pct < -2 ? "rgba(245,158,11,.08)" : "rgba(37,99,235,.08)";
  const min = Math.min(...data), max = Math.max(...data), range = max-min||1;
  const W=120, H=24, pad=2;
  const pts = data.map((v,i)=>({
    x: pad + (i/(data.length-1))*(W-pad*2),
    y: H - pad - ((v-min)/range)*(H-pad*2)
  }));
  const pathD = pts.map((p,i)=>(i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`)).join(' ');
  const areaD = `M${pts[0].x},${H} ${pathD} L${pts[pts.length-1].x},${H} Z`;
  return (
    <div style={{
      display:"flex",alignItems:"center",gap:8,
      marginLeft:46,marginTop:6,
      padding:"5px 8px",borderRadius:8,
      background:_dm?"#162234":"#EEF2F7"
    }}>
      <span style={{fontSize:9,color:textMuted,fontWeight:600,whiteSpace:"nowrap"}}>
        {msg("30d carga", "30d load")}
      </span>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{flex:1}}>
        <path d={areaD} fill={fill}/>
        <path d={pathD} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
        <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="2.5" fill={color}/>
      </svg>
      <span style={{
        fontSize:10,fontWeight:700,color,
        whiteSpace:"nowrap",minWidth:30,textAlign:"right"
      }}>
        {pct>0?"+":""}{pct}%
      </span>
    </div>
  );
}
