import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { findLocalProject } from "@/lib/project-store";
import { generateJapanMarketReport } from "@/lib/claude";
import { buildMarketReportHtml } from "@/lib/market-report";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

export default async function ReportPage({ params }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let project: any = await findLocalProject(params.id);
  if (isSupabaseConfigured()) {
    const supabase = createServerSupabase();
    const { data } = await supabase.from("projects").select("*").eq("id", params.id).single();
    if (data) project = data;
  }

  if (!project) {
    return <div style={{ padding: 40 }}>案件が見つかりません</div>;
  }

  let reportHtml = "";
  try {
    const reportData = await generateJapanMarketReport(
      project.title_ja ?? project.title,
      project.subtitle_ja ?? project.subtitle ?? "",
      project.category ?? "",
      project.raised_usd,
      project.backers,
      project.platform,
    );

    reportHtml = buildMarketReportHtml({
      productTitle: project.title_ja ?? project.title,
      productUrl: project.original_url,
      raisedUsd: project.raised_usd,
      backers: project.backers,
      platform: project.platform,
      reportData,
    });
  } catch {
    return <div style={{ padding: 40 }}>レポート生成に失敗しました。APIキーを確認してください。</div>;
  }

  // Extract body content from the generated HTML
  const bodyMatch = reportHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : reportHtml;

  // Extract styles
  const styleMatch = reportHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const styles = styleMatch ? styleMatch[1] : "";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .container { max-width: 100% !important; }
        }
        .print-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: #0f172a;
          color: #fff;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 1000;
          font-family: sans-serif;
          font-size: 14px;
        }
        .print-btn {
          background: #3b82f6;
          color: #fff;
          border: none;
          padding: 8px 20px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .print-btn:hover { background: #2563eb; }
        body { margin-top: 52px; }
        @media print { body { margin-top: 0; } }
      `}</style>
      <div className="no-print print-bar">
        <span>📄 日本市場展開提案書 — {project.title_ja ?? project.title}</span>
        <button className="print-btn" onClick={() => window.print()}>
          PDFとして保存
        </button>
      </div>
      <div dangerouslySetInnerHTML={{ __html: bodyContent }} />
      <script dangerouslySetInnerHTML={{
        __html: `
          // Auto-show print hint
          document.querySelector('.print-btn').addEventListener('click', function() {
            window.print();
          });
        `
      }} />
    </>
  );
}
