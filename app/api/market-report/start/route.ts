import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 10;

export async function POST(request: Request) {
  try {
    const { projectId } = await request.json() as { projectId?: string };
    if (!projectId) return NextResponse.json({ ok: false });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    );

    await supabase.from("reports").upsert({
      project_id: projectId,
      status: "generating",
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
