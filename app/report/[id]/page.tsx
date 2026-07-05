"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ReportPage() {
  const params = useParams();
  const id = params.id as string;
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      try {
        const res = await fetch("/api/market-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: id }),
        });

        if (!res.ok || !res.body) {
          setError("レポートの生成に失敗しました。再試行してください。");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Animate progress while streaming
        let tick = 0;
        const timer = setInterval(() => {
          tick++;
          setProgress(Math.min(90, tick * 3));
        }, 800);

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Check for result marker
          const resultIdx = buffer.indexOf("__RESULT__");
          if (resultIdx !== -1) {
            const endIdx = buffer.indexOf("__END__", resultIdx);
            if (endIdx !== -1) {
              const payload = buffer.slice(resultIdx + 10, endIdx);
              try {
                const data = JSON.parse(payload) as { html: string };
                clearInterval(timer);
                setProgress(100);
                if (!cancelled) setHtml(data.html);
              } catch {
                if (!cancelled) setError("レポートの解析に失敗しました。");
              }
              return;
            }
          }

          // Check for error marker
          const errIdx = buffer.indexOf("__ERROR__");
          if (errIdx !== -1) {
            const endIdx = buffer.indexOf("__END__", errIdx);
            if (endIdx !== -1) {
              const payload = buffer.slice(errIdx + 9, endIdx);
              try {
                const data = JSON.parse(payload) as { error: string };
                clearInterval(timer);
                if (!cancelled) setError(data.error);
              } catch {
                if (!cancelled) setError("レポートの生成に失敗しました。");
              }
              return;
            }
          }
        }
        clearInterval(timer);
      } catch {
        if (!cancelled) setError("レポートの生成に失敗しました。再試行してください。");
      }
    }

    generate();
    return () => { cancelled = true; };
  }, [id]);

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 600 }}>
        <h2 style={{ color: "#e53e3e" }}>⚠️ レポート生成に失敗しました</h2>
        <p style={{ color: "#4a5568" }}>{error}</p>
        <button
          onClick={() => { setError(null); setProgress(0); window.location.reload(); }}
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
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif",
        background: "#f8fafc", gap: 16,
      }}>
        <div style={{
          width: 48, height: 48,
          border: "4px solid #e2e8f0", borderTop: "4px solid #3b82f6",
          borderRadius: "50%", animation: "spin 1s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "#64748b", fontSize: 16 }}>📄 日本市場展開レポートを生成中...</p>
        <p style={{ color: "#94a3b8", fontSize: 13 }}>AIが分析中です。30〜45秒ほどお待ちください。</p>
        {progress > 0 && (
          <div style={{ width: 280, background: "#e2e8f0", borderRadius: 4, height: 6 }}>
            <div style={{
              width: `${progress}%`, background: "#3b82f6",
              height: "100%", borderRadius: 4, transition: "width 0.8s ease",
            }} />
          </div>
        )}
      </div>
    );
  }

  // Extract body content and styles from the generated HTML
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const styles = styleMatch ? styleMatch[1] : "";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <style>{`
        @media print { .no-print { display: none !important; } body { background: #fff !important; } }
        .print-bar {
          position: fixed; top: 0; left: 0; right: 0;
          background: #0f172a; color: #fff;
          padding: 12px 24px; display: flex; align-items: center;
          justify-content: space-between; z-index: 1000;
          font-family: sans-serif; font-size: 14px;
        }
        .print-btn {
          background: #3b82f6; color: #fff; border: none;
          padding: 8px 20px; border-radius: 6px;
          font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .print-btn:hover { background: #2563eb; }
        body { margin-top: 52px; }
        @media print { body { margin-top: 0; } }
      `}</style>
      <div className="no-print print-bar">
        <span>📄 日本市場展開提案書</span>
        <button className="print-btn" onClick={() => window.print()}>PDFとして保存</button>
      </div>
      <div dangerouslySetInnerHTML={{ __html: bodyContent }} />
    </>
  );
}
