import React from 'react';

export default function AppMainScroll({
  showCoachDesktopShell,
  esAlumno,
  tab,
  showAlumnoProgressStack,
  coachSuppressTopNav,
  coachDesktop1024,
  planScrollDiag,
  alumnoTopBarFixed,
  alumnoFullScreenShell,
  session,
  activeDay,
  darkMode,
  onScrollNode,
  children,
}) {
  return (
    <div
      className={
        "plan-main-scroll relative z-0 overflow-y-auto " +
        (showCoachDesktopShell && !esAlumno ? "overflow-x-hidden " : "") +
        (showCoachDesktopShell && !esAlumno
          ? "px-0 "
          : esAlumno && (tab === "plan" || tab === "library" || (tab === "progress" && showAlumnoProgressStack))
            ? "px-7 "
            : "px-6 ") +
        (showCoachDesktopShell && !esAlumno ? "lg:[scrollbar-gutter:stable] " : "") +
        (!coachSuppressTopNav ? "mt-6 " : "") +
        (planScrollDiag.planAnimationsGlobalCss === false ? "plan-scroll-diag-no-hov " : "") +
        (coachSuppressTopNav
          ? "pt-0 "
          : esAlumno && (tab === "plan" || tab === "library" || (tab === "progress" && showAlumnoProgressStack))
            ? "pt-8 "
            : tab === "progress"
              ? "pt-[max(0.75rem,env(safe-area-inset-top,0px))] "
              : showCoachDesktopShell && !esAlumno
                ? "pt-6 "
                : "pt-6 ")
      }
      ref={onScrollNode}
      style={{
        height:
          showCoachDesktopShell && !esAlumno
            ? undefined
            : alumnoTopBarFixed
              ? "100svh"
              : "calc(100svh - 130px)",
        flex: alumnoFullScreenShell ? 1 : showCoachDesktopShell && !esAlumno ? 1 : undefined,
        minHeight: alumnoFullScreenShell ? 0 : showCoachDesktopShell && !esAlumno ? 0 : undefined,
        maxHeight: showCoachDesktopShell && !esAlumno ? "100%" : undefined,
        display:
          session && activeDay
            ? "none"
            : showCoachDesktopShell && !esAlumno
              ? "flex"
              : "block",
        flexDirection: showCoachDesktopShell && !esAlumno && !(session && activeDay) ? "column" : undefined,
        paddingBottom: esAlumno
          ? "calc(150px + env(safe-area-inset-bottom, 0px))"
          : showCoachDesktopShell
            ? coachDesktop1024
              ? "calc(1rem + env(safe-area-inset-bottom, 0px))"
              : "calc(5.5rem + env(safe-area-inset-bottom, 0px))"
            : "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
        paddingLeft:
          esAlumno && (tab === "plan" || tab === "library" || (tab === "progress" && showAlumnoProgressStack))
            ? 20
            : undefined,
        paddingRight:
          esAlumno && (tab === "plan" || tab === "library" || (tab === "progress" && showAlumnoProgressStack))
            ? 20
            : undefined,
        paddingTop:
          esAlumno && (tab === "plan" || tab === "library" || (tab === "progress" && showAlumnoProgressStack))
            ? alumnoTopBarFixed
              ? "calc(env(safe-area-inset-top, 0px) + 128px)"
              : 32
            : undefined,
        WebkitOverflowScrolling: "touch",
        scrollBehavior: "auto",
        overflowAnchor: "none",
        overscrollBehavior: "contain",
        background: darkMode
          ? esAlumno &&
              (tab === "plan" || tab === "library" || (tab === "progress" && showAlumnoProgressStack))
            ? "#0B1220"
            : "#0B1120"
          : showCoachDesktopShell && !esAlumno
            ? "#ffffff"
            : "#F1F5F9",
      }}
    >
      <div
        className={
          showCoachDesktopShell && !esAlumno
            ? "mx-auto box-border flex min-h-0 w-full min-w-0 max-w-[min(100%,1400px)] flex-1 flex-col px-4 pb-3 pt-0 sm:px-5 lg:px-6 lg:pb-12 lg:pt-6"
            : "min-w-0 w-full"
        }
      >
        {children}
      </div>
    </div>
  );
}
