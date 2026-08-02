import { NextResponse } from "next/server";
import { translateToJapanese } from "@/lib/claude";
import { createServerSupabase } from "@/lib/supabase";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const { projectId, title, subtitle } = body as {
    projectId?: string;
    title?: string;
    subtitle?: string;
  };

  if (!title) {
    return NextResponse.json({ error: "title が必要です" }, { status: 400 });
  }

  try {
    const { title_ja, subtitle_ja } = await translateToJapanese(
      title,
      subtitle ?? ""
    );
    // Supabaseに保存して次回以降の再翻訳を防ぐ
    if (projectId) {
      const supabase = createServerSupabase();
      await supabase
        .from("projects")
        .update({ title_ja, subtitle_ja })
        .eq("id", projectId);
    }
    return NextResponse.json({
      project: {
        id: projectId,
        title_ja,
        subtitle_ja,
      },
    });
  } catch (error) {
    const { parseAnthropicError } = await import("@/lib/api-error");
    return NextResponse.json({ error: parseAnthropicError(error) }, { status: 500 });
  }
}
