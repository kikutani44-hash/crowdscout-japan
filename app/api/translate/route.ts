import { NextResponse } from "next/server";
import { translateToJapanese } from "@/lib/claude";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { needsJapaneseTranslation } from "@/lib/translation-status";

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

  const { projectId, title, subtitle, force = false } = body as {
    projectId?: string;
    title?: string;
    subtitle?: string;
    force?: boolean;
  };

  if (!title) {
    return NextResponse.json({ error: "title が必要です" }, { status: 400 });
  }

  // 翻訳済みならClaude APIを呼ばずDBの値をそのまま返す（Anthropicクレジット節約）
  if (!force && projectId && isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabase();
      const { data: existing } = await supabase
        .from("projects")
        .select("title, subtitle, title_ja, subtitle_ja")
        .eq("id", projectId)
        .maybeSingle();

      if (existing && !needsJapaneseTranslation(existing)) {
        return NextResponse.json({
          project: {
            id: projectId,
            title_ja: existing.title_ja,
            subtitle_ja: existing.subtitle_ja,
          },
          cached: true,
        });
      }
    } catch {
      // 参照に失敗した場合は通常どおり翻訳へ進む
    }
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
      cached: false,
    });
  } catch (error) {
    const { parseAnthropicError } = await import("@/lib/api-error");
    return NextResponse.json({ error: parseAnthropicError(error) }, { status: 500 });
  }
}
