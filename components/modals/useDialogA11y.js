import { useEffect, useRef } from 'react';

// Accesibilidad compartida de dialogos modales (mismo patron que CoachMobileDrawer):
//  - al abrir, el foco entra al dialogo (al contenedor, para no abrir el teclado del movil);
//  - Tab / Shift+Tab no se escapan al fondo;
//  - Escape llama a onEscape SOLO en el dialogo superior (pila) y solo si onEscape es una funcion;
//  - al cerrar, el foco vuelve al elemento que abrio el dialogo.
// Uso: const ref = useRef(null); useDialogA11y({ open, containerRef: ref, onEscape }); y en el nodo: ref, role="dialog", aria-modal, aria-label.
// Para overlays que se montan solo cuando estan abiertos, pasar open=true (el efecto corre al montar y limpia al desmontar).

var FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
var stack = [];

export function getFocusable(root) {
  if (!root) return [];
  return Array.prototype.slice.call(root.querySelectorAll(FOCUSABLE)).filter(function (n) {
    return n.offsetParent !== null || n === document.activeElement;
  });
}

// Logica de Tab pura sobre el DOM: devuelve true si desvio el foco.
export function trapTab(e, root) {
  var items = getFocusable(root);
  if (!items.length) { e.preventDefault(); if (root) root.focus(); return true; }
  var first = items[0], last = items[items.length - 1], a = document.activeElement;
  if (!root.contains(a) || a === root) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return true; }
  if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); return true; }
  if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); return true; }
  return false;
}

export default function useDialogA11y(opts) {
  var open = !!opts.open;
  var containerRef = opts.containerRef;
  var escRef = useRef(opts.onEscape);
  escRef.current = opts.onEscape;

  useEffect(function () {
    if (!open || typeof document === 'undefined') return undefined;
    var token = {};
    var opener = document.activeElement;
    stack.push(token);
    var timer = setTimeout(function () {
      var root = containerRef && containerRef.current;
      if (!root) return;
      if (root.contains(document.activeElement)) return;
      if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
      root.style.outline = 'none';
      try { root.focus(); } catch (err) {}
    }, 0);
    function onKey(e) {
      if (stack[stack.length - 1] !== token) return;
      var root = containerRef && containerRef.current;
      if (e.key === 'Escape') {
        if (typeof escRef.current === 'function') { e.preventDefault(); escRef.current(); }
        return;
      }
      if (e.key === 'Tab' && root) trapTab(e, root);
    }
    document.addEventListener('keydown', onKey);
    return function () {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      var i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
      var root = containerRef && containerRef.current;
      var active = document.activeElement;
      var focusLost = !active || active === document.body || (root && root.contains(active)) || !document.contains(active);
      if (focusLost && opener && typeof opener.focus === 'function' && document.contains(opener)) {
        try { opener.focus(); } catch (err) {}
      }
    };
  }, [open, containerRef]);
}
