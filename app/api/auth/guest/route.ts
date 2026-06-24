import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth";
import { createGuestPassword, listActiveGuestPasswords } from "@/lib/passwords";

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

    const password = await createGuestPassword();
    return NextResponse.json({ password });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "発行に失敗しました" },
      { status: 500 }
    );
  }
}
