import Link from "next/link";
import { BarChart3, Telescope } from "lucide-react";

interface HeaderProps {
  totalRaisedJpy: number;
  totalProjects: number;
  japanUnenteredCount: number;
}

export function Header({ totalRaisedJpy, totalProjects, japanUnenteredCount }: HeaderProps) {
  return (
    <header className="border-b border-border bg-card/40 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Telescope className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">CrowdScout Japan</h1>
            <p className="text-xs text-muted-foreground">
              海外クラファン案件発掘・日本独占権獲得
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground">案件総売上（円換算）</p>
            <p className="text-lg font-semibold text-primary">
              ¥{totalRaisedJpy.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">登録案件</p>
            <p className="text-lg font-semibold">{totalProjects}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">🇯🇵 未参入</p>
            <p className="text-lg font-semibold text-emerald-400">{japanUnenteredCount}</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            <BarChart3 className="h-4 w-4" />
            ダッシュボード
          </Link>
        </div>
      </div>
    </header>
  );
}
