import { NextResponse } from "next/server";
import { previewOfferLetter } from "@/lib/mailer";
import { findLocalProject } from "@/lib/project-store";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { projectId, customNote } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId が必要です" }, { status: 400 });
    }

    let project = await findLocalProject(projectId);

    if (isSupabaseConfigured()) {
      const supabase = createServerSupabase();
      const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (data) project = data;
    }

    if (!project) {
      return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
    }

    const letter = previewOfferLetter({
      productTitle: project.title_ja ?? project.title,
      productUrl: project.original_url,
      raisedUsd: project.raised_usd,
      backers: project.backers,
      category: project.category,
      customNote: customNote?.trim() || undefined,
    });

    return NextResponse.json({ letter });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "プレビュー生成に失敗しました" },
      { status: 500 }
    );
  }
}
