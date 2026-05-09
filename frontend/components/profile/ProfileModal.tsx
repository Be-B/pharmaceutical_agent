"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, UserProfile } from "@/lib/api";
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const labelCls = "text-sm font-medium text-gray-700";

export function ProfileModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (p: UserProfile) => void;
}) {
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    api.me().then(setProfile).catch(() => {});
  }, [open]);

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.updateMe({
        name: profile.name || null,
        age: profile.age == null ? null : Number(profile.age),
        gender: profile.gender || null,
        symptoms_note: profile.symptoms_note || null,
        current_medications: profile.current_medications || null,
        allergies: profile.allergies || null,
      });
      onSaved?.(updated);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "저장 실패";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const selectCls = cn(
    "flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/* Header */}
      <DialogHeader className="border-b border-gray-100 pb-4">
        <div>
          <DialogTitle className="text-lg text-gray-900">프로필 및 증상</DialogTitle>
          <p className="text-xs text-gray-500 mt-0.5">
            입력 정보는 AI가 약물 상호작용·알레르기 안내에 활용합니다.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </Button>
      </DialogHeader>

      {/* Body */}
      <DialogContent className="space-y-4">
        <div>
          <label className={labelCls}>이름</label>
          <Input
            className="mt-1"
            value={profile.name || ""}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            placeholder="홍길동"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>나이</label>
            <Input
              className="mt-1"
              type="number"
              min={0}
              max={120}
              value={profile.age ?? ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  age: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="예: 35"
            />
          </div>
          <div>
            <label className={labelCls}>성별</label>
            <select
              value={profile.gender || ""}
              onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
              className={cn(selectCls, "mt-1")}
            >
              <option value="">선택안함</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
              <option value="other">기타</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>증상 / 특이사항</label>
          <Textarea
            className="mt-1"
            value={profile.symptoms_note || ""}
            onChange={(e) => setProfile({ ...profile, symptoms_note: e.target.value })}
            placeholder="예: 평소 위가 약함, 카페인 민감, 자주 두통"
            rows={3}
          />
        </div>

        <div>
          <label className={labelCls}>복용 중인 약물</label>
          <Textarea
            className="mt-1"
            value={profile.current_medications || ""}
            onChange={(e) =>
              setProfile({ ...profile, current_medications: e.target.value })
            }
            placeholder="예: 아스피린 100mg (매일 아침), 메트포르민 500mg"
            rows={2}
          />
        </div>

        <div>
          <label className={labelCls}>알레르기</label>
          <Textarea
            className="mt-1"
            value={profile.allergies || ""}
            onChange={(e) => setProfile({ ...profile, allergies: e.target.value })}
            placeholder="예: 페니실린, 견과류, 설파제"
            rows={2}
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}
      </DialogContent>

      {/* Footer */}
      <DialogFooter className="border-t border-gray-100 bg-gray-50 rounded-b-2xl">
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button onClick={save} disabled={loading}>
          {loading ? "저장중..." : "저장"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
