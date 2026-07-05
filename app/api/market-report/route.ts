import Anthropic from "@anthropic-ai/sdk";
import { buildMarketReportHtml, buildMarketReportText } from "@/lib/market-report";
import { parseAnthropicError } from "@/lib/api-error";
import { createClient } from "@supabase/supabase-js";
import type { JapanMarketReportData } from "@/lib/claude";

// Edge Runtime: no hard timeout, streaming keeps connection alive
export const runtime = "edge";

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

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  function errorResponse(msg: string): Response {
    const payload = JSON.stringify({ error: msg });
    return new Response(`\n__ERROR__${payload}__END__`, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  let projectId: string;
  try {
    const body = await request.json() as { projectId?: string };
    projectId = body.projectId ?? "";
  } catch {
    return errorResponse("リクエストの解析に失敗しました");
  }

  if (!projectId) {
    return errorResponse("projectId が必要です");
  }

  // Fetch project from Supabase (Edge-compatible)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseKey) {
    return errorResponse("データベース設定が見つかりません");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: project, error: dbError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (dbError || !project) {
    return errorResponse("案件が見つかりません");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (!apiKey) {
    return errorResponse("ANTHROPIC_API_KEY が設定されていません");
  }

  const prompt = buildPrompt(
    project.title_ja ?? project.title,
    project.subtitle_ja ?? project.subtitle ?? "",
    project.category ?? "",
    project.raised_usd,
    project.backers,
    project.platform,
  );

  const projectSnapshot = {
    productTitle: project.title_ja ?? project.title,
    productUrl: project.original_url,
    raisedUsd: project.raised_usd,
    backers: project.backers,
    platform: project.platform,
    imageUrl: project.image_url ?? null,
  };

  const client = new Anthropic({ apiKey });

  const readable = new ReadableStream({
    async start(controller) {
      let fullText = "";
      try {
        const stream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 3000,
          messages: [{ role: "user", content: prompt }],
        });

        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            fullText += chunk.delta.text;
            // Send raw token chunks to keep the stream alive
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }

        const jsonMatch = fullText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("JSON parse failed: no object found");

        const reportData = JSON.parse(jsonMatch[0]) as JapanMarketReportData;
        const html = buildMarketReportHtml({ ...projectSnapshot, reportData });
        const text = buildMarketReportText({ ...projectSnapshot, reportData });

        const payload = JSON.stringify({ reportData, html, text });
        controller.enqueue(encoder.encode(`\n__RESULT__${payload}__END__`));
        controller.close();
      } catch (err) {
        const errPayload = JSON.stringify({ error: parseAnthropicError(err) });
        controller.enqueue(encoder.encode(`\n__ERROR__${errPayload}__END__`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
