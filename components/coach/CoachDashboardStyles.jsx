export default function CoachDashboardStyles({ darkMode }) {
  return (
    <style>{`
      .cd-card,
      .cd-quick-card,
      .cd-attention-block,
      .cd-row {
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
        transform: translateY(0);
      }
      .cd-card {
        animation: cdIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .cd-card:hover,
      .cd-quick-card:hover {
        transform: translateY(-2px);
        box-shadow: ${darkMode ? "0 18px 42px rgba(0,0,0,0.26)" : "0 16px 34px rgba(15,23,42,0.08)"} !important;
        border-color: ${darkMode ? "rgba(148,163,184,0.24)" : "rgba(37,99,235,0.22)"} !important;
      }
      .cd-attention-block:hover,
      .cd-row:hover {
        transform: translateY(-2px);
        border-color: ${darkMode ? "rgba(148,163,184,0.22)" : "rgba(37,99,235,0.18)"} !important;
      }
      .cd-btn {
        transition: transform 0.16s ease, background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
      }
      .cd-btn:active {
        transform: scale(0.97);
      }
      .cd-progress-fill {
        transition: width 0.42s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes cdIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .cd-quick-card:focus-visible,
      .cd-btn:focus-visible {
        outline: 2px solid rgba(59,130,246,0.7);
        outline-offset: 2px;
      }
    `}</style>
  );
}
