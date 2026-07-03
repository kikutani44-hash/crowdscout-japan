import { NextRequest, NextResponse } from "next/server";
import { generateSnsDm } from "@/lib/claude";
import { detectLanguage } from "@/lib/language-detect";
import type { Project } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { project, platform } = await req.json() as {
    project: Project;
    platform: "instagram" | "twitter" | "facebook";
  };

  if (!project || !platform) {
    return NextResponse.json({ error: "project and platform required" }, { status: 400 });
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

    return NextResponse.json({ success: true, ...result, langInfo });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
