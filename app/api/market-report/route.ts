import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 30;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  return createClient(url, key);
}

export async function POST(request: Request) {
  try {
    const { projectId } = await request.json() as { projectId?: string };
    if (!projectId) {
      return NextResponse.json({ error: "projectId が必要です" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check cache
    const { data: report } = await supabase
      .from("reports")
      .select("status, html, error")
      .eq("project_id", projectId)
      .single();

    if (report?.status === "ready" && report.html) {
      return NextResponse.json({ status: "ready", html: report.html });
    }
    if (report?.status === "generating") {
      // If stuck generating for >5 minutes, reset and retry
      const updatedAt = new Date(report.updated_at ?? report.created_at ?? 0).getTime();
      const staleMs = Date.now() - updatedAt;
      if (staleMs < 5 * 60 * 1000) {
        return NextResponse.json({ status: "generating" });
      }
      // Stale — fall through to re-trigger
      await supabase.from("reports").delete().eq("project_id", projectId);
    }
    if (report?.status === "error") {
      // Reset so user can retry
      await supabase.from("reports").delete().eq("project_id", projectId);
      return NextResponse.json({ status: "error", error: report.error });
    }

    // No record yet — tell client to trigger the background function directly
    return NextResponse.json({ status: "not_started" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "エラーが発生しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
