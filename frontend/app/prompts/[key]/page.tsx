"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  History,
  Plus,
  Trash2,
  Copy,
  ChevronLeft,
  CheckCheck,
} from "lucide-react";
import { api, PromptDetail, Version, Activation } from "@/lib/api";
import { VersionEditor } from "@/components/prompts/VersionEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";

// ── Relative time ──────────────────────────────────────────────────────────────
const rtf = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

function relativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
  return rtf.format(Math.round(diffSec / 2592000), "month");
}

// ── Toast ──────────────────────────────────────────────────────────────────────
type Toast = { id: number; message: string; action?: { label: string; onClick: () => void } };

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 bg-zinc-900 text-white text-sm px-4 py-3 rounded-xl shadow-2xl border border-zinc-700 animate-in slide-in-from-bottom-2"
        >
          <CheckCheck className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.onClick();
                onDismiss(t.id);
              }}
              className="text-indigo-400 hover:text-indigo-300 font-medium underline-offset-2 hover:underline"
            >
              {t.action.label}
            </button>
          )}
          <button
            onClick={() => onDismiss(t.id)}
            className="text-zinc-500 hover:text-white ml-1"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-zinc-200 rounded-md ${className ?? ""}`} />
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PromptDetailPage() {
  const params = useParams<{ key: string }>();
  const key = params.key;

  const [detail, setDetail] = useState<PromptDetail | null>(null);
  const [activations, setActivations] = useState<Activation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // selected version in left panel
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

  // new-version editor open state
  const [editorOpen, setEditorOpen] = useState(false);

  // activate confirm dialog
  const [activateTarget, setActivateTarget] = useState<Version | null>(null);
  const [activating, setActivating] = useState(false);

  // copy state
  const [copied, setCopied] = useState(false);

  // toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastSeq, setToastSeq] = useState(0);

  // active tab: "versions" | "history"
  const [tab, setTab] = useState<"versions" | "history">("versions");

  function pushToast(message: string, action?: Toast["action"]) {
    const id = toastSeq + 1;
    setToastSeq(id);
    setToasts((prev) => [...prev, { id, message, action }]);
    setTimeout(() => dismissToast(id), 4500);
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.getPrompt(key);
      setDetail(d);
      if (d.versions.length > 0) {
        setSelectedVersionId((prev) => {
          // keep selection if it still exists, else pick active or latest
          const still = d.versions.find((v) => v.id === prev);
          if (still) return still.id;
          const active = d.versions.find((v) => v.is_active);
          return (active ?? d.versions[d.versions.length - 1]).id;
        });
      }
      try {
        setActivations(await api.listActivations(key));
      } catch {
        setActivations([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    reload();
  }, [reload]);

  const selectedVersion =
    detail?.versions.find((v) => v.id === selectedVersionId) ?? null;

  async function handleActivate() {
    if (!activateTarget) return;
    setActivating(true);
    try {
      await api.setActiveVersion(key, activateTarget.version_number);
      await reload();
      pushToast(`v${activateTarget.version_number} 활성화 완료`);
    } catch (e) {
      pushToast(`활성화 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActivating(false);
      setActivateTarget(null);
    }
  }

  function handleVersionCreated(v: Version) {
    setEditorOpen(false);
    reload().then(() => {
      setSelectedVersionId(v.id);
      pushToast(`v${v.version_number} 생성됨 — 활성화하시겠어요?`, {
        label: "활성화",
        onClick: () => {
          setActivateTarget(v);
        },
      });
    });
  }

  async function handleCopy() {
    if (!selectedVersion) return;
    await navigator.clipboard.writeText(selectedVersion.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading && !detail) {
    return (
      <main className="min-h-screen bg-zinc-50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Skeleton className="h-4 w-32 mb-8" />
          <div className="flex gap-6">
            <div className="w-64 shrink-0 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
            <div className="flex-1 space-y-4">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <p className="text-red-700 font-medium mb-1">오류가 발생했습니다</p>
          <p className="text-sm text-red-500">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={reload}>
            다시 시도
          </Button>
        </div>
      </main>
    );
  }

  if (!detail) return null;

  const sortedVersions = [...detail.versions].sort(
    (a, b) => b.version_number - a.version_number
  );

  return (
    <main className="min-h-screen bg-zinc-50">
      {/* ── Top nav ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link
            href="/prompts"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            프롬프트 목록
          </Link>
          <Link
            href="/chat"
            className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            채팅으로 →
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 font-mono">
              {detail.key}
            </h1>
            {detail.versions.some((v) => v.is_active) && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-0.5">
                <Sparkles className="w-3 h-3" />
                활성화됨
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">{detail.description || "설명 없음"}</p>
          <p className="mt-2 text-xs text-zinc-400">
            총 {detail.versions.length}개 버전
            {activations.length > 0 &&
              ` · 마지막 활성화 ${relativeTime(activations[0].activated_at)}`}
          </p>
        </div>

        {/* ── 2-column layout ──────────────────────────────────────────────── */}
        <div className="flex gap-6 items-start">
          {/* ── Left: version list ─────────────────────────────────────────── */}
          <aside className="w-64 shrink-0">
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              {/* Tab strip */}
              <div className="flex border-b border-zinc-200">
                <button
                  onClick={() => setTab("versions")}
                  className={`flex-1 text-xs font-medium px-3 py-2.5 transition-colors ${
                    tab === "versions"
                      ? "text-zinc-900 border-b-2 border-indigo-500 -mb-px bg-white"
                      : "text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  버전
                </button>
                <button
                  onClick={() => setTab("history")}
                  className={`flex-1 text-xs font-medium px-3 py-2.5 transition-colors inline-flex items-center justify-center gap-1 ${
                    tab === "history"
                      ? "text-zinc-900 border-b-2 border-indigo-500 -mb-px bg-white"
                      : "text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  <History className="w-3 h-3" />
                  이력
                </button>
              </div>

              {/* Version list tab */}
              {tab === "versions" && (
                <ul className="divide-y divide-zinc-100">
                  {sortedVersions.map((v) => (
                    <li key={v.id}>
                      <button
                        onClick={() => setSelectedVersionId(v.id)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          selectedVersionId === v.id
                            ? "bg-indigo-50"
                            : "hover:bg-zinc-50"
                        } ${v.is_active ? "border-l-4 border-indigo-500" : "border-l-4 border-transparent"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-sm text-zinc-900">
                            v{v.version_number}
                          </span>
                          {v.is_active && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-indigo-700 bg-indigo-100 rounded-full px-1.5 py-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {relativeTime(v.created_at)}
                        </p>
                      </button>
                    </li>
                  ))}
                  {sortedVersions.length === 0 && (
                    <li className="px-4 py-8 text-center text-xs text-zinc-400">
                      버전 없음
                    </li>
                  )}
                </ul>
              )}

              {/* History tab */}
              {tab === "history" && (
                <div className="p-4">
                  {activations.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-4">이력 없음</p>
                  ) : (
                    <ol className="relative border-l border-zinc-200 space-y-4 ml-2">
                      {activations.map((a) => (
                        <li key={a.id} className="ml-4">
                          <div className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white" />
                          <p className="text-xs font-mono font-semibold text-zinc-800">
                            v{a.version_number}
                          </p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            {a.activated_by_email || "system"}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            {relativeTime(a.activated_at)}
                          </p>
                          {a.deactivated_at && (
                            <p className="text-[10px] text-zinc-400">
                              → {relativeTime(a.deactivated_at)} 비활성
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* ── Right: detail panel ────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {selectedVersion ? (
              <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                {/* Version header */}
                <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-mono font-bold text-xl text-zinc-900">
                        v{selectedVersion.version_number}
                      </h2>
                      {selectedVersion.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-0.5">
                          <Sparkles className="w-3 h-3" />
                          활성
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400 bg-zinc-100 rounded-full px-2.5 py-0.5">
                          비활성
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-2">
                      <span className="text-xs text-zinc-400">
                        {relativeTime(selectedVersion.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      title="본문 복사"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? "복사됨" : "복사"}
                    </Button>
                    {!selectedVersion.is_active && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setActivateTarget(selectedVersion)}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          활성화
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-zinc-400 hover:text-red-500"
                          title="삭제 (준비 중)"
                          disabled
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Prompt content */}
                <div className="px-6 py-5">
                  <pre className="text-sm font-mono leading-relaxed text-zinc-800 whitespace-pre-wrap bg-zinc-950 text-zinc-100 rounded-lg p-4 overflow-x-auto">
                    {selectedVersion.content}
                  </pre>
                </div>

                {/* New version editor */}
                <div className="border-t border-zinc-100 px-6 py-5">
                  {editorOpen ? (
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-700 mb-3">
                        이 버전을 기반으로 새 버전 작성
                      </h3>
                      <VersionEditor
                        promptKey={key}
                        initialContent={selectedVersion.content}
                        onCreated={handleVersionCreated}
                        onCancel={() => setEditorOpen(false)}
                      />
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditorOpen(true)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      이 버전 기반으로 새 버전 작성
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* No version selected yet — show blank editor */
              <div className="bg-white rounded-xl border border-zinc-200 p-6">
                <h3 className="text-sm font-semibold text-zinc-700 mb-3">
                  첫 버전 작성
                </h3>
                <VersionEditor
                  promptKey={key}
                  onCreated={handleVersionCreated}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Activate confirm dialog ───────────────────────────────────────── */}
      <Dialog
        open={activateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setActivateTarget(null);
        }}
      >
        <DialogHeader>
          <DialogTitle>버전 활성화</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-zinc-600">
            <span className="font-mono font-semibold text-zinc-900">
              v{activateTarget?.version_number}
            </span>
            을 활성으로 설정합니다. 다음 채팅 호출부터 이 버전이 적용됩니다.
          </p>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActivateTarget(null)}
            disabled={activating}
          >
            취소
          </Button>
          <Button size="sm" onClick={handleActivate} disabled={activating}>
            <Sparkles className="w-3.5 h-3.5" />
            {activating ? "활성화 중..." : "활성화"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ── Toasts ───────────────────────────────────────────────────────────── */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
