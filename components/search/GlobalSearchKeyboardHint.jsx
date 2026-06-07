export default function GlobalSearchKeyboardHint({ th }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "8px 12px",
        borderTop: "1px solid " + th.footerBorder,
        fontSize: 11,
        color: th.sectionLabel,
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      <kbd
        style={{
          background: th.kbdBg,
          border: "1px solid " + th.kbdBorder,
          borderRadius: 4,
          padding: "2px 6px",
          fontSize: 10,
          fontFamily: "'DM Mono',monospace",
        }}
      >
        {"\u2191\u2193"}
      </kbd>
      <kbd
        style={{
          background: th.kbdBg,
          border: "1px solid " + th.kbdBorder,
          borderRadius: 4,
          padding: "2px 6px",
          fontSize: 10,
          fontFamily: "'DM Mono',monospace",
        }}
      >
        {"\u21B5"}
      </kbd>
      <kbd
        style={{
          background: th.kbdBg,
          border: "1px solid " + th.kbdBorder,
          borderRadius: 4,
          padding: "2px 6px",
          fontSize: 10,
          fontFamily: "'DM Mono',monospace",
        }}
      >
        Esc
      </kbd>
    </div>
  );
}
