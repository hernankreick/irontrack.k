export function formatKg(value) {
  var n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("es-AR") + " kg" : String(value || "-");
}
