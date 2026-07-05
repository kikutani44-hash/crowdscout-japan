import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildMarketReportHtml, buildMarketReportText } from "@/lib/market-report";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { findLocalProject } from "@/lib/project-store";
import type { JapanMarketReportData } from "@/lib/claude";

export const maxDuration = 60;

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
  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId が必要です" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let project: any = await findLocalProject(projectId);
    if (isSupabaseConfigured()) {
      const supabase = createServerSupabase();
      const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (data) project = data;
    }
    if (!project) {
      return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      // Use fallback without API
      const { generateJapanMarketReport } = await import("@/lib/claude");
      const reportData = await generateJapanMarketReport(
        project.title_ja ?? project.title,
        project.subtitle_ja ?? project.subtitle ?? "",
        project.category ?? "",
        project.raised_usd,
        project.backers,
        project.platform,
      );
      const html = buildMarketReportHtml({
        productTitle: project.title_ja ?? project.title,
        productUrl: project.original_url,
        raisedUsd: project.raised_usd,
        backers: project.backers,
        platform: project.platform,
        imageUrl: project.image_url ?? null,
        reportData,
      });
      const text = buildMarketReportText({
        productTitle: project.title_ja ?? project.title,
        productUrl: project.original_url,
        raisedUsd: project.raised_usd,
        backers: project.backers,
        platform: project.platform,
        imageUrl: project.image_url ?? null,
        reportData,
      });
      return NextResponse.json({ reportData, html, text });
    }

    // Stream from Anthropic to keep connection alive and avoid Netlify timeout
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

    const encoder = new TextEncoder();
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
              // Send progress heartbeat every ~200 chars to keep connection alive
              if (fullText.length % 200 < 10) {
                controller.enqueue(encoder.encode(" "));
              }
            }
          }

          const jsonMatch = fullText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("レポート生成結果の解析に失敗しました");
          const reportData = JSON.parse(jsonMatch[0]) as JapanMarketReportData;

          const html = buildMarketReportHtml({ ...projectSnapshot, reportData });
          const text = buildMarketReportText({ ...projectSnapshot, reportData });

          const payload = JSON.stringify({ reportData, html, text });
          controller.enqueue(encoder.encode(`\n__RESULT__${payload}__END__`));
          controller.close();
        } catch (err) {
          const { parseAnthropicError } = await import("@/lib/api-error");
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
  } catch (error) {
    const { parseAnthropicError } = await import("@/lib/api-error");
    return NextResponse.json({ error: parseAnthropicError(error) }, { status: 500 });
  }
}
