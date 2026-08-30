import { NextRequest, NextResponse } from "next/server";
import { checkSiteAlive } from "@/lib/site-check";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 20;

export async function POST(req: NextRequest) {
  const { projectId, url, force = false } = (await req.json()) as {
    projectId?: string;
    url?: string;
    force?: boolean;
  };

  if (!url) {
    return NextResponse.json({ error: "url が必要です" }, { status: 400 });
  }

  // 判定済みなら再チェックしない（外部サイトへの無駄なアクセスを避ける）。
  // 「再チェック」したい場合は force: true を渡す。
  if (!force && projectId && isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabase();
      const { data } = await supabase
        .from("projects")
        .select("site_alive, site_status_code, site_checked_at")
        .eq("id", projectId)
        .maybeSingle();

      if (data && data.site_checked_at && data.site_alive !== null) {
        return NextResponse.json({
          alive: data.site_alive,
          statusCode: data.site_status_code,
          reason: data.site_alive ? "サイトは生きています" : "到達できません",
          checkedAt: data.site_checked_at,
          cached: true,
        });
      }
    } catch {
      // 参照に失敗した場合は通常どおりチェックへ進む
    }
  }

  const result = await checkSiteAlive(url);
  const checkedAt = new Date().toISOString();

  if (projectId && isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabase();
      await supabase
        .from("projects")
        .update({
          site_alive: result.alive,
          site_status_code: result.statusCode,
          site_checked_at: checkedAt,
        })
        .eq("id", projectId);
    } catch {
      // 保存に失敗しても判定結果は返す
    }
  }

  return NextResponse.json({ ...result, checkedAt, cached: false });
}
