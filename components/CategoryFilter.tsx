"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CategoryOption } from "@/lib/categories";

interface CategoryFilterProps {
  options: CategoryOption[];
  value?: string;
  onChange: (category: string) => void;
}

export function CategoryFilter({ options, value = "all", onChange }: CategoryFilterProps) {
  const total = options.reduce((sum, option) => sum + option.count, 0);
  const selected = value ?? "all";

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">カテゴリ（クリックで絞り込み）</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange("all")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition",
            selected === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-secondary/40 text-foreground hover:border-primary/50"
          )}
        >
          すべて
          <Badge
            variant={selected === "all" ? "secondary" : "outline"}
            className="h-5 min-w-5 justify-center px-1.5 text-[10px]"
          >
            {total}
          </Badge>
        </button>

        {options.map((option) => {
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              title={option.labelEn}
              onClick={() => onChange(option.value)}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-sm transition",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary/40 text-foreground hover:border-primary/50"
              )}
            >
              <span className="truncate">{option.labelJa}</span>
              <Badge
                variant={active ? "secondary" : "outline"}
                className="h-5 min-w-5 shrink-0 justify-center px-1.5 text-[10px]"
              >
                {option.count}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
