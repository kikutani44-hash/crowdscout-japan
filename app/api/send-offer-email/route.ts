import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body, projectTitle } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: "必須パラメータが不足しています" }, { status: 400 });
    }

    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    if (!SENDGRID_API_KEY) {
      return NextResponse.json({ error: "SendGrid APIキーが設定されていません" }, { status: 500 });
    }

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: "cbec@blink-japan.com", name: "Blink Japan / Yoshitaka Kikutani" },
        reply_to: { email: "cbec@blink-japan.com" },
        subject: subject,
        content: [{ type: "text/plain", value: body }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("SendGrid error:", error);
      return NextResponse.json({ error: `SendGrid エラー: ${error}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "メールを送信しました" });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
