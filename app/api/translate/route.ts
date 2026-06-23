import { NextResponse } from "next/server";
import { translateToJapanese } from "@/lib/claude";
import {
  findProjectByClientId,
  withClientProjectId,
} from "@/lib/project-id";
import { needsJapaneseTranslation } from "@/lib/project-translation";
import { updateLocalProject } from "@/lib/project-store";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { projectId, title, subtitle, force } = await request.json();

    if (isSupabaseConfigured() && projectId && !force) {
      const supabase = createServerSupabase();
      const existing = await findProjectByClientId(supabase, projectId);
      if (existing && !needsJapaneseTranslation(existing)) {
        return NextResponse.json({
          project: withClientProjectId(existing, projectId),
        });
      }
    }

    const translation = await translateToJapanese(title, subtitle ?? "");

    const updates = {
      title_ja: translation.title_ja,
      subtitle_ja: translation.subtitle_ja,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && projectId) {
      const supabase = createServerSupabase();
      const existing = await findProjectByClientId(supabase, projectId);
      if (!existing) {
        return NextResponse.json(
          { error: "案件が見つかりません" },
          { status: 404 }
        );
      }
      const { data, error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({
        project: withClientProjectId(data, projectId),
      });
    }

    if (projectId) {
      const updated = await updateLocalProject(projectId, updates);
      if (updated) {
        return NextResponse.json({ project: updated });
      }
    }

    return NextResponse.json(
      { error: "案件が見つかりません" },
      { status: 404 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "翻訳に失敗しました" },
      { status: 500 }
    );
  }
}
