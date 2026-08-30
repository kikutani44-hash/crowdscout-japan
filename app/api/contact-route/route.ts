import { NextRequest, NextResponse } from "next/server";
import { findContactRoutes, inspectRouteForm } from "@/lib/contact-route";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 25;

export async function POST(req: NextRequest) {
  const { projectId, siteUrl, force = false } = (await req.json()) as {
    projectId?: string;
    siteUrl?: string;
    force?: boolean;
  };

  if (!siteUrl) {
    return NextResponse.json({ error: "siteUrl が必要です" }, { status: 400 });
  }

  // 探索済みなら再取得しない（相手サイトへの無駄なアクセスを避ける）
  if (!force && projectId && isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabase();
      const { data } = await supabase
        .from("projects")
        .select("contact_routes, contact_routes_checked_at")
        .eq("id", projectId)
        .maybeSingle();

      if (data?.contact_routes_checked_at && data.contact_routes) {
        return NextResponse.json({
          ...data.contact_routes,
          checkedAt: data.contact_routes_checked_at,
          cached: true,
        });
      }
    } catch {
      // 参照に失敗した場合は通常どおり探索へ進む
    }
  }

  const result = await findContactRoutes(siteUrl);

  // 最優先の窓口だけ、入力フォームがあるかを確かめる。
  // フォームがあれば、そこが先方の受付導線である確度が高い。
  if (result.best) {
    const hasForm = await inspectRouteForm(result.best);
    result.best.hasForm = hasForm;
    const match = result.routes.find((r) => r.url === result.best!.url);
    if (match) match.hasForm = hasForm;
  }

  const checkedAt = new Date().toISOString();

  if (projectId && isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabase();
      await supabase
        .from("projects")
        .update({ contact_routes: result, contact_routes_checked_at: checkedAt })
        .eq("id", projectId);
    } catch {
      // 保存に失敗しても結果は返す
    }
  }

  return NextResponse.json({ ...result, checkedAt, cached: false });
}
