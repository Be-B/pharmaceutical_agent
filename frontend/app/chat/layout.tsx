"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Plus, Settings, LogOut, FileText, Pill } from "lucide-react";
import { api, Session, UserProfile } from "@/lib/api";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch(() => router.push("/login"));
    api
      .listSessions()
      .then(setSessions)
      .catch(() => {});
  }, [router, pathname]);

  // 자동 제목 생성 등으로 세션 메타가 바뀌면 사이드바 즉시 갱신
  useEffect(() => {
    function reload() {
      api.listSessions().then(setSessions).catch(() => {});
    }
    window.addEventListener("sessions:changed", reload);
    return () => window.removeEventListener("sessions:changed", reload);
  }, []);

  async function newSession() {
    const s = await api.createSession();
    setSessions((prev) => [s, ...prev]);
    router.push(`/chat/${s.id}`);
  }

  async function logout() {
    await api.logout();
    router.push("/login");
  }

  const activeId = pathname?.match(/\/chat\/([^/]+)/)?.[1];

  return (
    <>
      <div className="flex h-screen bg-gray-50">
        <aside className="w-72 border-r border-gray-200 bg-white flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Pill className="w-5 h-5 text-indigo-600" />
              <h1 className="text-sm font-semibold text-gray-700">
                의약품 정보 도우미
              </h1>
            </div>
            <Button
              onClick={newSession}
              className="w-full shadow-sm"
            >
              <Plus className="w-4 h-4" />
              새 대화
            </Button>
          </div>

          {/* Session list */}
          <nav className="flex-1 overflow-auto p-2 space-y-0.5">
            {sessions.length === 0 && (
              <div className="text-xs text-gray-400 p-4 text-center">
                대화 기록이 없습니다
              </div>
            )}
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/chat/${s.id}`}
                className={cn(
                  "block px-3 py-2 rounded-lg text-sm truncate transition",
                  activeId === String(s.id)
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "hover:bg-gray-100 text-gray-700"
                )}
              >
                {s.title}
              </Link>
            ))}
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-gray-100">
            <button
              onClick={() => setProfileOpen(true)}
              className="w-full text-left p-2.5 rounded-lg hover:bg-gray-100 transition group"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                  {(me?.name || me?.email || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {me?.name || me?.email}
                  </div>
                  <div className="text-xs text-gray-400 group-hover:text-indigo-500 transition flex items-center gap-1">
                    <Settings className="w-3 h-3" />
                    프로필 / 증상 편집
                  </div>
                </div>
              </div>
            </button>
            <div className="flex gap-2 mt-1.5 px-1 items-center">
              <Link
                href="/prompts"
                className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                title={me?.role === "admin" ? "프롬프트 관리" : "관리자 권한 필요"}
              >
                <FileText className="w-3 h-3" />
                프롬프트 관리
                {me && me.role !== "admin" && (
                  <span className="text-gray-400 ml-0.5">(관리자)</span>
                )}
              </Link>
              <button
                onClick={logout}
                className="text-xs text-red-500 hover:underline ml-auto flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                로그아웃
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
      </div>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSaved={(p) => setMe(p)}
      />
    </>
  );
}
