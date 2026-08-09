import { NextRequest, NextResponse } from "next/server";
import { generateKickstarterMessage, translateOfferLetterToJapanese } from "@/lib/claude";
import type { Project } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { project } = await req.json() as { project: Project };

  if (!project) {
    return NextResponse.json({ error: "project required" }, { status: 400 });
  }

  try {
    const result = await generateKickstarterMessage({
      productTitle: project.title,
      productSubtitle: project.subtitle,
      category: project.category,
      raisedUsd: project.raised_usd,
      platform: project.platform,
    });

    const text_ja = await translateOfferLetterToJapanese(result.text);

    return NextResponse.json({ success: true, ...result, text_ja });
  } catch (err) {
    const { parseAnthropicError } = await import("@/lib/api-error");
    return NextResponse.json({ error: parseAnthropicError(err) }, { status: 500 });
  }
}
