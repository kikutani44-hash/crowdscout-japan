import { NextResponse } from "next/server";
import { translateToJapanese } from "@/lib/claude";
import { needsJapaneseTranslation } from "@/lib/project-translation";
import { findLocalProject, updateLocalProject } from "@/lib/project-store";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Project } from "@/lib/types";

const MAX_BATCH = 3;

async function loadProject(projectId: string): Promise<Project | null> {
  if (isSupabaseConfigured()) {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    if (error) throw error;
    return (data as Project | null) ?? null;
  }
  return findLocalProject(projectId);
}

async function saveTranslation(projectId: string, translation: { title_ja: string; subtitle_ja: string }) {
  const updates = {
    title_ja: translation.title_ja,
    subtitle_ja: translation.subtitle_ja,
    updated_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", projectId)
      .select("*")
      .single();
    if (error) throw error;
    return data as Project;
  }

  const updated = await updateLocalProject(projectId, updates);
  if (updated) return updated;
  throw new Error(`Project not found: ${projectId}`);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { projectIds?: string[] };
    const ids = (body.projectIds ?? []).slice(0, MAX_BATCH);
    if (ids.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    const updated: Project[] = [];

    for (const projectId of ids) {
      const project = await loadProject(projectId);
      if (!project || !needsJapaneseTranslation(project)) {
        if (project) updated.push(project);
        continue;
      }

      const translation = await translateToJapanese(
        project.title,
        project.subtitle ?? ""
      );
      const saved = await saveTranslation(projectId, translation);
      updated.push(saved);
    }

    return NextResponse.json({ projects: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "一括翻訳に失敗しました" },
      { status: 500 }
    );
  }
}
