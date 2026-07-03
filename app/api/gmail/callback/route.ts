import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client } from "@/lib/gmail-client";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "No code" }, { status: 400 });
  }

  try {
    const client = createOAuth2Client();
    const { tokens } = await client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return new NextResponse(
        `<html><body style="font-family:sans-serif;padding:2rem;">
          <h2>⚠️ refresh_token が取得できませんでした</h2>
          <p>Google Cloud Console で「テストユーザー」として追加されているか確認してください。</p>
          <p>または、<a href="/api/gmail/connect">再度接続</a>してください。</p>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem;max-width:600px;margin:auto;">
        <h2>✅ Gmail 連携成功！</h2>
        <p>以下の Refresh Token を <code>.env.local</code> に追加してください：</p>
        <pre style="background:#f0f0f0;padding:1rem;border-radius:6px;word-break:break-all;font-size:13px;">GMAIL_REFRESH_TOKEN=${refreshToken}</pre>
        <p>追加後、開発サーバーを再起動すれば Gmail 連携が有効になります。</p>
        <a href="/dashboard/inbox" style="display:inline-block;margin-top:1rem;padding:0.5rem 1rem;background:#4f46e5;color:white;border-radius:6px;text-decoration:none;">受信ボックスへ →</a>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
