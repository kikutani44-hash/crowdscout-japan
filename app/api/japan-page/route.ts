import { NextRequest, NextResponse } from "next/server";
import { generateJapanPageContent } from "@/lib/claude";
import type { Project } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { project, platform } = await req.json() as {
    project: Project;
    platform: "makuake" | "campfire" | "greenfunding";
  };

  if (!project) {
    return NextResponse.json({ error: "project required" }, { status: 400 });
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

    return NextResponse.json({ success: true, content });
  } catch (err) {
    const { parseAnthropicError } = await import("@/lib/api-error");
    return NextResponse.json({ error: parseAnthropicError(err) }, { status: 500 });
  }
}
