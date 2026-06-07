export default function DesktopSidebarNavItem({
  item,
  active,
  collapsed,
  DS,
  getRowButtonStyle,
  onClick,
}) {
  var Icon = item.icon;
  var label = item.label;

  return (
    <button
      type="button"
      title={collapsed ? label : undefined}
      onClick={onClick}
      style={Object.assign(getRowButtonStyle({ collapsed: collapsed }), {
        fontWeight: active ? 600 : 500,
        color: active ? DS.activeLabel : DS.muted,
        background: active ? DS.activeBg : "transparent",
        boxShadow: active ? "inset 0 0 0 1px rgba(59,130,246,0.25)" : "none",
        transition: "background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease",
        position: "relative",
      })}
      onMouseEnter={function (e) {
        if (!active) e.currentTarget.style.background = DS.hover;
      }}
      onMouseLeave={function (e) {
        if (!active) e.currentTarget.style.background = "transparent";
        else e.currentTarget.style.background = DS.activeBg;
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
      <Icon size={20} color={active ? DS.primaryLight : DS.iconInactive} strokeWidth={2} style={{ flexShrink: 0 }} />
      {!collapsed ? <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span> : null}
    </button>
  );
}
