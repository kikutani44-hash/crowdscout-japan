import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import {
  applyCfCheckToProject,
  findLocalProject,
  updateLocalProject,
} from "@/lib/project-store";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { JapanCfResult } from "@/lib/types";

const execFileAsync = promisify(execFile);

async function runJapanCfCheck(query: string): Promise<JapanCfResult> {
  const scriptPath = path.join(process.cwd(), "scripts", "check_japan_cf.py");
  const { stdout } = await execFileAsync(
    "python3",
    [scriptPath, query, "--json-only"],
    {
      cwd: process.cwd(),
      timeout: 3 * 60 * 1000,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  const parsed = JSON.parse(stdout.trim()) as JapanCfResult;
  return parsed;
}

import { isServerlessRuntime, pythonUnavailableResponse } from "@/lib/serverless-runtime";

export async function POST(request: Request) {
  if (isServerlessRuntime()) {
    return NextResponse.json(pythonUnavailableResponse("日本CFチェック"), { status: 503 });
  }
  try {
    const { projectId, query } = await request.json();
    if (!query) {
      return NextResponse.json({ error: "検索クエリが必要です" }, { status: 400 });
    }

    const result = await runJapanCfCheck(query);
    const localProject = projectId ? await findLocalProject(projectId) : null;

    const updates = applyCfCheckToProject(
      localProject ?? {
        raised_usd: 0,
        goal_usd: 1,
        backers: 0,
        category: "",
        japan_cf_result: null,
      },
      result
    );

    if (isSupabaseConfigured() && projectId) {
      const supabase = createServerSupabase();
      await supabase
        .from("projects")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", projectId);
    } else if (projectId) {
      await updateLocalProject(projectId, updates);
    }

    return NextResponse.json({ project: updates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CFチェックに失敗しました" },
      { status: 500 }
    );
  }
}
