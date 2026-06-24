import Link from "next/link";
import { GuestPasswordIssuer } from "@/components/GuestPasswordIssuer";
import { DashboardCharts } from "@/components/DashboardCharts";
import { Badge } from "@/components/ui/badge";
import { getDashboardStats } from "@/lib/dashboard-stats";
import {
  getJapanCfBadgeLabel,
  getJapanCfBadgeVariant,
  getJapanCfDisplayStatus,
  matchesJapanUnenteredOnlyFilter,
} from "@/lib/japan-cf-status";
import { fetchProjects } from "@/lib/supabase";
import { getDisplayTitle } from "@/lib/project-translation";
import { formatJpy, formatUsd, usdToJpy } from "@/lib/utils";
import {
  ArrowLeft,
  Handshake,
  Mail,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

export default async function DashboardPage() {
  const projects = await fetchProjects();
  const stats = getDashboardStats(projects);

  const offerChartData = Object.entries(stats.byOfferStatus).map(([name, count]) => ({
    name,
    count,
  }));

  const categoryChartData = Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const platformChartData = Object.entries(stats.byPlatform).map(([name, count]) => ({
    name,
    count,
  }));

  const raisedChartData = stats.topByRaised.map((p) => ({
    name: p.title,
    raisedM: Math.round((p.raisedUsd / 1_000_000) * 10) / 10,
  }));

  const recent = [...projects]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/40 px-4 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">ダッシュボード</h1>
            <p className="text-sm text-muted-foreground">案件管理・交渉状況・売上分析</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            案件一覧へ
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        <GuestPasswordIssuer />

        {/* サマリーカード */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            icon={<Target className="h-4 w-4 text-primary" />}
            label="登録案件"
            value={String(stats.totalProjects)}
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            label="総調達額"
            value={formatJpy(usdToJpy(stats.totalRaisedUsd))}
            sub={formatUsd(stats.totalRaisedUsd)}
          />
          <StatCard
            icon={<Mail className="h-4 w-4 text-slate-400" />}
            label="未接触"
            value={String(stats.byOfferStatus["未接触"])}
          />
          <StatCard
            icon={<Handshake className="h-4 w-4 text-blue-400" />}
            label="交渉中"
            value={String(stats.byOfferStatus["交渉中"])}
            accent
          />
          <StatCard
            icon={<Users className="h-4 w-4 text-emerald-400" />}
            label="獲得済み"
            value={String(stats.byOfferStatus["獲得済み"])}
            accentGreen
          />
          <StatCard
            label="🇯🇵 未参入"
            value={String(stats.japanUnenteredCount)}
            sub={`平均スコア ${stats.avgScore}`}
          />
        </div>

        {/* オファーパイプライン */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">オファーパイプライン</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            {(["未接触", "交渉中", "獲得済み", "却下"] as const).map((status) => {
              const count = stats.byOfferStatus[status];
              const pct = stats.totalProjects
                ? Math.round((count / stats.totalProjects) * 100)
                : 0;
              return (
                <div
                  key={status}
                  className="rounded-lg border border-border bg-secondary/20 p-4 text-center"
                >
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-sm text-muted-foreground">{status}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{pct}%</p>
                </div>
              );
            })}
          </div>
        </section>

        <DashboardCharts
          offerChartData={offerChartData}
          categoryChartData={categoryChartData}
          platformChartData={platformChartData}
          raisedChartData={raisedChartData}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 優先オファー候補 */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-1 text-lg font-semibold">🇯🇵 優先オファー候補</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              日本未参入 × 高スコア案件
            </p>
            {stats.priorityOpportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground">該当案件がありません</p>
            ) : (
              <ul className="divide-y divide-border">
                {stats.priorityOpportunities.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        スコア {p.score} · {formatUsd(p.raisedUsd)}
                      </p>
                    </div>
                    <Badge variant="secondary">{p.offerStatus}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 最近追加 */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold">最近追加された案件</h2>
            <ul className="divide-y divide-border">
              {recent.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{getDisplayTitle(p)}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.platform} · スコア {p.score} · {formatUsd(p.raised_usd)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline">{p.offer_status}</Badge>
                    {matchesJapanUnenteredOnlyFilter(p) && (
                      <Badge
                        variant={getJapanCfBadgeVariant(getJapanCfDisplayStatus(p))}
                        className="text-[10px]"
                      >
                        {getJapanCfDisplayStatus(p) === "unchecked"
                          ? "可能性あり"
                          : getJapanCfBadgeLabel(getJapanCfDisplayStatus(p)).replace("🇯🇵 ", "")}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  accentGreen,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  accentGreen?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        {icon}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p
        className={`text-xl font-bold ${
          accentGreen ? "text-emerald-400" : accent ? "text-blue-400" : ""
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
