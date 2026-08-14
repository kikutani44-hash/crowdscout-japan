import { NextRequest, NextResponse } from "next/server";
import { generateJapanPageContent } from "@/lib/claude";
import { getAiCache, setAiCache, type AiCacheKey } from "@/lib/ai-cache";
import type { Project } from "@/lib/types";
import type { JapanPageContent } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const { project, platform, regenerate = false } = await req.json() as {
    project: Project;
    platform: "makuake" | "campfire" | "greenfunding";
    regenerate?: boolean;
  };

  if (!project) {
    return NextResponse.json({ error: "project required" }, { status: 400 });
  }

  // 同じ案件・同じCFプラットフォームなら再生成しない（Anthropicクレジット節約）
  const cacheKey: AiCacheKey = {
    kind: "japan_page",
    projectId: project.id,
    variant: platform ?? "makuake",
  };
  if (!regenerate) {
    const cached = await getAiCache<JapanPageContent>(cacheKey);
    if (cached) return NextResponse.json({ success: true, content: cached, cached: true });
  }

  try {
    const content = await generateJapanPageContent({
      productTitle: project.title,
      productSubtitle: project.subtitle,
      category: project.category,
      raisedUsd: project.raised_usd,
      backers: project.backers,
      platform: platform ?? "makuake",
    });

    await setAiCache(cacheKey, content);

    return NextResponse.json({ success: true, content, cached: false });
  } catch (err) {
    const { parseAnthropicError } = await import("@/lib/api-error");
    return NextResponse.json({ error: parseAnthropicError(err) }, { status: 500 });
  }
}
