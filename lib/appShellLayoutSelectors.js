import React from 'react';
import { Calendar as CalNavIcon, CalendarDays, Dumbbell, TrendingUp as TrendNavIcon } from 'lucide-react';
import { Ic } from '../components/Ic.jsx';

export function selectAppShellLayoutState({
  esAlumno,
  readOnly,
  sharedParam,
  alumnoId,
  sessionRole,
  tab,
  coachDesktop1024,
  session,
  routineDaysLength,
  darkMode,
  msg,
  planScrollDiag,
}) {
  const showAlumnoProgressStack = (readOnly || esAlumno) && (sharedParam || alumnoId);
  const showCoachDesktopShell = !esAlumno && sessionRole === "entrenador";
  const coachDesktopBleedTab =
    tab === "plan" || tab === "calendar" || tab === "mensajes" || tab === "progress" || tab === "settings" || tab === "perfil";
  const coachSuppressTopNav =
    showCoachDesktopShell &&
    !esAlumno &&
    (coachDesktopBleedTab ||
      (coachDesktop1024 && (tab === "alumnos" || tab === "calendar" || tab === "mensajes" || tab === "routines" || tab === "biblioteca")));
  const routineDaysCount = Math.max(1, routineDaysLength || 3);
  const tabs2 = esAlumno
    ? [
        { k: "plan", icon: (c) => React.createElement(CalNavIcon, { size: 20, color: c, strokeWidth: 2 }), lbl: msg("PLAN", "PLAN") },
        { k: "library", icon: (c) => React.createElement(Dumbbell, { size: 20, color: c, strokeWidth: 2 }), lbl: msg("EJERCICIOS", "EXERCISES") },
        { k: "progress", icon: (c) => React.createElement(TrendNavIcon, { size: 20, color: c, strokeWidth: 2 }), lbl: msg("PROGRESO", "PROGRESS") },
      ]
    : [
        { k: "plan", icon: (c) => React.createElement(Ic, { name: "bar-chart-2", size: 20, color: c }), lbl: msg("DASHBOARD", "DASHBOARD") },
        { k: "calendar", icon: (c) => React.createElement(CalendarDays, { size: 20, color: c, strokeWidth: 2 }), lbl: msg("CALENDARIO", "CALENDAR") },
        { k: "mensajes", icon: (c) => React.createElement(Ic, { name: "message-circle", size: 20, color: c }), lbl: msg("MENSAJES", "MESSAGES") },
        { k: "routines", icon: (c) => React.createElement(Ic, { name: "file-text", size: 20, color: c }), lbl: msg("RUTINAS", "ROUTINES") },
        { k: "biblioteca", icon: (c) => React.createElement(Ic, { name: "activity", size: 20, color: c }), lbl: msg("EJERCICIOS", "EXERCISES") },
        { k: "alumnos", icon: (c) => React.createElement(Ic, { name: "users", size: 20, color: c }), lbl: msg("ALUMNOS", "ATHLETES") },
        { k: "progress", icon: (c) => React.createElement(TrendNavIcon, { size: 20, color: c, strokeWidth: 2 }), lbl: msg("PROGRESO", "PROGRESS") },
      ];
  const hideGlobalBottomNavCoachDash =
    !esAlumno && sessionRole === "entrenador" && coachDesktopBleedTab && coachDesktop1024;
  const hideAlumnoTopBarForSession = !!(esAlumno && session);
  const alumnoTopBarFixed = !!(esAlumno && !hideAlumnoTopBarForSession && (tab === "plan" || tab === "library" || tab === "progress"));
  const alumnoTopBarHeight = alumnoTopBarFixed ? "calc(env(safe-area-inset-top, 0px) + 96px)" : "0px";
  const planScrollCtx = {
    alumnoPlan: !!(esAlumno && tab === "plan"),
    headerCollapse: !!(planScrollDiag.headerCollapseOnScroll && !esAlumno),
    alumnoFixedTabs: !!(esAlumno && (tab === "plan" || tab === "library" || tab === "progress")),
    alumnoTopBarPx: alumnoTopBarHeight,
  };
  const alumnoFullScreenShell = !!(esAlumno && (tab === "plan" || tab === "library" || tab === "progress"));
  const alumnoFullScreenBg = darkMode ? "#0B1220" : "#F1F5F9";
  const coachDesktopNavHidden = !!(showCoachDesktopShell && coachDesktop1024);

  return {
    showAlumnoProgressStack,
    showCoachDesktopShell,
    coachSuppressTopNav,
    routineDaysCount,
    tabs2,
    hideGlobalBottomNavCoachDash,
    hideAlumnoTopBarForSession,
    alumnoTopBarFixed,
    alumnoTopBarHeight,
    planScrollCtx,
    alumnoFullScreenShell,
    alumnoFullScreenBg,
    coachDesktopNavHidden,
  };
}
