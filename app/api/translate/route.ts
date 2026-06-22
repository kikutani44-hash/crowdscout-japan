import { NextResponse } from "next/server";
import { translateToJapanese } from "@/lib/claude";
import { sampleProjects } from "@/lib/sample-data";

export async function POST(request: Request) {
  try {
    const { projectId, title, subtitle } = await request.json();
    const translation = await translateToJapanese(title, subtitle ?? "");

    const project = sampleProjects.find((p) => p.id === projectId);
    if (project) {
      project.title_ja = translation.title_ja;
      project.subtitle_ja = translation.subtitle_ja;
      project.updated_at = new Date().toISOString();
    }

    return NextResponse.json({
      project: {
        title_ja: translation.title_ja,
        subtitle_ja: translation.subtitle_ja,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "翻訳に失敗しました" },
      { status: 500 }
    );
  }
}
