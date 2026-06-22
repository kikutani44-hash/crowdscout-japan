import { NextResponse } from "next/server";
import { isSendGridConfigured, sendOfferLetter } from "@/lib/mailer";
import { findLocalProject, updateLocalProject } from "@/lib/project-store";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { isServerlessRuntime } from "@/lib/serverless-runtime";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const { projectId, to, customNote } = await request.json();

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

    const recipient = (to ?? project.maker_email)?.trim();
    if (!recipient) {
      return NextResponse.json({ error: "送信先メールアドレスを入力してください" }, { status: 400 });
    }
    if (!isValidEmail(recipient)) {
      return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
    }

    const result = await sendOfferLetter({
      to: recipient,
      productTitle: project.title_ja ?? project.title,
      productUrl: project.original_url,
      raisedUsd: project.raised_usd,
      backers: project.backers,
      category: project.category,
      customNote: customNote?.trim() || undefined,
    });

    const updates = {
      offer_status: "交渉中" as const,
      maker_email: recipient,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const supabase = createServerSupabase();
      await supabase.from("projects").update(updates).eq("id", projectId);
    } else {
      await updateLocalProject(projectId, updates);
    }

    return NextResponse.json({
      ok: true,
      demo: result.demo,
      configured: isSendGridConfigured(),
      to: result.to,
      subject: result.subject,
      offer_status: "交渉中",
      persisted: isSupabaseConfigured() || !isServerlessRuntime(),
      message: result.demo
        ? "デモ送信完了（SENDGRID_API_KEY 未設定のため実際のメールは送信されていません）"
        : "オファーメールを送信しました",
      warning:
        isServerlessRuntime() && !isSupabaseConfigured()
          ? "Netlify 本番環境では Supabase 未設定のため、オファー状況の保存はこのセッションのみ有効です"
          : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error && "response" in error
        ? `SendGrid エラー: ${JSON.stringify((error as { response?: { body?: unknown } }).response?.body ?? error.message)}`
        : error instanceof Error
          ? error.message
          : "送信に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
