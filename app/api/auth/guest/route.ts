import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth";
import type { GuestExpiryOption } from "@/lib/auth-types";
import { createGuestPassword, listActiveGuestPasswords } from "@/lib/passwords";

const VALID_EXPIRY: GuestExpiryOption[] = ["1day", "1week", "1month", "unlimited"];

export async function GET(request: Request) {
  try {
    if (!requireAdminFromRequest(request)) {
      return NextResponse.json({ error: "管理者認証が必要です" }, { status: 401 });
    }

    const passwords = await listActiveGuestPasswords();
    return NextResponse.json({ passwords });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!requireAdminFromRequest(request)) {
      return NextResponse.json({ error: "管理者認証が必要です" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { expiry?: GuestExpiryOption };
    const expiry = body.expiry && VALID_EXPIRY.includes(body.expiry) ? body.expiry : "1week";
    const password = await createGuestPassword(expiry);
    return NextResponse.json({ password });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "発行に失敗しました" },
      { status: 500 }
    );
  }
}
