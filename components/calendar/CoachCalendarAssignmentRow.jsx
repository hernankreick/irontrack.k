export default function CoachCalendarAssignmentRow({ item, P, Trash2, M, lang, onDelete }) {
  return (
    <div
      style={{
        background: P.card,
        border: "1px solid " + P.border,
        borderRadius: 16,
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: P.text,
            fontSize: 15,
            fontWeight: 900,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.alumno_nombre}
        </div>
        <div
          style={{
            color: P.muted,
            fontSize: 13,
            fontWeight: 700,
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.rutina_nombre}
        </div>
      </div>
      <button
        type="button"
        className="hov"
        onClick={onDelete}
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          border: "none",
          background: "rgba(239,68,68,0.12)",
          color: P.danger,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
        aria-label={M(lang, "Eliminar", "Delete", "Excluir")}
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}
