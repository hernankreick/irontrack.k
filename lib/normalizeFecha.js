export const normalizeFecha = (f) => { if(!f) return ''; const parts=f.split('/'); if(parts.length===3) return parts.map(function(p){return p.padStart(2,'0')}).join('/'); return f; };
