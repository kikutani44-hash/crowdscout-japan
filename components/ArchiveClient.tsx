"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usdToJpy } from "@/lib/utils";
import { USD_JPY } from "@/lib/japan-price";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { logActivity } from "@/lib/activity-log";
import { ContactModal } from "@/components/ContactModal";
import { ProductCard } from "@/components/ProductCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CFCheckResult } from "@/components/CFCheckResult";
import type { OfferStatus, Project } from "@/lib/types";
import { needsJapaneseTranslation } from "@/lib/project-translation";

const TRANSLATE_BATCH_SIZE = 3;

// 過去案件は700件を超えるため、調達額で絞れないと目が滑る。
// ただし「海外で伸びなくても日本で売れる」商品（防犯カメラなど）が
// 実在するとオーナーから指摘があったため、切り捨てず1クリックで全件に戻せるようにする。
const AMOUNT_FILTERS = [
  { key: "10m", label: "1,000万円以上", jpy: 10_000_000 },
  { key: "7m", label: "700万円以上", jpy: 7_000_000 },
  { key: "all", label: "すべて", jpy: 0 },
] as const;

type AmountFilterKey = (typeof AMOUNT_FILTERS)[number]["key"];
const TRANSLATE_FETCH_TIMEOUT_MS = 55_000;

interface ArchiveClientProps {
  initialProjects: Project[];
}

export function ArchiveClient({ initialProjects }: ArchiveClientProps) {
  const { token } = useAuth();
  const [projects, setProjects] = useState(initialProjects);
  const [offerProject, setOfferProject] = useState<Project | null>(null);

  // パイプラインから「案件へ」で飛んできたとき、該当カードまでスクロールして強調する。
  // 過去案件はトップページに存在しないため、こちら側にも同じ仕組みが要る。
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("project");
  useEffect(() => {
    if (!highlightId) return;
    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(`project-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary", "ring-offset-2");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 3000);
        // 再訪時に再び飛ばないようパラメータを消す
        router.replace("/dashboard/archive", { scroll: false });
      } else if (attempts < 20) {
        attempts++;
        setTimeout(tryScroll, 200);
      }
    };
    setTimeout(tryScroll, 300);
  }, [highlightId, router]);

  useEffect(() => {
    logActivity(token, "page_view", { metadata: { page: "archive" } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [cfProject, setCfProject] = useState<Project | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());

  const [amountFilter, setAmountFilter] = useState<AmountFilterKey>("10m");

  const threshold = AMOUNT_FILTERS.find((f) => f.key === amountFilter)!.jpy;
  const visibleProjects = projects.filter(
    (p) => usdToJpy(p.raised_usd ?? 0, USD_JPY) >= threshold
  );

  const japanUnenteredCount = visibleProjects.filter((p) =>
    p.japan_cf_result ? p.japan_cf_result.isJapanUnentered : true
  ).length;

  useEffect(() => {
    const missing = initialProjects.filter(needsJapaneseTranslation);
    if (missing.length === 0) return;

    let cancelled = false;
    setTranslatingIds(new Set(missing.map((p) => p.id)));

    (async () => {
      for (let i = 0; i < missing.length; i += TRANSLATE_BATCH_SIZE) {
        if (cancelled) break;
        const batch = missing.slice(i, i + TRANSLATE_BATCH_SIZE);
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), TRANSLATE_FETCH_TIMEOUT_MS);
          const res = await fetch("/api/translate/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: batch.map((p) => ({ id: p.id, title: p.title, subtitle: p.subtitle })),
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);

          if (data.projects?.length) {
            const byId = new Map<string, { title_ja: string; subtitle_ja: string }>(
              data.projects.map((p: { id: string; title_ja: string; subtitle_ja: string }) => [
                p.id,
                { title_ja: p.title_ja, subtitle_ja: p.subtitle_ja },
              ])
            );
            setProjects((prev) =>
              prev.map((p) => {
                const translated = byId.get(p.id);
                return translated ? { ...p, ...translated } : p;
              })
            );
            setTranslatingIds((prev) => {
              const next = new Set(prev);
              batch.forEach((p) => next.delete(p.id));
              return next;
            });
          }
        } catch (err) {
          console.error("[archive-auto-translate]", err);
          setTranslatingIds((prev) => {
            const next = new Set(prev);
            batch.forEach((p) => next.delete(p.id));
            return next;
          });
        }
      }
      if (!cancelled) setTranslatingIds(new Set());
    })();

    return () => { cancelled = true; };
  }, [initialProjects]);

  const updateProject = useCallback((updated: Project) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const handleTranslate = async (project: Project) => {
    logActivity(token, "translate", { projectId: project.id, projectTitle: project.title });
    setLoadingAction(`translate-${project.id}`);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, title: project.title, subtitle: project.subtitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      updateProject({ ...project, ...(data.project as Project) });
    } catch (err) {
      alert(err instanceof Error ? err.message : "翻訳に失敗しました");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCfCheck = async (project: Project) => {
    logActivity(token, "cf_check", { projectId: project.id, projectTitle: project.title });
    setLoadingAction(`cf-${project.id}`);
    try {
      const res = await fetch("/api/cf-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          query: project.title,
          title: project.title,
          title_ja: project.title_ja,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = { ...project, ...(data.project as Partial<Project>) };
      updateProject(updated);
      setCfProject(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "CFチェックに失敗しました");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleOfferStatusChange = async (projectId: string, status: OfferStatus) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    logActivity(token, "status_change", {
      projectId: project.id,
      projectTitle: project.title,
      metadata: { from: project.offer_status, to: status },
    });
    const previous = project.offer_status;
    updateProject({ ...project, offer_status: status });
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_status: status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      updateProject({ ...project, offer_status: previous });
      alert(`ステータスの保存に失敗しました。再度お試しください。\n${e}`);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/40 px-4 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">📦 過去のサクセス案件</h1>
            <p className="text-sm text-muted-foreground">
              終了した案件 · 日本未参入の可能性あり
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            ダッシュボードへ
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          <span className="rounded-lg border border-border bg-card px-4 py-2">
            表示中 <strong>{visibleProjects.length}件</strong>
            <span className="text-muted-foreground"> / 全{projects.length}件</span>
          </span>
          <span className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-amber-400">
            日本未参入 <strong>{japanUnenteredCount}件</strong>
          </span>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">調達額</span>
          {AMOUNT_FILTERS.map((filter) => {
            const count = projects.filter(
              (p) => usdToJpy(p.raised_usd ?? 0, USD_JPY) >= filter.jpy
            ).length;
            const active = filter.key === amountFilter;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setAmountFilter(filter.key)}
                className={
                  active
                    ? "rounded-md border border-primary bg-primary/15 px-3 py-1.5 text-sm font-medium text-primary"
                    : "rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
                }
              >
                {filter.label}
                <span className="ml-1.5 text-xs opacity-70">{count}</span>
              </button>
            );
          })}
          <span className="text-xs text-muted-foreground">
            ※ 海外で伸びなくても日本で売れる商品はあるため、絞り込みは「すべて」で外せます
          </span>
        </div>

        {visibleProjects.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
            <p className="text-4xl mb-3">💎</p>
            <p>
              {projects.length === 0
                ? "まだアーカイブ案件がありません。"
                : "この金額以上の案件はありません。"}
            </p>
            <p className="text-xs mt-2">
              {projects.length === 0
                ? "キャンペーンが終了した案件はここに移動します。"
                : "「すべて」を選ぶと全件表示に戻ります。"}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleProjects.map((project) => (
              <div key={project.id} id={`project-${project.id}`} className="transition-all duration-500">
              <ProductCard
                project={project}
                onTranslate={handleTranslate}
                onCfCheck={handleCfCheck}
                onOffer={(p) => {
                  logActivity(token, "offer_open", { projectId: p.id, projectTitle: p.title });
                  setOfferProject(p);
                }}
                onExternalLink={(p) => logActivity(token, "external_link", { projectId: p.id, projectTitle: p.title })}
                onCardClick={(p) => logActivity(token, "card_click", { projectId: p.id, projectTitle: p.title })}
                onOfferStatusChange={handleOfferStatusChange}
                loadingAction={loadingAction}
                isTranslating={translatingIds.has(project.id)}
              />
              </div>
            ))}
          </div>
        )}
      </main>

      <ContactModal
        project={offerProject}
        open={!!offerProject}
        onOpenChange={(open) => !open && setOfferProject(null)}
        onSent={(projectId, offerStatus) => {
          const p = projects.find((x) => x.id === projectId);
          if (p) updateProject({ ...p, offer_status: offerStatus });
        }}
      />

      <Dialog open={!!cfProject} onOpenChange={(open) => !open && setCfProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🇯🏼 日本CFチェック結果</DialogTitle>
          </DialogHeader>
          {cfProject && <CFCheckResult result={cfProject.japan_cf_result} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
