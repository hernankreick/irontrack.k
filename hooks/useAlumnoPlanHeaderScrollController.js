import { useLayoutEffect } from "react";

export function useAlumnoPlanHeaderScrollController({
  scrollRef,
  scrollRafIdRef,
  tickingRef,
  planScrollCtxRef,
  lastScrollY,
  alumnoAppHeaderRef,
  lastAppliedHeaderStateRef,
  alumnoTopBarSpacerRef,
  headerCollapsedRef,
  applyAlumnoHeaderLayerStyles,
}) {
  /** Plan alumno: scroll via requestAnimationFrame + listener pasivo (sin setState en el hilo de scroll). */
  useLayoutEffect(function () {
    var cancelled = false;
    var waitRafId = null;
    var attachedEl = null;

    function applyScrollHeaderFrame() {
      scrollRafIdRef.current = null;
      if (!attachedEl) {
        tickingRef.current = false;
        return;
      }
      var ctx = planScrollCtxRef.current;
      var y = attachedEl.scrollTop;
      var dir = y > lastScrollY.current;
      var delta = Math.abs(y - lastScrollY.current);
      var nav = alumnoAppHeaderRef.current;
      if (nav && ctx.alumnoFixedTabs) {
        if (ctx.alumnoPlan) {
          var compact = y > 40;
          var hide = y > 120 && dir && delta > 6;
          var show = !dir && delta > 6;
          if (y < 12 || show) hide = false;
          var headerState = hide ? "hidden" : compact ? "compact" : "full";
          if (lastAppliedHeaderStateRef.current !== headerState) {
            nav.style.transform = hide ? "translateY(-100%)" : "translateY(0)";
            nav.style.opacity = hide ? "0" : "1";
            nav.style.transition = "transform 0.25s ease, opacity 0.2s ease";
            nav.style.willChange = "transform";
            nav.style.minHeight = compact ? "calc(env(safe-area-inset-top, 0px) + 76px)" : ctx.alumnoTopBarPx;
            nav.style.paddingBottom = compact ? "8px" : "";
            nav.style.boxShadow = compact ? "0 8px 24px rgba(0,0,0,.14)" : "0 8px 24px rgba(0,0,0,.18)";
            lastAppliedHeaderStateRef.current = headerState;
          }
        } else {
          nav.style.transform = "";
          nav.style.opacity = "";
          nav.style.transition = "";
          nav.style.willChange = "";
          nav.style.minHeight = ctx.alumnoTopBarPx;
          nav.style.paddingBottom = "";
          lastAppliedHeaderStateRef.current = "fixed";
        }
        var sp = alumnoTopBarSpacerRef.current;
        if (sp) {
          sp.style.height = "0px";
          sp.style.minHeight = "0px";
          sp.style.overflow = "hidden";
          sp.style.transition = "none";
          sp.style.willChange = "";
        }
      } else if (nav && !ctx.alumnoFixedTabs) {
        nav.style.transform = "";
        nav.style.transition = "";
        lastAppliedHeaderStateRef.current = null;
        var sp0 = alumnoTopBarSpacerRef.current;
        if (sp0) {
          sp0.style.height = "";
          sp0.style.minHeight = "";
          sp0.style.overflow = "";
          sp0.style.transition = "";
          sp0.style.willChange = "";
        }
      }
      if (!ctx.headerCollapse || !ctx.alumnoPlan) {
        tickingRef.current = false;
        return;
      }
      lastScrollY.current = y;
      var nextCollapsed = headerCollapsedRef.current;
      /** Umbrales por encima del tramo HOY->Dia 1 (~60-100px) para no colapsar el header justo al cruzar esa union. */
      var COLLAPSE_AFTER_Y = 120;
      var EXPAND_BELOW_Y = 36;
      if (dir && y > COLLAPSE_AFTER_Y && !headerCollapsedRef.current) nextCollapsed = true;
      if (!dir && y < EXPAND_BELOW_Y && headerCollapsedRef.current) nextCollapsed = false;
      if (nextCollapsed !== headerCollapsedRef.current) {
        headerCollapsedRef.current = nextCollapsed;
        applyAlumnoHeaderLayerStyles(nextCollapsed);
      }
      tickingRef.current = false;
    }

    function onScroll() {
      if (tickingRef.current) return;
      tickingRef.current = true;
      scrollRafIdRef.current = requestAnimationFrame(applyScrollHeaderFrame);
    }

    function tryAttachToScrollEl() {
      if (cancelled) return;
      var el = scrollRef.current;
      if (el) {
        attachedEl = el;
        el.addEventListener("scroll", onScroll, { passive: true });
        return;
      }
      waitRafId = requestAnimationFrame(tryAttachToScrollEl);
    }

    waitRafId = requestAnimationFrame(tryAttachToScrollEl);

    return function () {
      cancelled = true;
      if (waitRafId != null) {
        cancelAnimationFrame(waitRafId);
        waitRafId = null;
      }
      if (attachedEl) {
        attachedEl.removeEventListener("scroll", onScroll);
        attachedEl = null;
      }
      if (scrollRafIdRef.current != null) {
        cancelAnimationFrame(scrollRafIdRef.current);
        scrollRafIdRef.current = null;
      }
      tickingRef.current = false;
    };
  }, []);
}
