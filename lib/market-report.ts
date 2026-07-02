import type { JapanMarketReportData } from "./claude";

const COMPANY = "Blink Japan Co., Ltd.";
const CONTACT_EMAIL = "cbec@blink-japan.com";
const COMPANY_URL = "https://blink-japan.com/";

export interface MarketReportInput {
  productTitle: string;
  productUrl: string;
  raisedUsd: number;
  backers: number;
  platform: string;
  reportData: JapanMarketReportData;
}

export function buildMarketReportHtml(input: MarketReportInput): string {
  const { productTitle, productUrl, raisedUsd, backers, platform, reportData } = input;
  const achievement = `$${raisedUsd.toLocaleString("en-US")}（支援者${backers.toLocaleString()}人）`;
  const platformLabel = platform === "kickstarter" ? "Kickstarter" : platform === "indiegogo" ? "Indiegogo" : platform;
  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  const whyLines = reportData.whySellsInJapan
    .split("\n")
    .filter(Boolean)
    .map((l) => `<li>${escapeHtml(l.replace(/^[・\-\*]\s*/, ""))}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>日本市場展開提案書 — ${escapeHtml(productTitle)}</title>
<style>
  body { font-family: "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif; color: #1a1a1a; margin: 0; padding: 0; background: #f8f9fa; }
  .container { max-width: 720px; margin: 0 auto; background: #fff; }
  .header { background: #0f172a; color: #fff; padding: 40px 48px 32px; }
  .header h1 { margin: 0 0 8px; font-size: 22px; font-weight: 700; }
  .header .subtitle { color: #94a3b8; font-size: 13px; margin: 0; }
  .meta { background: #1e293b; color: #cbd5e1; padding: 16px 48px; font-size: 12px; display: flex; gap: 32px; }
  .meta span strong { color: #fff; }
  .body { padding: 40px 48px; }
  .section { margin-bottom: 36px; }
  .section h2 { font-size: 14px; font-weight: 700; color: #0f172a; border-left: 3px solid #3b82f6; padding-left: 12px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  .section p { font-size: 14px; line-height: 1.8; color: #374151; margin: 0; }
  .section ul { margin: 0; padding-left: 20px; }
  .section ul li { font-size: 14px; line-height: 1.9; color: #374151; }
  .highlight { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px 24px; margin-bottom: 36px; }
  .highlight p { font-size: 14px; line-height: 1.8; color: #1e40af; margin: 0; }
  .channels { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .tag { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 10px; font-size: 12px; color: #475569; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 48px; }
  .footer p { font-size: 12px; color: #64748b; margin: 2px 0; }
  .footer a { color: #3b82f6; text-decoration: none; }
  .divider { border: none; border-top: 1px solid #e2e8f0; margin: 0; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>日本市場展開 提案書</h1>
    <p class="subtitle">${escapeHtml(productTitle)}</p>
  </div>
  <div class="meta">
    <span><strong>${platformLabel}</strong> にて</span>
    <span>調達額 <strong>${achievement}</strong></span>
    <span>作成日 <strong>${today}</strong></span>
  </div>

  <div class="body">

    <div class="highlight">
      <p>
        貴社の「${escapeHtml(productTitle)}」は${platformLabel}にて${achievement}を達成されました。
        弊社 ${COMPANY} は日本のクラウドファンディング・小売市場への展開を専門とする企業です。
        本資料では、貴社製品の日本市場展開の可能性についてご提案します。
      </p>
    </div>

    <div class="section">
      <h2>この製品が日本で売れる理由</h2>
      <ul>${whyLines}</ul>
    </div>

    <div class="section">
      <h2>日本市場概況</h2>
      <p>${escapeHtml(reportData.marketOverview)}</p>
    </div>

    <div class="section">
      <h2>ターゲット層</h2>
      <p>${escapeHtml(reportData.targetAudience)}</p>
    </div>

    <div class="section">
      <h2>販売戦略・展開ロードマップ</h2>
      <p>${escapeHtml(reportData.salesStrategy)}</p>
      <div class="channels">
        <span class="tag">Makuake</span>
        <span class="tag">CAMPFIRE</span>
        <span class="tag">GREEN FUNDING</span>
        <span class="tag">Amazon Japan</span>
        <span class="tag">ヤマダ電機</span>
        <span class="tag">テレビショッピング</span>
      </div>
    </div>

    <div class="section">
      <h2>独占販売契約の意義</h2>
      <p>${escapeHtml(reportData.competitiveEdge)}</p>
    </div>

    <div class="section">
      <h2>弊社について</h2>
      <p>
        ${COMPANY} は海外クラウドファンディング製品の日本市場への独占販売契約締結・販売展開を専門としています。
        テレビ番組制作・テレビショッピングネットワーク、タレントコラボキャンペーン、
        Makuake・CAMPFIRE・GREEN FUNDINGとの直接パートナーシップを通じて、
        累計多数の海外発製品を日本市場に成功導入してきました。
      </p>
    </div>

    <div class="section">
      <h2>クラウドファンディングページ</h2>
      <p><a href="${escapeHtml(productUrl)}" style="color:#3b82f6;">${escapeHtml(productUrl)}</a></p>
    </div>

  </div>

  <hr class="divider">
  <div class="footer">
    <p><strong>${COMPANY}</strong></p>
    <p>Email: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
    <p>Web: <a href="${COMPANY_URL}">${COMPANY_URL}</a></p>
  </div>
</div>
</body>
</html>`;
}

export function buildMarketReportText(input: MarketReportInput): string {
  const { productTitle, productUrl, raisedUsd, backers, platform, reportData } = input;
  const achievement = `$${raisedUsd.toLocaleString("en-US")}（支援者${backers.toLocaleString()}人）`;
  const platformLabel = platform === "kickstarter" ? "Kickstarter" : platform === "indiegogo" ? "Indiegogo" : platform;

  return `【日本市場展開 提案書】
${productTitle}
${platformLabel} 調達額: ${achievement}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▍この製品が日本で売れる理由
${reportData.whySellsInJapan}

▍日本市場概況
${reportData.marketOverview}

▍ターゲット層
${reportData.targetAudience}

▍販売戦略
${reportData.salesStrategy}
販売チャネル: Makuake / CAMPFIRE / GREEN FUNDING / Amazon Japan / ヤマダ電機 / テレビショッピング

▍独占販売契約の意義
${reportData.competitiveEdge}

▍弊社について
${COMPANY} は海外クラウドファンディング製品の日本市場への独占販売契約締結・販売展開を専門としています。

クラウドファンディングページ: ${productUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${COMPANY}
${CONTACT_EMAIL}
${COMPANY_URL}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
