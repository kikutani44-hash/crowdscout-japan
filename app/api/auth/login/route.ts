import { NextResponse } from "next/server";
import {
  createAdminAuthToken,
  createGuestAuthToken,
  getAdminPassword,
  isAdminPassword,
} from "@/lib/auth";
import { findValidGuestPassword } from "@/lib/passwords";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };
    const password = body.password?.trim();

    if (!password) {
      return NextResponse.json({ error: "パスワードを入力してください" }, { status: 400 });
    }

    if (!getAdminPassword()) {
      return NextResponse.json(
        { error: "管理者パスワードが設定されていません（ADMIN_PASSWORD）" },
        { status: 503 }
      );
    }

    if (isAdminPassword(password)) {
      const token = createAdminAuthToken();
      return NextResponse.json({
        token,
        role: "admin",
        expiresAt: null,
      });
    }

    const guest = await findValidGuestPassword(password);
    if (!guest?.expires_at) {
      return NextResponse.json({ error: "パスワードが正しくないか、有効期限が切れています" }, { status: 401 });
    }

    const token = createGuestAuthToken(guest.id, guest.expires_at);
    return NextResponse.json({
      token,
      role: "guest",
      expiresAt: guest.expires_at,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ログインに失敗しました" },
      { status: 500 }
    );
  }
}
