import { NextRequest, NextResponse } from "next/server";
import { generateSnsDm } from "@/lib/claude";
import { detectLanguage } from "@/lib/language-detect";
import { getAiCache, setAiCache, type AiCacheKey } from "@/lib/ai-cache";
import type { Project } from "@/lib/types";

type SnsDmPayload = Record<string, unknown>;

export async function POST(req: NextRequest) {
  const { project, platform, regenerate = false } = await req.json() as {
    project: Project;
    platform: "instagram" | "twitter" | "facebook";
    regenerate?: boolean;
  };

  if (!project || !platform) {
    return NextResponse.json({ error: "project and platform required" }, { status: 400 });
  }

  // 同じ案件・同じSNSなら再生成しない（Anthropicクレジット節約）
  const cacheKey: AiCacheKey = { kind: "sns_dm", projectId: project.id, variant: platform };
  if (!regenerate) {
    const cached = await getAiCache<SnsDmPayload>(cacheKey);
    if (cached) return NextResponse.json({ success: true, ...cached, cached: true });
  }

  try {
    const langInfo = detectLanguage(project);

    const result = await generateSnsDm({
      productTitle: project.title,
      productSubtitle: project.subtitle,
      category: project.category,
      raisedUsd: project.raised_usd,
      platform,
      targetLang: langInfo.code,
    });

    await setAiCache(cacheKey, { ...result, langInfo });

    return NextResponse.json({ success: true, ...result, langInfo, cached: false });
  } catch (err) {
    const { parseAnthropicError } = await import("@/lib/api-error");
    return NextResponse.json({ error: parseAnthropicError(err) }, { status: 500 });
  }
}
