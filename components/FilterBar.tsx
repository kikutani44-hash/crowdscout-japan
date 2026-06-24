"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectFilters } from "@/lib/types";
import type { CategoryOption } from "@/lib/categories";
import type { PlatformFilterValue } from "@/lib/platforms";
import { CategoryFilter } from "@/components/CategoryFilter";
import { PlatformFilter } from "@/components/PlatformFilter";
import { Search } from "lucide-react";

interface FilterBarProps {
  filters: ProjectFilters;
  onChange: (filters: ProjectFilters) => void;
  categoryOptions: CategoryOption[];
  platformCounts?: Partial<Record<PlatformFilterValue, number>>;
}

export function FilterBar({
  filters,
  onChange,
  categoryOptions,
  platformCounts,
}: FilterBarProps) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="mb-4 border-b border-border/60 pb-4">
        <PlatformFilter
          value={filters.platform ?? "all"}
          counts={platformCounts}
          onChange={(platform) => onChange({ ...filters, platform })}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="商品名・説明文で検索（日本語 / English）..."
            value={filters.search ?? ""}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
        </div>

        <Select
          value={filters.offerStatus ?? "all"}
          onValueChange={(v) => onChange({ ...filters, offerStatus: v as ProjectFilters["offerStatus"] })}
        >
          <SelectTrigger>
            <SelectValue placeholder="オファー状況" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value="未接触">未接触</SelectItem>
            <SelectItem value="交渉中">交渉中</SelectItem>
            <SelectItem value="獲得済み">獲得済み</SelectItem>
            <SelectItem value="却下">却下</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.sortBy ?? "live_momentum"}
          onValueChange={(v) => onChange({ ...filters, sortBy: v as ProjectFilters["sortBy"] })}
        >
          <SelectTrigger>
            <SelectValue placeholder="並び順" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="live_momentum">🔥 終了間近・勢い順</SelectItem>
            <SelectItem value="score">スコア順</SelectItem>
            <SelectItem value="raised_usd">調達額順</SelectItem>
            <SelectItem value="backers">支援者数順</SelectItem>
            <SelectItem value="created_at">新着順</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {categoryOptions.length > 0 && (
        <div className="mt-4 border-t border-border/60 pt-4">
          <CategoryFilter
            options={categoryOptions}
            value={filters.category ?? "all"}
            onChange={(category) => onChange({ ...filters, category })}
          />
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2">
          <Switch
            id="live-hot"
            checked={filters.liveHotOnly ?? false}
            onCheckedChange={(checked) =>
              onChange({ ...filters, liveHotOnly: checked, sortBy: "live_momentum" })
            }
          />
          <label htmlFor="live-hot" className="text-sm text-muted-foreground">
            🔥 終了間近×勢いありのみ（21日以内・1人/日以上）
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="japan-unentered"
            checked={filters.japanUnenteredOnly ?? false}
            onCheckedChange={(checked) =>
              onChange({ ...filters, japanUnenteredOnly: checked })
            }
          />
          <label htmlFor="japan-unentered" className="text-sm text-muted-foreground">
            🇯🇵 日本未参入のみ表示（参入済みを除外）
          </label>
        </div>
      </div>
    </div>
  );
}
