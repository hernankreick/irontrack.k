export const fmt = s => String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
export const fmtP = s => { const n=parseInt(s)||0; if(!n) return "No"; if(n<60) return n+"s"; const m=Math.floor(n/60),r=n%60; return r===0?(m+"min"):(m+"m"+r+"s"); };

export function formatChatTime(value, locale) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const loc = locale || "es-AR";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    return d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isYesterday) return "Ayer";

  return d.toLocaleDateString(loc, { day: "2-digit", month: "2-digit" });
}
