"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export default function ChatIndex() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 기존 세션이 있으면 가장 최근 세션으로 진입, 없으면 새 세션 생성
        const sessions = await api.listSessions();
        if (cancelled) return;
        if (sessions.length > 0) {
          router.replace(`/chat/${sessions[0].id}`);
        } else {
          const s = await api.createSession();
          if (cancelled) return;
          router.replace(`/chat/${s.id}`);
        }
      } catch {
        // 인증 실패 시 api.ts가 /login으로 redirect 처리
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      <span className="text-sm">대화창을 준비하는 중...</span>
    </div>
  );
}
