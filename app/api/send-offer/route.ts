import { NextResponse } from "next/server";
import { translateOfferLetter, generateFirstEmailVariables, generateSecondEmailVariables } from "@/lib/claude";
import { detectLanguage } from "@/lib/language-detect";
import { buildOfferLetter, buildFollowUpLetter } from "@/lib/offer-letter";
import { isSendGridConfigured, sendOfferLetterRaw } from "@/lib/mailer";
import { findLocalProject, updateLocalProject } from "@/lib/project-store";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { isServerlessRuntime } from "@/lib/serverless-runtime";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const { projectId, to, customNote, emailType = "first" } = await request.json();

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

    // メーカーの言語を判定
    const langInfo = detectLanguage({ platform: project.platform, country: project.country });

    let sendSubject: string;
    let sendText: string;
    let sendHtml: string;

    const productTitle = project.title_ja ?? project.title;
    const sharedParams = {
      productTitle,
      subtitle: project.subtitle_ja ?? project.subtitle ?? undefined,
      category: project.category,
      raisedUsd: project.raised_usd,
      backers: project.backers,
      platform: project.platform,
    };

    if (emailType === "second") {
      const vars = await generateSecondEmailVariables(sharedParams);
      const letter = buildFollowUpLetter({
        productTitle,
        productUrl: project.original_url,
        raisedUsd: project.raised_usd,
        backers: project.backers,
        category: project.category,
        customNote: customNote?.trim() || undefined,
        japanReasons: vars.japanReasons,
        japanMarketOverview: vars.japanMarketOverview,
        targetAudience: vars.targetAudience,
        crowdfundingTarget: vars.crowdfundingTarget,
      });
      sendSubject = letter.subject;
      sendText = langInfo.code !== "en"
        ? await translateOfferLetter(letter.text, langInfo.code)
        : letter.text;
      sendHtml = langInfo.code !== "en" ? sendText.replace(/\n/g, "<br>") : letter.html;
    } else {
      const vars = await generateFirstEmailVariables(sharedParams);
      const letter = buildOfferLetter({
        productTitle,
        productUrl: project.original_url,
        platform: project.platform,
        raisedUsd: project.raised_usd,
        goalUsd: project.goal_usd,
        backers: project.backers,
        category: project.category,
        customNote: customNote?.trim() || undefined,
        productDescriptionOneLine: vars.productDescriptionOneLine,
        japanAppealPoint: vars.japanAppealPoint,
      });
      sendSubject = letter.subject;
      sendText = langInfo.code !== "en"
        ? await translateOfferLetter(letter.text, langInfo.code)
        : letter.text;
      sendHtml = langInfo.code !== "en" ? sendText.replace(/\n/g, "<br>") : letter.html;
    }

    const result = await sendOfferLetterRaw({
      to: recipient,
      subject: sendSubject,
      text: sendText,
      html: sendHtml,
    });

    const now = new Date().toISOString();
    const updates = {
      offer_status: "交渉中" as const,
      maker_email: recipient,
      offer_sent_at: now,
      updated_at: now,
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
      lang: langInfo.label,
      offer_status: "交渉中",
      persisted: isSupabaseConfigured() || !isServerlessRuntime(),
      message: result.demo
        ? "デモ送信完了（SENDGRID_API_KEY 未設定のため実際のメールは送信されていません）"
        : `オファーメールを送信しました（${langInfo.label}）`,
      warning:
        isServerlessRuntime() && !isSupabaseConfigured()
          ? "本番環境では Supabase 未設定のため、オファー状況の保存はこのセッションのみ有効です"
          : undefined,
    });
  } catch (error) {
    const { parseAnthropicError } = await import("@/lib/api-error");
    const isSendGridError = error instanceof Error && "response" in error;
    const message = isSendGridError
      ? `メール送信に失敗しました（SendGridエラー）。SENDGRID_API_KEYを確認してください。`
      : parseAnthropicError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
