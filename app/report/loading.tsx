export default function ReportLoading() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      fontFamily: "sans-serif",
      background: "#f8fafc",
      gap: 16,
    }}>
      <div style={{
        width: 48,
        height: 48,
        border: "4px solid #e2e8f0",
        borderTop: "4px solid #3b82f6",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: "#64748b", fontSize: 16 }}>📄 日本市場展開レポートを生成中...</p>
      <p style={{ color: "#94a3b8", fontSize: 13 }}>AIが分析中です。30秒ほどお待ちください。</p>
    </div>
  );
}
