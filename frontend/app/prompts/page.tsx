"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, Plus, Sparkles, FileText } from "lucide-react";
import { api, Prompt, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";

type AuthState =
  | { kind: "loading" }
  | { kind: "unauth" }
  | { kind: "forbidden" }
  | { kind: "ok"; role: string };

function relativeTime(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export default function PromptsList() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [list, setList] = useState<Prompt[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Create prompt modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then((u) => {
        if (u.role !== "admin") {
          setAuth({ kind: "forbidden" });
          return;
        }
        setAuth({ kind: "ok", role: u.role });
        api.listPrompts().then(setList).catch((e) => setError(String(e)));
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) setAuth({ kind: "unauth" });
        else setError(String(e));
      });
  }, []);

  async function handleCreate() {
    if (!newKey.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const p = await api.createPrompt({ key: newKey.trim(), description: newDesc.trim() });
      setCreateOpen(false);
      setNewKey("");
      setNewDesc("");
      router.push(`/prompts/${p.key}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (auth.kind === "loading") {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm text-zinc-400">로딩 중...</p>
        </div>
      </main>
    );
  }

  // ── Unauth ─────────────────────────────────────────────────────────────────
  if (auth.kind === "unauth") {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-lg border border-zinc-200 p-8 max-w-md w-full text-center">
          <Lock className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">로그인이 필요합니다</h2>
          <Link href="/login" className="text-indigo-600 hover:underline text-sm">
            로그인 페이지로 이동
          </Link>
        </div>
      </main>
    );
  }

  // ── Forbidden ──────────────────────────────────────────────────────────────
  if (auth.kind === "forbidden") {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-2xl shadow-lg border border-zinc-200 p-8 max-w-md w-full text-center">
          <Lock className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">관리자 전용 페이지</h2>
          <p className="text-sm text-zinc-600 mb-4">
            프롬프트 관리는 관리자 계정으로 접근할 수 있습니다.
          </p>
          <Link
            href="/chat"
            className="text-indigo-600 hover:underline text-sm inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            채팅으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Top nav */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            채팅으로
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              프롬프트 관리
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {list.length > 0
                ? `${list.length}개의 프롬프트 키`
                : "등록된 프롬프트가 없습니다"}
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            새 프롬프트
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-6">
            {error}
          </div>
        )}

        {/* Card grid */}
        {list.length === 0 && !error ? (
          <div className="border-2 border-dashed border-zinc-200 rounded-xl p-12 text-center">
            <FileText className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 mb-3">등록된 프롬프트가 없습니다</p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              첫 프롬프트 만들기
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {list.map((p) => (
              <Link
                key={p.id}
                href={`/prompts/${p.key}`}
                className="group block bg-white border border-zinc-200 rounded-xl p-5 hover:border-indigo-400 hover:shadow-md transition-all duration-150"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                    {p.key}
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
                    <Sparkles className="w-2.5 h-2.5" />
                    active
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">
                  {p.description || (
                    <em className="text-zinc-400 not-italic">설명 없음</em>
                  )}
                </p>
                <p className="text-xs text-zinc-400 mt-3">
                  등록 {relativeTime(p.created_at)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create prompt dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>새 프롬프트 만들기</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">
                프롬프트 키 <span className="text-red-500">*</span>
              </label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="예: pharmaceutical_rag_v1"
                className="font-mono"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                영문·숫자·언더스코어만 사용하세요
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-700 mb-1.5 block">
                설명
              </label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="이 프롬프트의 역할을 간략히 설명"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            {createError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}
          </div>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCreateOpen(false);
              setNewKey("");
              setNewDesc("");
              setCreateError(null);
            }}
            disabled={creating}
          >
            취소
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={creating || !newKey.trim()}
          >
            <Plus className="w-3.5 h-3.5" />
            {creating ? "생성 중..." : "만들기"}
          </Button>
        </DialogFooter>
      </Dialog>
    </main>
  );
}
