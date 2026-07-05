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
      return NextResponse.json({ status: "generating" });
    }
    if (report?.status === "error") {
      // Reset so user can retry
      await supabase.from("reports").delete().eq("project_id", projectId);
      return NextResponse.json({ status: "error", error: report.error });
    }

    // No record yet — create pending and trigger background function
    await supabase.from("reports").upsert({
      project_id: projectId,
      status: "generating",
      updated_at: new Date().toISOString(),
    });

    const siteUrl = process.env.URL ?? process.env.DEPLOY_URL ?? "";
    if (siteUrl) {
      // Fire and forget — background function handles generation
      fetch(`${siteUrl}/.netlify/functions/report-generate-background`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      }).catch(() => {});
    }

    return NextResponse.json({ status: "generating" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "エラーが発生しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
