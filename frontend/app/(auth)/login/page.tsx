"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Loader2, Stethoscope, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다");
        return;
      }
      router.push("/chat");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 transition-all">
      <h2 className="text-2xl font-bold text-gray-900">로그인</h2>
      <p className="text-sm text-gray-500 mt-1">계정에 접속하여 대화를 이어가세요.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">이메일 또는 ID</label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              type="text"
              autoComplete="username"
              placeholder="you@example.com 또는 admin"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">비밀번호</label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full h-11 text-base">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          로그인
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        계정이 없으신가요?{" "}
        <Link href="/register" className="text-indigo-600 font-medium hover:underline">
          회원가입
        </Link>
      </p>

      <p className="text-xs text-gray-400 mt-8 text-center inline-flex items-center justify-center gap-1.5 w-full">
        <Stethoscope className="w-3.5 h-3.5" />
        <span>처방·진단을 대신하지 않습니다.</span>
      </p>
    </div>
  );
}
