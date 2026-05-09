"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, CheckCircle2, Loader2, Stethoscope, AlertCircle, ChevronDown, ChevronUp, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [piiConsent, setPiiConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // 선택 입력 필드
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [symptomsNote, setSymptomsNote] = useState("");
  const [currentMedications, setCurrentMedications] = useState("");
  const [allergies, setAllergies] = useState("");

  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!piiConsent) {
      setError("개인정보 처리 동의가 필요합니다");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          pii_consent: piiConsent,
          name: name || null,
          age: age ? Number(age) : null,
          gender: gender || null,
          symptoms_note: symptomsNote || null,
          current_medications: currentMedications || null,
          allergies: allergies || null,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        setError(`가입 실패: ${t || res.status}`);
        return;
      }
      router.push("/chat");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 transition-all">
      <h2 className="text-2xl font-bold text-gray-900">회원가입</h2>
      <p className="text-sm text-gray-500 mt-1">새 계정을 만들어 시작하세요.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">이메일</label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">비밀번호 (8자 이상)</label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input type="password" placeholder="••••••••" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" />
          </div>
        </div>

        {/* 선택 프로필 입력 (토글) */}
        <button
          type="button"
          onClick={() => setShowProfile((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
        >
          <span className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-indigo-600" />
            프로필 정보 (선택, 더 정확한 추천을 위해)
          </span>
          {showProfile ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showProfile && (
          <div className="space-y-3 pl-1 pr-1 pt-1 pb-2">
            <div>
              <label className="text-xs font-medium text-gray-600">이름</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">나이</label>
                <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="30" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">성별</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <option value="">선택안함</option>
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                  <option value="other">기타</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">증상 / 특이사항</label>
              <Textarea value={symptomsNote} onChange={(e) => setSymptomsNote(e.target.value)} placeholder="예: 평소 위가 약함, 카페인 민감" rows={2} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">복용 중인 약물</label>
              <Textarea value={currentMedications} onChange={(e) => setCurrentMedications(e.target.value)} placeholder="예: 아스피린 100mg (매일 아침)" rows={2} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">알레르기</label>
              <Textarea value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="예: 페니실린, 견과류" rows={2} className="mt-1" />
            </div>
            <p className="text-xs text-gray-400">이 정보는 가입 후 언제든 프로필에서 수정할 수 있습니다.</p>
          </div>
        )}

        <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
          <input type="checkbox" checked={piiConsent} onChange={(e) => setPiiConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-600 shrink-0" />
          <span className="text-xs text-gray-700 leading-relaxed">
            <span className="font-medium flex items-center gap-1 text-gray-900 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              개인정보 처리 동의 (필수)
            </span>
            입력하신 증상·질문은 본 서비스에 안전하게 저장되며 본인의 대화 기록 확인 외 다른 목적으로는 사용되지 않습니다.
          </span>
        </label>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" disabled={loading || !piiConsent} className="w-full h-11 text-base">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          가입하기
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-indigo-600 font-medium hover:underline">
          로그인
        </Link>
      </p>

      <p className="text-xs text-gray-400 mt-8 text-center inline-flex items-center justify-center gap-1.5 w-full">
        <Stethoscope className="w-3.5 h-3.5" />
        <span>처방·진단을 대신하지 않습니다.</span>
      </p>
    </div>
  );
}
