import React from 'react';
import { createPortal } from 'react-dom';
import { getYoutubeEmbedSrc } from '../../lib/getYTVideoId.js';

// Accesibilidad: foco al boton de cierre al abrir, Escape cierra (en captura, para que una pantalla inferior no lo reciba)
// y el foco vuelve al elemento que abrio el video.
function useVideoModalA11y(open, close) {
  const closeRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (opener && opener !== document.body && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
    };
  }, [open, close]);
  return closeRef;
}

function VideoModal({ videoModal, setVideoModal }) {
  const close = React.useCallback(() => setVideoModal(null), [setVideoModal]);
  const closeRef = useVideoModalA11y(!!videoModal, close);
  return (
    videoModal &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={videoModal.nombre || "Video"}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.95)",
          zIndex: 10000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
        onClick={() => setVideoModal(null)}
      >
        <div style={{ width: "100%", maxWidth: 480, padding: "0 16px" }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{videoModal.nombre || ""}</div>
            <button
              ref={closeRef}
              type="button"
              aria-label="Cerrar"
              onClick={() => setVideoModal(null)}
              style={{ background: "none", border: "none", color: "#8B9AB2", fontSize: 24, cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 12, overflow: "hidden", background: "#000" }}>
            {videoModal.videoId ? (
              <iframe
                key={videoModal.videoId}
                title={videoModal.nombre || "YouTube"}
                src={getYoutubeEmbedSrc(videoModal.videoId)}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : null}
          </div>
        </div>
      </div>,
      document.body
    )
  );
}

export default VideoModal;
