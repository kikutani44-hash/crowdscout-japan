import { NextResponse } from "next/server";
import { patchOfferStatus } from "@/lib/project-store";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    if (isSupabaseConfigured()) {
      const supabase = createServerSupabase();
      const { data, error } = await supabase
        .from("projects")
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq("id", params.id)
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json({ project: data });
    }

    const project = await patchOfferStatus(params.id, body.offer_status);
    if (!project) {
      return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新に失敗しました" },
      { status: 500 }
    );
  }
}
