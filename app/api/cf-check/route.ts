import { NextResponse } from "next/server";
import { applyCfCheckToProject, findLocalProject, updateLocalProject } from "@/lib/project-store";
import { buildCfSearchQuery, checkJapanCf } from "@/lib/japan-cf-check";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Project } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, query: rawQuery, title, title_ja } = body as {
      projectId?: string;
      query?: string;
      title?: string;
      title_ja?: string | null;
    };

    const query = buildCfSearchQuery(
      title_ja ?? null,
      rawQuery || title || ""
    );
    if (!query) {
      return NextResponse.json({ error: "検索クエリが必要です" }, { status: 400 });
    }

    const result = await checkJapanCf(query);

    if (isSupabaseConfigured() && projectId) {
      const supabase = createServerSupabase();
      const { data: existing, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error || !existing) {
        return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
      }

      const updates = applyCfCheckToProject(existing as Project, result);
      const updatedProject = {
        ...(existing as Project),
        ...updates,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from("projects")
        .update({
          japan_cf_checked: updates.japan_cf_checked,
          japan_cf_result: updates.japan_cf_result,
          score: updates.score,
          updated_at: updatedProject.updated_at,
        })
        .eq("id", projectId);

      return NextResponse.json({ project: updatedProject, result });
    }

    const localProject = projectId ? await findLocalProject(projectId) : null;
    const base = localProject ?? {
      raised_usd: 0,
      goal_usd: 1,
      backers: 0,
      category: "",
      japan_cf_result: null,
    };
    const updates = applyCfCheckToProject(base, result);

    if (projectId) {
      const saved = await updateLocalProject(projectId, updates);
      if (saved) {
        return NextResponse.json({ project: saved, result });
      }
    }

    return NextResponse.json({ project: updates, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CFチェックに失敗しました" },
      { status: 500 }
    );
  }
}
