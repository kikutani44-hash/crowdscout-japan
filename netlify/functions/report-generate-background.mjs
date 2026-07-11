// Netlify Background Function — runs up to 15 minutes
// Node.js 20 requires "ws" package for Supabase WebSocket transport
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import Anthropic from "@anthropic-ai/sdk";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    { realtime: { transport: ws } }
  );
}

export const handler = async (event) => {
  let projectId = "";
  try {
    const body = JSON.parse(event.body || "{}");
    projectId = body.projectId || "test-ping";
  } catch (_) {
    projectId = "test-ping";
  }

  const supabase = getSupabase();

  // Always write — even for test-ping (to confirm function runs)
  const { error: upsertErr } = await supabase.from("reports").upsert({
    project_id: projectId,
    status: "generating",
    error: "started:" + new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (upsertErr) {
    console.error("Supabase upsert error:", JSON.stringify(upsertErr));
  } else {
    console.log("SUPABASE_WRITE_OK for:", projectId);
  }

  if (!projectId || projectId === "test-ping") return;

  try {
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (!project) {
      await supabase.from("reports").upsert({
        project_id: projectId,
        status: "error",
        error: "案件が見つかりません",
        updated_at: new Date().toISOString(),
      });
      return;
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

    const productTitle = project.title_ja || project.title;
    const prompt = `You are a senior Japan market consultant. Write a compelling bilingual market proposal JSON for this product:
- Title: ${productTitle}
- Description: ${project.subtitle_ja || project.subtitle || "N/A"}
- Category: ${project.category || "Consumer"}
- Platform: ${project.platform}
- Raised: $${Number(project.raised_usd).toLocaleString("en-US")} from ${Number(project.backers).toLocaleString()} backers

Return ONLY valid JSON:
{
  "headlineJa": "compelling Japanese headline",
  "headlineEn": "same in English",
  "whySellsInJapan": "5 bullet points in Japanese starting with ・ explaining why this sells in Japan",
  "whySellsInJapanEn": "same 5 bullets in English starting with •",
  "marketOverview": "3 sentences in Japanese about Japan market size and opportunity",
  "marketOverviewEn": "same in English",
  "targetAudience": "3 sentences in Japanese about primary target segments",
  "targetAudienceEn": "same in English",
  "salesStrategy": "4 sentences in Japanese: crowdfunding phase then retail expansion",
  "salesStrategyEn": "same in English",
  "competitiveEdge": "3 sentences in Japanese about partnership value and first-mover advantage",
  "competitiveEdgeEn": "same in English",
  "marketSizeJpy": "short number only, e.g. '約1,200億円' — max 8 chars, NO explanation",
  "growthRate": "short number only, e.g. '12.3%' — max 6 chars, NO explanation"
}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON not found in response");

    const reportData = JSON.parse(jsonMatch[0]);
    const html = buildHtml(productTitle, project, reportData);

    await supabase.from("reports").upsert({
      project_id: projectId,
      status: "ready",
      html,
      error: null,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Report generation error:", msg);
    await supabase.from("reports").upsert({
      project_id: projectId,
      status: "error",
      error: msg,
      updated_at: new Date().toISOString(),
    });
  }
};

function buildHtml(productTitle, project, r) {
  const raised = `$${Number(project.raised_usd).toLocaleString("en-US")}`;
  const raisedJpy = `¥${Math.round(Number(project.raised_usd) * 155).toLocaleString("ja-JP")}`;
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric",
  });
  const whyJa = String(r.whySellsInJapan || "").split("\n").filter(Boolean);
  const whyEn = String(r.whySellsInJapanEn || "").split("\n").filter(Boolean);

  const imgHtml = project.image_url
    ? `<img src="${project.image_url}" alt="${productTitle}" style="width:100%;max-width:380px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);">`
    : "";

  const whyCards = whyJa.slice(0, 5).map((item, i) => `
    <div class="why-card">
      <div class="why-num">${String(i + 1).padStart(2, "0")}</div>
      <p class="why-ja">${item.replace(/^[・\-•]\s*/, "")}</p>
      <p class="why-en">${(whyEn[i] || "").replace(/^[•\-・]\s*/, "")}</p>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${productTitle} — 日本市場展開提案書</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN','Hiragino Sans',sans-serif;background:#f7f8fa;color:#1a202c;line-height:1.7}
a{color:inherit;text-decoration:none}

/* HEADER BAR */
.topbar{background:#fff;border-bottom:1px solid #e8ecf0;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;gap:12px;flex-wrap:wrap}
.topbar-left{display:flex;align-items:center;gap:16px}
.back-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#4a5568;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
.back-btn:hover{background:#f7fafc;border-color:#cbd5e0}
.topbar-title{font-size:13px;font-weight:600;color:#718096}
.topbar-right{display:flex;align-items:center;gap:8px}
.lang-btn{padding:6px 14px;border-radius:6px;border:1px solid #e2e8f0;background:#fff;color:#718096;cursor:pointer;font-size:12px;font-weight:600}
.lang-btn.active{background:#1a56db;color:#fff;border-color:#1a56db}
.pdf-btn{padding:7px 16px;border-radius:8px;border:none;background:#1a56db;color:#fff;font-size:13px;font-weight:700;cursor:pointer}
.pdf-btn:hover{background:#1e429f}

/* HERO */
.hero{background:#fff;border-bottom:1px solid #e8ecf0;padding:48px 24px}
.hero-inner{max-width:960px;margin:0 auto;display:flex;gap:40px;align-items:flex-start;flex-wrap:wrap}
.hero-text{flex:1;min-width:280px}
.hero-badge{display:inline-block;background:#ebf5ff;color:#1a56db;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px}
.hero-title{font-size:clamp(22px,3.5vw,36px);font-weight:800;line-height:1.25;color:#1a202c;margin-bottom:10px}
.hero-product{font-size:14px;color:#718096;margin-bottom:24px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:4px}
.stat{background:#f7f8fa;border:1px solid #e8ecf0;border-radius:10px;padding:12px 16px;text-align:center;min-width:0}
.stat-val{font-size:16px;font-weight:800;color:#1a56db;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stat-lbl{font-size:10px;color:#a0aec0;text-transform:uppercase;letter-spacing:1px;margin-top:2px;white-space:nowrap}
.hero-image{flex:0 0 auto}

/* SECTIONS */
.section{padding:48px 24px;max-width:960px;margin:0 auto}
.section-label{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#1a56db;font-weight:700;margin-bottom:8px}
.section-title{font-size:clamp(18px,2.5vw,26px);font-weight:800;color:#1a202c;margin-bottom:28px}
.divider{border:none;border-top:1px solid #e8ecf0;margin:0}

/* WHY CARDS */
.why-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.why-card{background:#fff;border:1px solid #e8ecf0;border-radius:12px;padding:24px;transition:.15s}
.why-card:hover{border-color:#1a56db;box-shadow:0 4px 16px rgba(26,86,219,0.08)}
.why-num{font-size:28px;font-weight:900;color:#ebf5ff;margin-bottom:10px;line-height:1}
.why-ja{font-size:14px;line-height:1.75;color:#2d3748;margin-bottom:6px}
.why-en{font-size:12px;line-height:1.6;color:#a0aec0}

/* TEXT BLOCKS */
.text-block{background:#fff;border:1px solid #e8ecf0;border-left:4px solid #1a56db;border-radius:0 12px 12px 0;padding:24px 28px;margin-bottom:16px}
.text-ja{font-size:15px;line-height:1.9;color:#2d3748;margin-bottom:10px}
.text-en{font-size:13px;line-height:1.8;color:#a0aec0}

/* PARTNER CARDS */
.partner-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:28px}
.partner-card{background:#fff;border:1px solid #e8ecf0;border-radius:12px;padding:28px}
.partner-icon{font-size:28px;margin-bottom:14px}
.partner-title-ja{font-size:15px;font-weight:700;color:#1a56db;margin-bottom:8px}
.partner-body-ja{font-size:13px;line-height:1.8;color:#4a5568}
.partner-title-en{font-size:15px;font-weight:700;color:#1a56db;margin-bottom:8px}
.partner-body-en{font-size:13px;line-height:1.8;color:#4a5568}

/* GREY BAND */
.band{background:#f0f4f8;padding:48px 24px}
.band-inner{max-width:960px;margin:0 auto}

/* FOOTER */
.footer{background:#1a202c;padding:32px 24px;text-align:center;color:#718096;font-size:12px}
.footer p+p{margin-top:6px}

.en-content{display:none}

@media(max-width:600px){
  .hero-inner{flex-direction:column}
  .stats{flex-direction:column}
  .stat{border-right:none;border-bottom:1px solid #e8ecf0}
  .stat:last-child{border-bottom:none}
  .topbar-title{display:none}
}
@media print{
  .topbar{display:none}
  body{background:#fff}
}
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-left">
    <button class="back-btn" onclick="history.back()">← 戻る</button>
    <span class="topbar-title">日本市場展開提案書</span>
  </div>
  <div class="topbar-right">
    <button class="lang-btn active" onclick="setLang('ja')">日本語</button>
    <button class="lang-btn" onclick="setLang('en')">English</button>
    <button class="pdf-btn" onclick="window.print()">PDF保存</button>
  </div>
</div>

<div class="hero">
  <div class="hero-inner">
    <div class="hero-text">
      <div class="hero-badge">Japan Market Proposal · ${today}</div>
      <h1 class="hero-title ja-content">${r.headlineJa || productTitle}</h1>
      <h1 class="hero-title en-content" style="display:none">${r.headlineEn || productTitle}</h1>
      <p class="hero-product">${productTitle}</p>
      <div class="stats">
        <div class="stat"><div class="stat-val">${raised}</div><div class="stat-lbl">Raised</div></div>
        <div class="stat"><div class="stat-val">${raisedJpy}</div><div class="stat-lbl">日本円換算</div></div>
        <div class="stat"><div class="stat-val">${Number(project.backers).toLocaleString()}</div><div class="stat-lbl">支援者数</div></div>
        <div class="stat"><div class="stat-val">${r.marketSizeJpy || "—"}</div><div class="stat-lbl">JP市場規模</div></div>
        <div class="stat"><div class="stat-val">${r.growthRate || "—"}</div><div class="stat-lbl">成長率</div></div>
      </div>
    </div>
    ${imgHtml ? `<div class="hero-image">${imgHtml}</div>` : ""}
  </div>
</div>

<hr class="divider">

<div class="band">
  <div class="band-inner">
    <div class="section-label">Why Japan</div>
    <h2 class="section-title ja-content">日本で売れる理由</h2>
    <h2 class="section-title en-content" style="display:none">Why It Sells in Japan</h2>
    <div class="why-grid">${whyCards}</div>
  </div>
</div>

<hr class="divider">

<div class="section">
  <div class="section-label">Market Overview</div>
  <h2 class="section-title ja-content">市場概況</h2>
  <h2 class="section-title en-content" style="display:none">Market Overview</h2>
  <div class="text-block">
    <p class="text-ja ja-content">${r.marketOverview || ""}</p>
    <p class="text-ja en-content" style="display:none">${r.marketOverviewEn || ""}</p>
  </div>
</div>

<hr class="divider">

<div class="band">
  <div class="band-inner">
    <div class="section-label">Target Audience</div>
    <h2 class="section-title ja-content">ターゲット層</h2>
    <h2 class="section-title en-content" style="display:none">Target Audience</h2>
    <div class="text-block">
      <p class="text-ja ja-content">${r.targetAudience || ""}</p>
      <p class="text-ja en-content" style="display:none">${r.targetAudienceEn || ""}</p>
    </div>
  </div>
</div>

<hr class="divider">

<div class="section">
  <div class="section-label">Sales Strategy</div>
  <h2 class="section-title ja-content">販売戦略</h2>
  <h2 class="section-title en-content" style="display:none">Sales Strategy</h2>
  <div class="text-block">
    <p class="text-ja ja-content">${r.salesStrategy || ""}</p>
    <p class="text-ja en-content" style="display:none">${r.salesStrategyEn || ""}</p>
  </div>
</div>

<hr class="divider">

<div class="band">
  <div class="band-inner">
    <div class="section-label">Partnership Value</div>
    <h2 class="section-title ja-content">Blink Japanと組む理由</h2>
    <h2 class="section-title en-content" style="display:none">Why Partner with Blink Japan</h2>
    <div class="text-block">
      <p class="text-ja ja-content">${r.competitiveEdge || ""}</p>
      <p class="text-ja en-content" style="display:none">${r.competitiveEdgeEn || ""}</p>
    </div>
    <div class="partner-grid">
      <div class="partner-card">
        <div class="partner-icon">📺</div>
        <div class="ja-content">
          <p class="partner-title-ja">TV・メディアネットワーク</p>
          <p class="partner-body-ja">日本のテレビ業界に40年以上の実績を持ち、テレビショッピングネットワーク、主要放送局、制作会社と直接の人脈を保有。メディア露出で商品認知を一気に拡大します。</p>
        </div>
        <div class="en-content" style="display:none">
          <p class="partner-title-en">TV & Media Network</p>
          <p class="partner-body-en">40+ years in the Japanese television industry with direct connections to home shopping networks, major broadcasters, and production companies.</p>
        </div>
      </div>
      <div class="partner-card">
        <div class="partner-icon">📊</div>
        <div class="ja-content">
          <p class="partner-title-ja">デジタルマーケティング</p>
          <p class="partner-body-ja">Yahoo! JapanおよびGoogle認定代理店として、累計120億円以上の広告運用実績を持ち、パフォーマンスマーケティングで最高水準の成果を継続的に提供しています。</p>
        </div>
        <div class="en-content" style="display:none">
          <p class="partner-title-en">Digital Marketing</p>
          <p class="partner-body-en">Certified agency for Yahoo! Japan and Google, having managed over ¥12 billion in advertising with consistently top-tier performance marketing results.</p>
        </div>
      </div>
      <div class="partner-card">
        <div class="partner-icon">🛍️</div>
        <div class="ja-content">
          <p class="partner-title-ja">マーケットアクセス</p>
          <p class="partner-body-ja">大手ECプラットフォームや、国内最大のクラウドファンディングサイト「Makuake」「CAMPFIRE」との強固なパートナーシップを保有しています。</p>
        </div>
        <div class="en-content" style="display:none">
          <p class="partner-title-en">Market Access</p>
          <p class="partner-body-en">Strong partnerships with leading e-commerce platforms and Japan's top crowdfunding platforms, Makuake and CAMPFIRE.</p>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="footer">
  <p>Blink Japan Co., Ltd. · cbec@blink-japan.com · blink-japan.com</p>
  <p>Confidential — prepared exclusively for ${productTitle} · ${today}</p>
</div>

<script>
function setLang(lang) {
  document.querySelectorAll('.ja-content').forEach(el => el.style.display = lang === 'ja' ? '' : 'none');
  document.querySelectorAll('.en-content').forEach(el => el.style.display = lang === 'en' ? '' : 'none');
  document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.textContent.trim() === (lang === 'ja' ? '日本語' : 'English')));
}
</script>
</body>
</html>`;
}
