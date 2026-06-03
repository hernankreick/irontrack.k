import React from 'react';

export default function OfflineSyncBanner({ message, pendingCount }) {
  return (
    <div style={{
      background: "#1f1500",
      borderBottom: "1px solid #F59E0B44",
      padding: "8px 16px",
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 12,
      color: "#fbbf24",
      fontWeight: 500,
      animation: "slideUpFade .3s ease",
    }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flexShrink: 0 }} />
      <span>{message}</span>
      {pendingCount > 0 && (
        <span style={{ marginLeft: "auto", background: "#F59E0B22", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
          {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
