import { NextRequest, NextResponse } from "next/server";
import { checkJapanPresence } from "@/lib/japan-presence";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";

// 4経路を並列で叩くため、サイト生存チェックより長めに取る
export const maxDuration = 25;

export async function POST(req: NextRequest) {
  const { projectId, title, officialUrl, force = false } = (await req.json()) as {
    projectId?: string;
    title?: string;
    officialUrl?: string | null;
    force?: boolean;
  };

  if (!title) {
    return NextResponse.json({ error: "title が必要です" }, { status: 400 });
  }

  // 判定済みなら再チェックしない（外部サイトへの無駄なアクセスを避ける）。
  // 「再チェック」したい場合は force: true を渡す。
  if (!force && projectId && isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabase();
      const { data } = await supabase
        .from("projects")
        .select("japan_presence_result, japan_presence_checked_at")
        .eq("id", projectId)
        .maybeSingle();

      if (data?.japan_presence_checked_at && data.japan_presence_result) {
        return NextResponse.json({
          ...data.japan_presence_result,
          checkedAt: data.japan_presence_checked_at,
          cached: true,
        });
      }
    } catch {
      // 参照に失敗した場合は通常どおりチェックへ進む
    }
  }

  const result = await checkJapanPresence(title, officialUrl);
  const checkedAt = new Date().toISOString();

  if (projectId && isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabase();
      await supabase
        .from("projects")
        .update({
          japan_presence_verdict: result.verdict,
          japan_presence_score: result.score,
          japan_presence_result: result,
          japan_presence_checked_at: checkedAt,
        })
        .eq("id", projectId);
    } catch {
      // 保存に失敗しても判定結果は返す
    }
  }

  return NextResponse.json({ ...result, checkedAt, cached: false });
}
