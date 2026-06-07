export default function DesktopSidebarProfileRow({
  coachAvatarUrl,
  coachName,
  coachInitials,
  collapsed,
  label,
  active,
  DS,
  onClick,
}) {
  return (
    <button
      type="button"
      title={collapsed ? label : undefined}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: collapsed ? "12px 10px" : "10px 12px",
        paddingLeft: 0,
        justifyContent: "flex-start",
        border: "none",
        borderRadius: 10,
        cursor: "pointer",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: 14,
        width: "100%",
        boxSizing: "border-box",
        background: active ? DS.activeBg : "transparent",
        color: active ? DS.text : DS.muted,
        fontWeight: active ? 600 : 500,
        boxShadow: active ? "inset 0 0 0 1px rgba(59,130,246,0.25)" : "none",
        transition: "background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease",
        position: "relative",
      }}
      onMouseEnter={function (e) {
        if (!active) {
          e.currentTarget.style.background = DS.hover;
          e.currentTarget.style.color = DS.text;
        }
      }}
      onMouseLeave={function (e) {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = DS.muted;
        } else {
          e.currentTarget.style.background = DS.activeBg;
          e.currentTarget.style.color = DS.text;
        }
      }}
    >
      {active ? (
        <span
          style={{
            position: "absolute",
            left: -12,
            top: "50%",
            width: 3,
            height: 22,
            marginTop: -11,
            borderRadius: "0 4px 4px 0",
            background: DS.primary,
          }}
        />
      ) : null}
      {coachAvatarUrl ? (
        <img src={coachAvatarUrl} alt="" style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
      ) : (
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#1e3a5f,#2563eb)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 10,
            color: "#fff",
            flexShrink: 0,
          }}
          aria-label={coachName || label}
        >
          {coachInitials}
        </div>
      )}
      {!collapsed ? <span>{label}</span> : null}
    </button>
  );
}
