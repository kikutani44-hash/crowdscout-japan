import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/auth";
import { deleteGuestPassword } from "@/lib/passwords";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!requireAdminFromRequest(request)) {
      return NextResponse.json({ error: "管理者認証が必要です" }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "IDが必要です" }, { status: 400 });
    }

    await deleteGuestPassword(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "削除に失敗しました" },
      { status: 500 }
    );
  }
}
