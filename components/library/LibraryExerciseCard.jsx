import React, { useState } from 'react';

function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/shorts\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function LibraryExerciseCard({
  e,
  isCustom,
  nombre,
  muscleLine,
  ytUrl,
  patLabel,
  bgCard,
  cardBorder,
  _dm,
  bgSub,
  textMain,
  textMuted,
  border,
  libNarrow,
  Ic,
  msg,
  lang,
  onEdit,
  onDelete,
}) {
  void lang;
  const [showVideo, setShowVideo] = useState(false);
  const videoId = extractYouTubeId(ytUrl);

  const btnStyle = { width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: '#111827', border: '1px solid #1E293B', borderRadius: 7, cursor: "pointer", flexShrink: 0, fontFamily: "inherit", padding: 0, color: textMuted };

  return (
    <div
      className={"it-bib-ex-card min-w-0 " + (_dm ? "it-bib-ex-card-d" : "it-bib-ex-card-l")}
      style={{
        background: bgCard,
        border: libNarrow ? "none" : "1px solid " + cardBorder,
        borderRadius: 17,
        padding: '10px 12px',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0 }}>
        {/* Thumbnail */}
        {videoId ? (
          <img
            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
            alt=""
            style={{ width: 90, height: 68, flexShrink: 0, borderRadius: '8px', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ width: 90, height: 68, flexShrink: 0, borderRadius: '8px', background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#4B5563', fontSize: 20 }}>▶</span>
          </div>
        )}

        {/* Right side */}
        <div style={{ flex: 1, minWidth: 0, paddingLeft: '10px' }}>
          {/* Name + action buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ flex: 1, fontSize: 17, fontWeight: 800, color: textMain, lineHeight: 1.3, wordBreak: "break-word", overflowWrap: "anywhere" }}>
              {nombre}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
              {ytUrl && (
                videoId ? (
                  <button
                    type="button"
                    onClick={() => setShowVideo(v => !v)}
                    aria-label={msg("Ver video", "Watch video", "Ver vídeo")}
                    style={{ ...btnStyle, fontSize: 14 }}
                  >▶</button>
                ) : (
                  <a
                    href={ytUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={msg("Ver video", "Watch video", "Ver vídeo")}
                    style={{ ...btnStyle, textDecoration: "none", fontSize: 14 }}
                  >▶</a>
                )
              )}
              <button
                type="button"
                onClick={onEdit}
                style={{ ...btnStyle, fontSize: 18 }}
              >⋮</button>
              {isCustom && (
                <button
                  type="button"
                  onClick={onDelete}
                  style={btnStyle}
                >
                  <Ic name="trash-2" size={13}/>
                </button>
              )}
            </div>
          </div>

          {/* Tags */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 7 }}>
            <span
              className="inline-flex"
              style={{ background: _dm ? "rgba(22, 34, 52, 0.85)" : "rgba(226, 232, 240, 0.85)", color: textMuted, padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, border: "1px solid " + cardBorder, letterSpacing: 0.2 }}
            >
              {patLabel(e.pattern)}
            </span>
            {muscleLine && (
              <span
                className="inline-flex"
                style={{ background: _dm ? "rgba(22, 34, 52, 0.5)" : "rgba(37, 99, 235, 0.08)", color: _dm ? textMuted : "#0F1923", padding: "2px 7px", borderRadius: 8, fontSize: 10, fontWeight: 600, border: "1px solid " + (_dm ? "rgba(45, 64, 87, 0.45)" : border), maxWidth: "100%" }}
              >
                {muscleLine}
              </span>
            )}
          </div>
        </div>
      </div>

      {showVideo && videoId && (
        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', marginTop: '10px' }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <button
            onClick={() => setShowVideo(false)}
            style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: '#fff', fontSize: '14px', cursor: 'pointer', zIndex: 1 }}
          >✕</button>
        </div>
      )}
    </div>
  );
}
