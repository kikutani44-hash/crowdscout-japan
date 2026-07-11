"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

export default function ReportPage() {
  const params = useParams();
  const id = params.id as string;
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dots, setDots] = useState(0);

  const triggerBackground = useCallback(async () => {
    // Create generating record in Supabase first via API
    await fetch("/api/market-report/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id }),
    }).catch(() => {});

    // Directly call background function from browser (avoids server env var issues)
    fetch("/.netlify/functions/report-generate-background", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id }),
    }).catch(() => {}); // Returns 202 immediately, generation happens async
  }, [id]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/market-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });
      const data = await res.json() as {
        status?: string;
        html?: string;
        error?: string;
      };

      if (data.status === "ready" && data.html) {
        setHtml(data.html);
      } else if (data.status === "error") {
        setError(data.error ?? "生成に失敗しました。再試行してください。");
      } else if (data.status === "not_started") {
        // Trigger background function directly from browser
        triggerBackground();
      }
      // "generating" → keep polling
    } catch {
      // Network error — keep polling
    }
  }, [id, triggerBackground]);

  useEffect(() => {
    // Initial call
    poll();

    // Poll every 4 seconds
    const interval = setInterval(poll, 4000);

    // Animate dots
    const dotTimer = setInterval(() => setDots((d) => (d + 1) % 4), 600);

    return () => {
      clearInterval(interval);
      clearInterval(dotTimer);
    };
  }, [poll]);

  // Stop polling when done or errored
  useEffect(() => {
    if (html || error) return;
  }, [html, error]);

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 600 }}>
        <h2 style={{ color: "#e53e3e" }}>⚠️ レポート生成に失敗しました</h2>
        <p style={{ color: "#4a5568" }}>{error}</p>
        <button
          onClick={() => { setError(null); poll(); }}
          style={{
            marginTop: 16, padding: "10px 24px", background: "#3b82f6",
            color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14,
          }}
        >
          再試行
        </button>
      </div>
    );
  }

  if (!html) {
    const dotStr = ".".repeat(dots + 1);
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif",
        background: "#f8fafc", gap: 20,
      }}>
        <div style={{
          width: 56, height: 56,
          border: "5px solid #e2e8f0", borderTop: "5px solid #3b82f6",
          borderRadius: "50%", animation: "spin 1s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#1e293b", fontSize: 17, fontWeight: 600, margin: 0 }}>
            📄 日本市場展開レポートを生成中{dotStr}
          </p>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>
            AIが分析中です。通常30〜60秒かかります。
          </p>
          <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
            このページを閉じずにお待ちください
          </p>
        </div>
      </div>
    );
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const styles = styleMatch ? styleMatch[1] : "";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <style>{`
        @media print { .no-print { display: none !important; } }
        .regen-bar {
          position: fixed; bottom: 16px; right: 16px; z-index: 9999;
        }
        .regen-btn {
          background: #374151; color: #fff; border: none;
          padding: 8px 14px; border-radius: 8px;
          font-size: 12px; font-weight: 600; cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          opacity: 0.7;
        }
        .regen-btn:hover { opacity: 1; }
      `}</style>
      <div className="no-print regen-bar">
        <button
          className="regen-btn"
          onClick={async () => {
            if (!confirm("レポートを再生成しますか？")) return;
            await fetch("/api/market-report/reset", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId: id }),
            });
            window.location.reload();
          }}
        >
          🔄 再生成
        </button>
      </div>
      <div dangerouslySetInnerHTML={{ __html: bodyContent }} />
    </>
  );
}
