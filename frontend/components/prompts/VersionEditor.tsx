"use client";
import { useState } from "react";
import { Save, X, GitCompareArrows } from "lucide-react";
import { diffLines } from "diff";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Version, api } from "@/lib/api";

interface VersionEditorProps {
  promptKey: string;
  initialContent?: string;
  onCreated: (v: Version) => void;
  onCancel?: () => void;
}

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const parts = diffLines(oldText, newText);
  if (parts.length === 1 && !parts[0].added && !parts[0].removed) {
    return (
      <p className="text-xs text-zinc-400 italic px-3 py-3">
        변경 사항이 없습니다 (이전 본문과 동일).
      </p>
    );
  }
  return (
    <div className="font-mono text-xs leading-relaxed bg-zinc-50 border border-zinc-200 rounded-lg overflow-hidden max-h-[55vh] overflow-y-auto">
      {parts.map((part, i) => {
        const lines = part.value.replace(/\n$/, "").split("\n");
        const cls = part.added
          ? "bg-green-50 text-green-800"
          : part.removed
          ? "bg-red-50 text-red-800 line-through decoration-red-300"
          : "text-zinc-500";
        const sign = part.added ? "+" : part.removed ? "−" : " ";
        return lines.map((line, j) => (
          <div key={`${i}-${j}`} className={`flex ${cls}`}>
            <span className="select-none w-6 text-center shrink-0 opacity-60">
              {sign}
            </span>
            <span className="whitespace-pre-wrap break-all flex-1 pr-3">
              {line || " "}
            </span>
          </div>
        ));
      })}
    </div>
  );
}

export function VersionEditor({
  promptKey,
  initialContent = "",
  onCreated,
  onCancel,
}: VersionEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);

  const isUnchanged = content.trim() === initialContent.trim();

  async function commitSave() {
    if (!content.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const v = await api.createVersion(promptKey, {
        content,
        model: null,
        temperature: null,
      });
      setDiffOpen(false);
      onCreated(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="프롬프트 본문을 입력하세요..."
          className="min-h-[260px] font-mono text-sm leading-relaxed resize-y bg-zinc-950 text-zinc-100 border-zinc-700 placeholder:text-zinc-600 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
        />

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end items-center">
          {!isUnchanged && (
            <span className="text-xs text-zinc-400 mr-auto">
              이전 본문에서 변경됨
            </span>
          )}
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
              <X className="w-3.5 h-3.5" />
              취소
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setDiffOpen(true)}
            disabled={busy || !content.trim() || isUnchanged}
          >
            <GitCompareArrows className="w-3.5 h-3.5" />
            저장 (변경 사항 확인)
          </Button>
        </div>
      </div>

      {/* Diff 미리보기 + 최종 저장 확인 */}
      <Dialog
        open={diffOpen}
        onOpenChange={(v) => !v && !busy && setDiffOpen(false)}
        className="max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>새 버전 저장 — 변경 사항 확인</DialogTitle>
        </DialogHeader>
        <DialogContent className="space-y-3">
          <p className="text-xs text-zinc-500">
            새 버전(비활성)으로 저장됩니다. 활성화는 별도로 진행하세요.
          </p>
          <DiffView oldText={initialContent} newText={content} />
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDiffOpen(false)}
            disabled={busy}
          >
            취소
          </Button>
          <Button size="sm" onClick={commitSave} disabled={busy}>
            <Save className="w-3.5 h-3.5" />
            {busy ? "저장 중..." : "이대로 저장"}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
