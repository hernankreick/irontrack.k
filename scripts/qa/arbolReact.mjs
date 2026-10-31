// Utilidad de pruebas SSR: recorre el arbol de elementos React que devuelve un componente SIN DOM, expandiendo los componentes de funcion
// sin hooks (Card, Stat, FilaGrupo...) para poder ejecutar los onClick de los controles reales. Los componentes con hooks (p. ej. GlobalSearch)
// se dejan sin expandir. Llamar FUERA del render (sin dispatcher los hooks lanzan y el componente queda sin expandir).
export function expandir(node) {
  if (node == null || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return node;
  if (Array.isArray(node)) return node.map(expandir);
  if (!node.type) return node;
  const props = node.props || {};
  if (typeof node.type === "function") {
    try { return expandir(node.type(props)); } catch (e) { return { type: node.type, props, children: null, sinExpandir: true }; }
  }
  return { type: node.type, props, children: expandir(props.children) };
}
export function texto(n) {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(texto).join(" ");
  return texto(n.children);
}
/** Todos los nodos con data-qa: [{ qa, props, texto }] en orden de documento. */
export function porQa(tree) {
  const out = [];
  (function rec(n) {
    if (n == null || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(rec); return; }
    const qa = n.props && n.props["data-qa"];
    if (qa) out.push({ qa, props: n.props, texto: texto(n.children).replace(/\s+/g, " ").trim() });
    rec(n.children);
  })(tree);
  return out;
}
