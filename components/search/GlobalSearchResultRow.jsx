export default function GlobalSearchResultRow({
  th,
  secKind,
  row,
  query,
  isActive,
  onHover,
  onOpen,
  HighlightMatch,
  initials,
  BADGE_ALUMNO,
  BADGE_OTROS,
  ClipboardList,
  Dumbbell,
  FileText,
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onMouseEnter={onHover}
      onClick={onOpen}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        border: "none",
        background: isActive ? th.rowHover : "transparent",
        cursor: "pointer",
        textAlign: "left",
        boxSizing: "border-box",
      }}
    >
      {secKind === "alumno" ? (
        <>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: th.avatarBg,
              color: th.avatarColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {initials(row.nombre)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: th.rowText,
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              <HighlightMatch text={row.nombre} query={query} highlightColor={th.highlight} />
            </div>
            <div style={{ fontSize: 12, color: th.rowMuted, marginTop: 2 }}>
              {row.pctSemanal}% semanal · {row.sesionesCompletadas} sesiones
            </div>
          </div>
          {(() => {
            var st = BADGE_ALUMNO[row.estado] || BADGE_ALUMNO.ok;
            return (
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "'DM Mono',monospace",
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: st.bg,
                  color: st.color,
                  flexShrink: 0,
                }}
              >
                {st.label}
              </span>
            );
          })()}
        </>
      ) : null}

      {secKind === "rutina" ? (
        <>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: th.avatarBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ClipboardList size={18} color={th.highlight} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: th.rowText }}>
              <HighlightMatch text={row.nombre} query={query} highlightColor={th.highlight} />
            </div>
            <div style={{ fontSize: 12, color: th.rowMuted, marginTop: 2 }}>
              {row.ejerciciosCount} ej. · Sem. {row.semanaActual} · {row.alumnosAsignados}
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontFamily: "'DM Mono',monospace",
              padding: "3px 8px",
              borderRadius: 6,
              background: BADGE_OTROS.activa.bg,
              color: BADGE_OTROS.activa.color,
            }}
          >
            {BADGE_OTROS.activa.label}
          </span>
        </>
      ) : null}

      {secKind === "ejercicio" ? (
        <>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: th.avatarBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Dumbbell size={18} color={th.highlight} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: th.rowText }}>
              <HighlightMatch text={row.nombre} query={query} highlightColor={th.highlight} />
            </div>
            <div style={{ fontSize: 12, color: th.rowMuted, marginTop: 2 }}>{row.grupoMuscular}</div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontFamily: "'DM Mono',monospace",
              padding: "3px 8px",
              borderRadius: 6,
              background: BADGE_OTROS[row.tipo === "aislado" ? "aislado" : "compuesto"].bg,
              color: BADGE_OTROS[row.tipo === "aislado" ? "aislado" : "compuesto"].color,
            }}
          >
            {BADGE_OTROS[row.tipo === "aislado" ? "aislado" : "compuesto"].label}
          </span>
        </>
      ) : null}

      {secKind === "sesion" ? (
        <>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: th.avatarBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FileText size={18} color={th.highlight} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: th.rowText }}>
              <HighlightMatch
                text={row.alumnoNombre + " · " + row.tipoSesion}
                query={query}
                highlightColor={th.highlight}
              />
            </div>
            <div style={{ fontSize: 12, color: th.rowMuted, marginTop: 2 }}>{row.fechaLabel}</div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontFamily: "'DM Mono',monospace",
              padding: "3px 8px",
              borderRadius: 6,
              background: row.estado === "pendiente" ? BADGE_OTROS.pendiente.bg : BADGE_OTROS.completada.bg,
              color: row.estado === "pendiente" ? BADGE_OTROS.pendiente.color : BADGE_OTROS.completada.color,
            }}
          >
            {row.estado === "pendiente" ? "PENDIENTE" : "COMPLETADA"}
          </span>
        </>
      ) : null}
    </button>
  );
}
