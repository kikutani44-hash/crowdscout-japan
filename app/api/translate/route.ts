import { NextResponse } from "next/server";
import { translateToJapanese } from "@/lib/claude";
import { findLocalProject, updateLocalProject } from "@/lib/project-store";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { sampleProjects } from "@/lib/sample-data";

export async function POST(request: Request) {
  try {
    const { projectId, title, subtitle } = await request.json();
    const translation = await translateToJapanese(title, subtitle ?? "");

    const updates = {
      title_ja: translation.title_ja,
      subtitle_ja: translation.subtitle_ja,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && projectId) {
      const supabase = createServerSupabase();
      const { data, error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", projectId)
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ project: data });
    }

    if (projectId) {
      const updated = await updateLocalProject(projectId, updates);
      if (updated) {
        return NextResponse.json({ project: updated });
      }
    }

    const project = sampleProjects.find((p) => p.id === projectId);
    if (project) {
      Object.assign(project, updates);
    }

    return NextResponse.json({ project: updates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "翻訳に失敗しました" },
      { status: 500 }
    );
  }
}
