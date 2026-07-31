"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
const TRANSLATE_FETCH_TIMEOUT_MS = 55_000;

interface ArchiveClientProps {
  initialProjects: Project[];
}

export function ArchiveClient({ initialProjects }: ArchiveClientProps) {
  const { token } = useAuth();
  const [projects, setProjects] = useState(initialProjects);
  const [offerProject, setOfferProject] = useState<Project | null>(null);
  const [cfProject, setCfProject] = useState<Project | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());

  const japanUnenteredCount = projects.filter((p) =>
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
              終了から180〜730日の案件 · 日本未参入の可能性あり
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
        <div className="mb-6 flex gap-4 text-sm">
          <span className="rounded-lg border border-border bg-card px-4 py-2">
            アーカイブ総数 <strong>{projects.length}件</strong>
          </span>
          <span className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-amber-400">
            日本未参入 <strong>{japanUnenteredCount}件</strong>
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
            <p className="text-4xl mb-3">💎</p>
            <p>まだアーカイブ案件がありません。</p>
            <p className="text-xs mt-2">クロールを実行すると 180〜730日前に終了した案件が追加されます。</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => (
              <ProductCard
                key={project.id}
                project={project}
                onTranslate={handleTranslate}
                onCfCheck={handleCfCheck}
                onOffer={(p) => {
                  logActivity(token, "offer_open", { projectId: p.id, projectTitle: p.title });
                  setOfferProject(p);
                }}
                onOfferStatusChange={handleOfferStatusChange}
                loadingAction={loadingAction}
                isTranslating={translatingIds.has(project.id)}
              />
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
