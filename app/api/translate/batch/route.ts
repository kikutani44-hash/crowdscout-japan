import { NextResponse } from "next/server";
import { translateToJapanese } from "@/lib/claude";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { needsJapaneseTranslation } from "@/lib/translation-status";

const MAX_BATCH = 3;

type BatchItem = {
  id: string;
  title: string;
  subtitle: string;
};

function parseItems(body: unknown): BatchItem[] | null {
  if (!body || typeof body !== "object") return null;

  const record = body as Record<string, unknown>;

  if ("projectIds" in record && !("items" in record)) {
    return null;
  }

  if (!Array.isArray(record.items)) return null;

  const items: BatchItem[] = [];
  for (const raw of record.items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.title !== "string") continue;
    items.push({
      id: item.id,
      title: item.title,
      subtitle: typeof item.subtitle === "string" ? item.subtitle : "",
    });
  }

  return items;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const items = parseItems(body);
  if (items === null) {
    return NextResponse.json(
      {
        error:
          "items 配列が必要です。各要素に id, title, subtitle を含めてください。",
      },
      { status: 400 }
    );
  }

  const batch = items.slice(0, MAX_BATCH);
  if (batch.length === 0) {
    return NextResponse.json({ projects: [] });
  }

  try {
    const supabase = createServerSupabase();

    // 翻訳済みの案件を先にまとめて引き当て、Claude APIを呼ぶ対象から除外する
    // （Anthropicクレジット節約）
    const alreadyTranslated = new Map<string, { title_ja: string; subtitle_ja: string }>();
    if (isSupabaseConfigured()) {
      try {
        const { data: existing } = await supabase
          .from("projects")
          .select("id, title, subtitle, title_ja, subtitle_ja")
          .in("id", batch.map((item) => item.id));

        for (const row of existing ?? []) {
          if (!needsJapaneseTranslation(row)) {
            alreadyTranslated.set(row.id, {
              title_ja: row.title_ja,
              subtitle_ja: row.subtitle_ja,
            });
          }
        }
      } catch {
        // 参照に失敗した場合は全件を通常どおり翻訳する
      }
    }

    const projects = [];
    for (const item of batch) {
      const cached = alreadyTranslated.get(item.id);
      if (cached) {
        projects.push({ id: item.id, ...cached });
        continue;
      }

      const { title_ja, subtitle_ja } = await translateToJapanese(
        item.title,
        item.subtitle
      );
      projects.push({ id: item.id, title_ja, subtitle_ja });
      // Supabaseに保存して次回以降の再翻訳を防ぐ
      await supabase
        .from("projects")
        .update({ title_ja, subtitle_ja })
        .eq("id", item.id);
    }
    return NextResponse.json({
      projects,
      translated: projects.length - alreadyTranslated.size,
      skipped: alreadyTranslated.size,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "一括翻訳に失敗しました" },
      { status: 500 }
    );
  }
}
