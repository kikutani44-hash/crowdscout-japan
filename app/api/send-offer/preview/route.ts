import { NextResponse } from "next/server";
import { translateOfferLetter, translateOfferLetterToJapanese } from "@/lib/claude";
import { detectLanguage } from "@/lib/language-detect";
import { previewOfferLetter } from "@/lib/mailer";
import { findLocalProject } from "@/lib/project-store";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { projectId, customNote } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId が必要です" }, { status: 400 });
    }

    let project = await findLocalProject(projectId);

    if (isSupabaseConfigured()) {
      const supabase = createServerSupabase();
      const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (data) project = data;
    }

    if (!project) {
      return NextResponse.json({ error: "案件が見つかりません" }, { status: 404 });
    }

    const letter = previewOfferLetter({
      productTitle: project.title_ja ?? project.title,
      productUrl: project.original_url,
      raisedUsd: project.raised_usd,
      backers: project.backers,
      category: project.category,
      customNote: customNote?.trim() || undefined,
    });

    // メーカーの言語を自動判定
    const langInfo = detectLanguage({ platform: project.platform, country: project.country });

    // 英語以外は翻訳、英語の場合は日本語参考訳のみ
    const [text_translated, text_ja] = await Promise.all([
      langInfo.code !== "en" ? translateOfferLetter(letter.text, langInfo.code) : Promise.resolve(null),
      translateOfferLetterToJapanese(letter.text),
    ]);

    return NextResponse.json({
      letter: {
        ...letter,
        text_translated,   // メーカーへ実際に送る翻訳文（英語以外のみ）
        text_ja,           // 日本語参考訳
        lang: langInfo,    // 言語情報
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "プレビュー生成に失敗しました" },
      { status: 500 }
    );
  }
}
