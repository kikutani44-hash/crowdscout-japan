import { NextRequest, NextResponse } from "next/server";
import { generateKickstarterMessage, translateOfferLetterToJapanese } from "@/lib/claude";
import { getAiCache, setAiCache, type AiCacheKey } from "@/lib/ai-cache";
import type { Project } from "@/lib/types";

export const maxDuration = 60;

type KsMessagePayload = { text: string; charCount: number; text_ja: string };

export async function POST(req: NextRequest) {
  const { project, regenerate = false } = await req.json() as {
    project: Project;
    regenerate?: boolean;
  };

  if (!project) {
    return NextResponse.json({ error: "project required" }, { status: 400 });
  }

  // 生成済みなら再生成せずキャッシュを返す（Anthropicクレジット節約）
  const cacheKey: AiCacheKey = { kind: "ks_message", projectId: project.id };
  if (!regenerate) {
    const cached = await getAiCache<KsMessagePayload>(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, ...cached, cached: true });
    }
  }

  try {
    const result = await generateKickstarterMessage({
      productTitle: project.title,
      productSubtitle: project.subtitle,
      category: project.category,
      raisedUsd: project.raised_usd,
      platform: project.platform,
      daysRemaining: project.days_remaining,
      status: project.status,
    });

    const text_ja = await translateOfferLetterToJapanese(result.text);

    await setAiCache<KsMessagePayload>(cacheKey, { ...result, text_ja });

    return NextResponse.json({ success: true, ...result, text_ja, cached: false });
  } catch (err) {
    const { parseAnthropicError } = await import("@/lib/api-error");
    return NextResponse.json({ error: parseAnthropicError(err) }, { status: 500 });
  }
}
