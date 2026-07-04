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
  imageUrl: string | null;
  reportData: JapanMarketReportData;
}

export function buildMarketReportHtml(input: MarketReportInput): string {
  const { productTitle, productUrl, raisedUsd, backers, platform, imageUrl, reportData } = input;
  const platformLabel = platform === "kickstarter" ? "Kickstarter" : platform === "indiegogo" ? "Indiegogo" : platform;
  const raisedFmt = `$${raisedUsd.toLocaleString("en-US")}`;
  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

  const whyItemsJa = reportData.whySellsInJapan.split("\n").filter(Boolean).map(l => l.replace(/^[・\-\*]\s*/, ""));
  const whyItemsEn = reportData.whySellsInJapanEn.split("\n").filter(Boolean).map(l => l.replace(/^[•\-\*]\s*/, ""));

  const icons = ["🎯", "🌸", "📱", "💎", "🚀"];

  const whyCardsJa = whyItemsJa.slice(0, 4).map((item, i) => `
    <div class="why-card">
      <div class="why-num">0${i + 1}</div>
      <div class="why-icon">${icons[i] ?? "✨"}</div>
      <p class="why-text">${esc(item)}</p>
    </div>`).join("");

  const whyCardsEn = whyItemsEn.slice(0, 4).map((item, i) => `
    <div class="why-card">
      <div class="why-num">0${i + 1}</div>
      <div class="why-icon">${icons[i] ?? "✨"}</div>
      <p class="why-text">${esc(item)}</p>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Japan Market Proposal — ${esc(productTitle)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Hiragino Kaku Gothic Pro", "Noto Sans JP", "Meiryo", -apple-system, sans-serif; color: #1a1a2e; background: #fff; }

  /* ── Language toggle ── */
  .lang-toggle {
    position: fixed; top: 16px; right: 20px; z-index: 1000;
    display: flex; gap: 0; border-radius: 8px; overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,.25);
  }
  .lang-btn {
    padding: 8px 18px; font-size: 13px; font-weight: 700; border: none; cursor: pointer;
    transition: background .2s, color .2s;
  }
  .lang-btn.active { background: #7c3aed; color: #fff; }
  .lang-btn:not(.active) { background: #1e1b4b; color: #a78bfa; }
  .lang-btn:hover:not(.active) { background: #2d2a6e; }

  /* ── Print bar ── */
  .print-bar {
    position: fixed; top: 0; left: 0; right: 0;
    background: rgba(15,23,42,.92); backdrop-filter: blur(8px);
    color: #fff; padding: 10px 20px;
    display: flex; align-items: center; justify-content: space-between;
    z-index: 999; font-size: 13px;
  }
  .print-btn {
    background: #7c3aed; color: #fff; border: none;
    padding: 7px 18px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px;
  }
  .print-btn:hover { background: #6d28d9; }
  body { padding-top: 48px; }

  /* ── Hero ── */
  .hero {
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #0f172a 100%);
    color: #fff; padding: 72px 48px 60px; position: relative; overflow: hidden;
  }
  .hero::before {
    content: ""; position: absolute; inset: 0;
    background: radial-gradient(ellipse at 70% 50%, rgba(124,58,237,.18) 0%, transparent 60%);
  }
  .hero-inner { display: flex; align-items: center; gap: 48px; position: relative; }
  .hero-text { flex: 1; min-width: 0; }
  .hero-img { flex-shrink: 0; width: 260px; height: 200px; border-radius: 16px; overflow: hidden; border: 2px solid rgba(124,58,237,.4); box-shadow: 0 8px 40px rgba(0,0,0,.4); }
  .hero-img img { width: 100%; height: 100%; object-fit: cover; }
  @media (max-width: 700px) { .hero-inner { flex-direction: column; } .hero-img { width: 100%; height: 180px; } }
  .hero-badge {
    display: inline-block; background: rgba(124,58,237,.3); border: 1px solid rgba(124,58,237,.5);
    color: #c4b5fd; font-size: 11px; font-weight: 700; letter-spacing: .1em;
    padding: 4px 14px; border-radius: 20px; margin-bottom: 20px; text-transform: uppercase;
  }
  .hero h1 { font-size: clamp(24px, 4vw, 38px); font-weight: 800; line-height: 1.3; margin-bottom: 16px; position: relative; }
  .hero-sub { color: #a5b4fc; font-size: 15px; line-height: 1.7; max-width: 600px; position: relative; }

  /* ── Stats ── */
  .stats {
    background: #1e1b4b; padding: 28px 48px;
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 0;
  }
  .stat { text-align: center; padding: 8px 16px; border-right: 1px solid rgba(255,255,255,.08); }
  .stat:last-child { border-right: none; }
  .stat-num { font-size: 28px; font-weight: 900; color: #a78bfa; line-height: 1; }
  .stat-label { font-size: 11px; color: #64748b; margin-top: 6px; }

  /* ── Section common ── */
  .section { padding: 56px 48px; }
  .section-alt { background: #f8f7ff; }
  .section-dark { background: #0f172a; color: #e2e8f0; }
  .section-title {
    font-size: 13px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: #7c3aed; margin-bottom: 10px;
  }
  .section-dark .section-title { color: #a78bfa; }
  .section h2 { font-size: clamp(20px, 3vw, 28px); font-weight: 800; margin-bottom: 32px; line-height: 1.3; }
  .section-dark h2 { color: #f1f5f9; }

  /* ── Why cards ── */
  .why-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
  .why-card {
    background: #fff; border: 1px solid #e9d5ff; border-radius: 12px;
    padding: 24px; position: relative;
  }
  .section-dark .why-card { background: #1e2a3a; border-color: #334155; }
  .why-num { font-size: 32px; font-weight: 900; color: #ede9fe; line-height: 1; margin-bottom: 8px; }
  .section-dark .why-num { color: #1e3a5f; }
  .why-icon { font-size: 22px; margin-bottom: 10px; }
  .why-text { font-size: 14px; line-height: 1.8; color: #374151; }
  .section-dark .why-text { color: #cbd5e1; }

  /* ── Text sections ── */
  .text-block { font-size: 15px; line-height: 1.9; color: #374151; max-width: 680px; }
  .section-dark .text-block { color: #94a3b8; }

  /* ── Channels ── */
  .channels { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
  .channel-tag {
    background: #ede9fe; color: #5b21b6; border-radius: 6px;
    padding: 6px 14px; font-size: 13px; font-weight: 600;
  }
  .section-dark .channel-tag { background: #1e2a3a; color: #a78bfa; }

  /* ── About ── */
  .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: start; }
  .about-label { font-size: 12px; color: #7c3aed; font-weight: 700; letter-spacing: .08em; margin-bottom: 4px; }
  .about-value { font-size: 14px; color: #1e293b; }
  .about-value a { color: #7c3aed; text-decoration: none; }

  /* ── Footer ── */
  .footer {
    background: #0f172a; color: #475569; text-align: center;
    padding: 28px 48px; font-size: 12px;
  }
  .footer a { color: #7c3aed; }

  /* ── Language layers ── */
  [data-lang="en"] { display: none; }

  /* ── Print ── */
  @media print {
    .print-bar, .lang-toggle { display: none !important; }
    body { padding-top: 0; }
    .stats { grid-template-columns: repeat(4, 1fr); }
    .why-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .hero, .section { padding: 40px 24px; }
    .stats { grid-template-columns: repeat(2, 1fr); padding: 20px 24px; }
    .why-grid { grid-template-columns: 1fr; }
    .about-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>

<!-- Print bar -->
<div class="print-bar no-print">
  <span>📄 Japan Market Proposal — ${esc(productTitle)}</span>
  <button class="print-btn" onclick="window.print()">PDF として保存 / Save as PDF</button>
</div>

<!-- Language toggle -->
<div class="lang-toggle no-print">
  <button class="lang-btn active" id="btn-ja" onclick="setLang('ja')">🇯🇵 日本語</button>
  <button class="lang-btn" id="btn-en" onclick="setLang('en')">🇺🇸 English</button>
</div>

<!-- Hero -->
<div class="hero">
  <div class="hero-badge">Confidential Market Proposal · ${esc(COMPANY)}</div>
  <div class="hero-inner">
    <div class="hero-text">
      <h1 data-lang="ja">${esc(reportData.headlineJa)}</h1>
      <h1 data-lang="en">${esc(reportData.headlineEn)}</h1>
      <p class="hero-sub" data-lang="ja">${esc(productTitle)} は ${platformLabel} にて ${raisedFmt}（支援者 ${backers.toLocaleString()} 人）を達成した革新的製品です。${esc(COMPANY)} は日本市場での独占販売展開をご提案します。</p>
      <p class="hero-sub" data-lang="en">${esc(productTitle)} achieved ${raisedFmt} from ${backers.toLocaleString()} backers on ${platformLabel}. ${esc(COMPANY)} proposes an exclusive Japan market launch partnership.</p>
    </div>
    ${imageUrl ? `<div class="hero-img"><img src="${esc(imageUrl)}" alt="${esc(productTitle)}" /></div>` : ""}
  </div>
</div>

<!-- Stats -->
<div class="stats">
  <div class="stat">
    <div class="stat-num">${esc(reportData.marketSizeJpy)}</div>
    <div class="stat-label" data-lang="ja">日本関連市場規模</div>
    <div class="stat-label" data-lang="en">Japan Market Size</div>
  </div>
  <div class="stat">
    <div class="stat-num">${esc(reportData.growthRate)}</div>
    <div class="stat-label" data-lang="ja">年間市場成長率</div>
    <div class="stat-label" data-lang="en">Annual Growth Rate</div>
  </div>
  <div class="stat">
    <div class="stat-num">${raisedFmt}</div>
    <div class="stat-label" data-lang="ja">${platformLabel} 調達額</div>
    <div class="stat-label" data-lang="en">${platformLabel} Raised</div>
  </div>
  <div class="stat">
    <div class="stat-num">${backers.toLocaleString()}</div>
    <div class="stat-label" data-lang="ja">世界の支援者数</div>
    <div class="stat-label" data-lang="en">Global Backers</div>
  </div>
</div>

<!-- Why Japan section -->
<div class="section section-alt">
  <div class="section-title" data-lang="ja">日本市場適合性</div>
  <div class="section-title" data-lang="en">Japan Market Fit</div>
  <h2 data-lang="ja">${esc(productTitle)} が日本の消費者向けに作られた理由</h2>
  <h2 data-lang="en">Why ${esc(productTitle)} Is Built for Japanese Consumers</h2>
  <div class="why-grid" id="why-grid-ja" data-lang="ja">${whyCardsJa}</div>
  <div class="why-grid" id="why-grid-en" data-lang="en">${whyCardsEn}</div>
</div>

<!-- Market overview -->
<div class="section section-dark">
  <div class="section-title" data-lang="ja">市場概況</div>
  <div class="section-title" data-lang="en">Market Overview</div>
  <h2 data-lang="ja">日本市場は準備ができている</h2>
  <h2 data-lang="en">Japan Is Ready</h2>
  <p class="text-block" data-lang="ja">${esc(reportData.marketOverview)}</p>
  <p class="text-block" data-lang="en">${esc(reportData.marketOverviewEn)}</p>
</div>

<!-- Target audience -->
<div class="section">
  <div class="section-title" data-lang="ja">ターゲット層</div>
  <div class="section-title" data-lang="en">Target Audience</div>
  <h2 data-lang="ja">理想的な日本の消費者</h2>
  <h2 data-lang="en">The Ideal Japanese Consumer</h2>
  <p class="text-block" data-lang="ja">${esc(reportData.targetAudience)}</p>
  <p class="text-block" data-lang="en">${esc(reportData.targetAudienceEn)}</p>
</div>

<!-- Sales strategy -->
<div class="section section-alt">
  <div class="section-title" data-lang="ja">販売戦略</div>
  <div class="section-title" data-lang="en">Sales Strategy</div>
  <h2 data-lang="ja">日本展開ロードマップ</h2>
  <h2 data-lang="en">Japan Launch Roadmap</h2>
  <p class="text-block" data-lang="ja">${esc(reportData.salesStrategy)}</p>
  <p class="text-block" data-lang="en">${esc(reportData.salesStrategyEn)}</p>
  <div class="channels">
    <span class="channel-tag">Makuake</span>
    <span class="channel-tag">CAMPFIRE</span>
    <span class="channel-tag">GREEN FUNDING</span>
    <span class="channel-tag">Amazon Japan</span>
    <span class="channel-tag">ヤマダ電機</span>
    <span class="channel-tag">TV Shopping</span>
  </div>
</div>

<!-- Competitive edge -->
<div class="section section-dark">
  <div class="section-title" data-lang="ja">独占パートナーシップ</div>
  <div class="section-title" data-lang="en">Exclusive Partnership</div>
  <h2 data-lang="ja">先行者優位の確立</h2>
  <h2 data-lang="en">First-Mover Advantage</h2>
  <p class="text-block" data-lang="ja">${esc(reportData.competitiveEdge)}</p>
  <p class="text-block" data-lang="en">${esc(reportData.competitiveEdgeEn)}</p>
</div>

<!-- About -->
<div class="section">
  <div class="section-title" data-lang="ja">弊社について</div>
  <div class="section-title" data-lang="en">About Us</div>
  <h2 data-lang="ja">Blink Japan Co., Ltd.</h2>
  <h2 data-lang="en">Blink Japan Co., Ltd.</h2>
  <div class="about-grid">
    <div>
      <div class="about-label" data-lang="ja">専門領域</div>
      <div class="about-label" data-lang="en">Expertise</div>
      <p class="text-block" data-lang="ja">海外クラウドファンディング製品の日本市場への独占販売契約締結・販売展開。Makuake・CAMPFIRE・GREEN FUNDINGとの直接パートナーシップ、テレビショッピングネットワーク、タレントコラボキャンペーンを通じて多数の海外製品を日本市場に導入。</p>
      <p class="text-block" data-lang="en">Exclusive Japan distribution for overseas crowdfunding products. Direct partnerships with Makuake, CAMPFIRE & GREEN FUNDING, TV shopping networks, and talent collaborations.</p>
    </div>
    <div>
      <div class="about-label">Contact</div>
      <p class="about-value" style="margin-bottom:8px"><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
      <p class="about-value" style="margin-bottom:8px"><a href="${COMPANY_URL}" target="_blank">${COMPANY_URL}</a></p>
      <p class="about-value"><a href="${esc(productUrl)}" target="_blank" style="font-size:12px;color:#94a3b8;">${esc(productUrl)}</a></p>
      <p class="about-value" style="margin-top:12px;font-size:12px;color:#94a3b8;">${today}</p>
    </div>
  </div>
</div>

<div class="footer">
  <p>© ${new Date().getFullYear()} ${esc(COMPANY)} · <a href="${COMPANY_URL}">${COMPANY_URL}</a> · Confidential</p>
</div>

<script>
function setLang(lang) {
  document.querySelectorAll('[data-lang]').forEach(function(el) {
    el.style.display = el.getAttribute('data-lang') === lang ? '' : 'none';
  });
  document.getElementById('btn-ja').className = 'lang-btn' + (lang === 'ja' ? ' active' : '');
  document.getElementById('btn-en').className = 'lang-btn' + (lang === 'en' ? ' active' : '');
  document.documentElement.lang = lang;
}
// Init: show Japanese
setLang('ja');
</script>
</body>
</html>`;
}

export function buildMarketReportText(input: MarketReportInput): string {
  const { productTitle, productUrl, raisedUsd, backers, platform, reportData } = input;
  const achievement = `$${raisedUsd.toLocaleString("en-US")}（支援者${backers.toLocaleString()}人）`;
  const platformLabel = platform === "kickstarter" ? "Kickstarter" : platform === "indiegogo" ? "Indiegogo" : platform;

  return `【Japan Market Proposal】
${productTitle}
${platformLabel} Raised: ${achievement}

━━━━━━━━━━━━━━━━━━━━━━━
▍日本で売れる理由 / Why It Sells in Japan
${reportData.whySellsInJapan}

▍日本市場概況 / Market Overview
${reportData.marketOverview}

▍ターゲット層 / Target Audience
${reportData.targetAudience}

▍販売戦略 / Sales Strategy
${reportData.salesStrategy}
Channels: Makuake / CAMPFIRE / GREEN FUNDING / Amazon Japan / TV Shopping

▍独占販売 / Exclusive Partnership
${reportData.competitiveEdge}

━━━━━━━━━━━━━━━━━━━━━━━
${COMPANY}
${CONTACT_EMAIL}
${COMPANY_URL}
${productUrl}`;
}

function esc(value: string): string {
  return (value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
