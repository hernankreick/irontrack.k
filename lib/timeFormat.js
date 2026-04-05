export const fmt = s => String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
export const fmtP = s => { const n=parseInt(s)||0; if(!n) return "No"; if(n<60) return n+"s"; const m=Math.floor(n/60),r=n%60; return r===0?(m+"min"):(m+"m"+r+"s"); };
