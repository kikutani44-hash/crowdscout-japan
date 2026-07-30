import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ ok: false }, { status: 401 });

    const payload = verifyAuthToken(token);
    if (!payload) return NextResponse.json({ ok: false }, { status: 401 });

    // 管理者のアクションはログしない
    if (payload.role !== "guest") return NextResponse.json({ ok: true });

    const { action, projectId, projectTitle, metadata } = await request.json();
    if (!action) return NextResponse.json({ ok: false }, { status: 400 });

    const supabase = createServerSupabase();
    await supabase.from("guest_activity_logs").insert({
      guest_id: payload.guestId ?? "unknown",
      action,
      project_id: projectId ?? null,
      project_title: projectTitle ?? null,
      metadata: metadata ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // ログ失敗は無視
  }
}
