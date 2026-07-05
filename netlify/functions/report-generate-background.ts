import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { buildMarketReportHtml } from "../../lib/market-report";
import type { JapanMarketReportData } from "../../lib/claude";

function buildPrompt(
  productTitle: string,
  productSubtitle: string,
  category: string,
  raisedUsd: number,
  backers: number,
  platform: string,
): string {
  return `You are a senior Japan market consultant specializing in bringing overseas crowdfunding products to Japan. Write a compelling, detailed bilingual market proposal JSON. Be specific, use concrete data, and write persuasively to convince the maker to partner with Blink Japan.

Product:
- Title: ${productTitle}
- Description: ${productSubtitle || "N/A"}
- Category: ${category || "Consumer"}
- Platform: ${platform}
- Raised: $${raisedUsd.toLocaleString("en-US")} from ${backers.toLocaleString()} backers

Return ONLY valid JSON with these fields (write richly — each field should be substantive):
{
  "headlineJa": "compelling emotional Japanese headline (1 powerful sentence that creates urgency/excitement)",
  "headlineEn": "same in English",
  "whySellsInJapan": "5-6 bullet points in Japanese starting with ・, each with a specific reason tied to Japanese culture/market with 1-2 supporting sentences per point",
  "whySellsInJapanEn": "same 5-6 bullets in English starting with •",
  "marketOverview": "3-4 sentences in Japanese: include specific market size data, growth trends, relevant consumer behavior insights, and why NOW is the right timing",
  "marketOverviewEn": "same in English",
  "targetAudience": "3-4 sentences in Japanese: describe primary AND secondary Japanese target segments with demographics, psychographics, buying triggers, and media habits",
  "targetAudienceEn": "same in English",
  "salesStrategy": "4-5 sentences in Japanese: detailed roadmap — Phase 1 crowdfunding (Makuake/CAMPFIRE) with timeline and targets, Phase 2 retail expansion (Amazon Japan/specialty stores), Phase 3 mass market (TV shopping/major chains)",
  "salesStrategyEn": "same in English",
  "competitiveEdge": "3-4 sentences in Japanese: explain the exclusive partnership value, first-mover advantage, Blink Japan's network, and specific risk mitigation for the maker",
  "competitiveEdgeEn": "same in English",
  "marketSizeJpy": "estimated Japan market size in 億円 format (research-based estimate)",
  "growthRate": "estimated annual growth rate e.g. '12.3%'"
}`;
}

// Netlify Background Function (v1 format) — runs up to 15 minutes
export const handler = async (event: { body: string | null }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  let projectId = "";
  try {
    const body = JSON.parse(event.body ?? "{}") as { projectId?: string };
    projectId = body.projectId ?? "";
  } catch {
    return;
  }

  if (!projectId) return;

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

    const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
    if (!apiKey) {
      await supabase.from("reports").upsert({
        project_id: projectId,
        status: "error",
        error: "ANTHROPIC_API_KEY が設定されていません",
        updated_at: new Date().toISOString(),
      });
      return;
    }

    const client = new Anthropic({ apiKey });
    const prompt = buildPrompt(
      project.title_ja ?? project.title,
      project.subtitle_ja ?? project.subtitle ?? "",
      project.category ?? "",
      project.raised_usd,
      project.backers,
      project.platform,
    );

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON parse failed");

    const reportData = JSON.parse(jsonMatch[0]) as JapanMarketReportData;

    const html = buildMarketReportHtml({
      productTitle: project.title_ja ?? project.title,
      productUrl: project.original_url,
      raisedUsd: project.raised_usd,
      backers: project.backers,
      platform: project.platform,
      imageUrl: project.image_url ?? null,
      reportData,
    });

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
