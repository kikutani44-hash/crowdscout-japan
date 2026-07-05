// Netlify Background Function — runs up to 15 minutes
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

export const handler = async (event: { body: string | null }) => {
  let projectId = "";
  try {
    const body = JSON.parse(event.body ?? "{}") as { projectId?: string };
    projectId = body.projectId ?? "test-ping";
  } catch {
    projectId = "test-ping";
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
  );

  // Always write — even for GET requests with no body (to confirm function runs)
  await supabase.from("reports").upsert({
    project_id: projectId,
    status: "generating",
    error: "started:" + new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

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

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    });

    const productTitle = project.title_ja ?? project.title;
    const prompt = `You are a senior Japan market consultant. Write a compelling bilingual market proposal JSON for this product:
- Title: ${productTitle}
- Description: ${project.subtitle_ja ?? project.subtitle ?? "N/A"}
- Category: ${project.category ?? "Consumer"}
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
  "marketSizeJpy": "estimated market size in 億円",
  "growthRate": "e.g. '12.3%'"
}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON not found in response");

    const reportData = JSON.parse(jsonMatch[0]);

    // Build HTML inline (simplified premium template)
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
    await supabase.from("reports").upsert({
      project_id: projectId,
      status: "error",
      error: msg,
      updated_at: new Date().toISOString(),
    });
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildHtml(productTitle: string, project: any, r: any): string {
  const raised = `$${Number(project.raised_usd).toLocaleString("en-US")}`;
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric",
  });
  const whyJa = String(r.whySellsInJapan ?? "").split("\n").filter(Boolean);
  const whyEn = String(r.whySellsInJapanEn ?? "").split("\n").filter(Boolean);

  const imgHtml = project.image_url
    ? `<img src="${project.image_url}" alt="${productTitle}" style="max-width:320px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);">`
    : "";

  const whyCards = whyJa.slice(0, 4).map((item: string, i: number) => `
    <div class="why-card">
      <div class="why-num">0${i + 1}</div>
      <p class="why-ja">${item.replace(/^[・\-•]\s*/, "")}</p>
      <p class="why-en">${(whyEn[i] ?? "").replace(/^[•\-・]\s*/, "")}</p>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${productTitle} — 日本市場展開提案書</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN',sans-serif;background:#0a0f1e;color:#fff}
.hero{background:linear-gradient(135deg,#0a0f1e 0%,#1a1040 50%,#0d1f3c 100%);min-height:90vh;display:flex;flex-direction:column;justify-content:center;padding:80px 40px;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 70% 50%,rgba(99,102,241,0.15) 0%,transparent 70%)}
.hero-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:60px;flex-wrap:wrap}
.hero-text{flex:1;min-width:300px}
.hero-badge{display:inline-block;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);color:#a5b4fc;padding:6px 16px;border-radius:20px;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:24px}
.hero-title{font-size:clamp(28px,4vw,52px);font-weight:800;line-height:1.2;margin-bottom:16px;background:linear-gradient(135deg,#fff 0%,#a5b4fc 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero-subtitle{font-size:clamp(16px,2vw,22px);color:#94a3b8;margin-bottom:32px}
.stats{display:flex;gap:32px;flex-wrap:wrap}
.stat{text-align:center}
.stat-val{font-size:28px;font-weight:800;color:#818cf8}
.stat-lbl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px}
.hero-image{flex:0 0 auto}
section{padding:80px 40px;max-width:1200px;margin:0 auto}
.section-label{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#6366f1;margin-bottom:12px}
.section-title{font-size:clamp(22px,3vw,36px);font-weight:700;margin-bottom:40px;color:#f1f5f9}
.why-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}
.why-card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;transition:.2s}
.why-card:hover{border-color:rgba(99,102,241,0.4);transform:translateY(-2px)}
.why-num{font-size:36px;font-weight:900;color:rgba(99,102,241,0.3);margin-bottom:12px}
.why-ja{font-size:14px;line-height:1.7;color:#e2e8f0;margin-bottom:8px}
.why-en{font-size:12px;line-height:1.6;color:#64748b}
.text-block{background:rgba(255,255,255,0.04);border-left:3px solid #6366f1;padding:24px 32px;border-radius:0 12px 12px 0;margin-bottom:24px}
.text-ja{font-size:15px;line-height:1.9;color:#e2e8f0;margin-bottom:16px}
.text-en{font-size:13px;line-height:1.8;color:#64748b}
.lang-toggle{position:fixed;top:70px;right:24px;z-index:999;display:flex;gap:8px}
.lang-btn{padding:6px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(15,23,42,0.8);color:#94a3b8;cursor:pointer;font-size:12px;backdrop-filter:blur(8px)}
.lang-btn.active{background:#6366f1;color:#fff;border-color:#6366f1}
.footer{background:#060a14;padding:40px;text-align:center;color:#475569;font-size:13px;border-top:1px solid rgba(255,255,255,0.06)}
.en-content{display:none}
</style>
</head>
<body>
<div class="lang-toggle">
  <button class="lang-btn active" onclick="setLang('ja')">日本語</button>
  <button class="lang-btn" onclick="setLang('en')">English</button>
</div>
<div class="hero">
  <div class="hero-inner">
    <div class="hero-text">
      <div class="hero-badge">Japan Market Proposal · ${today}</div>
      <h1 class="hero-title ja-content">${r.headlineJa ?? productTitle}</h1>
      <h1 class="hero-title en-content" style="display:none">${r.headlineEn ?? productTitle}</h1>
      <p class="hero-subtitle">${productTitle}</p>
      <div class="stats">
        <div class="stat"><div class="stat-val">${raised}</div><div class="stat-lbl">Raised</div></div>
        <div class="stat"><div class="stat-val">${Number(project.backers).toLocaleString()}</div><div class="stat-lbl">Backers</div></div>
        <div class="stat"><div class="stat-val">${r.marketSizeJpy ?? "—"}</div><div class="stat-lbl">JP Market</div></div>
        <div class="stat"><div class="stat-val">${r.growthRate ?? "—"}</div><div class="stat-lbl">Growth</div></div>
      </div>
    </div>
    ${imgHtml ? `<div class="hero-image">${imgHtml}</div>` : ""}
  </div>
</div>

<div style="background:#0d1117;padding:80px 40px">
<div style="max-width:1200px;margin:0 auto">
  <div class="section-label">Why Japan</div>
  <h2 class="section-title ja-content">日本で売れる理由</h2>
  <h2 class="section-title en-content" style="display:none">Why It Sells in Japan</h2>
  <div class="why-grid">${whyCards}</div>
</div>
</div>

<section>
  <div class="section-label">Market Overview</div>
  <h2 class="section-title ja-content">市場概況</h2>
  <h2 class="section-title en-content" style="display:none">Market Overview</h2>
  <div class="text-block">
    <p class="text-ja ja-content">${r.marketOverview ?? ""}</p>
    <p class="text-ja en-content" style="display:none">${r.marketOverviewEn ?? ""}</p>
  </div>
</section>

<section style="background:#0d1117;max-width:100%;padding:80px 40px">
<div style="max-width:1200px;margin:0 auto">
  <div class="section-label">Target Audience</div>
  <h2 class="section-title ja-content">ターゲット層</h2>
  <h2 class="section-title en-content" style="display:none">Target Audience</h2>
  <div class="text-block">
    <p class="text-ja ja-content">${r.targetAudience ?? ""}</p>
    <p class="text-ja en-content" style="display:none">${r.targetAudienceEn ?? ""}</p>
  </div>
</div>
</section>

<section>
  <div class="section-label">Sales Strategy</div>
  <h2 class="section-title ja-content">販売戦略</h2>
  <h2 class="section-title en-content" style="display:none">Sales Strategy</h2>
  <div class="text-block">
    <p class="text-ja ja-content">${r.salesStrategy ?? ""}</p>
    <p class="text-ja en-content" style="display:none">${r.salesStrategyEn ?? ""}</p>
  </div>
</section>

<section style="background:#0d1117;max-width:100%;padding:80px 40px">
<div style="max-width:1200px;margin:0 auto">
  <div class="section-label">Partnership Value</div>
  <h2 class="section-title ja-content">Blink Japanと組む理由</h2>
  <h2 class="section-title en-content" style="display:none">Why Partner with Blink Japan</h2>
  <div class="text-block">
    <p class="text-ja ja-content">${r.competitiveEdge ?? ""}</p>
    <p class="text-ja en-content" style="display:none">${r.competitiveEdgeEn ?? ""}</p>
  </div>
</div>
</section>

<div class="footer">
  <p>Blink Japan Co., Ltd. · cbec@blink-japan.com · blink-japan.com</p>
  <p style="margin-top:8px;font-size:11px">Confidential — prepared exclusively for ${productTitle}</p>
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
