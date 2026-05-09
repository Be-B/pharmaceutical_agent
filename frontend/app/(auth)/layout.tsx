import { Pill, Stethoscope, Lock, Sparkles } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* 좌측 브랜드 패널 — 데스크톱만 */}
      <aside className="hidden md:flex md:w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white p-12 flex-col justify-between">
        <div>
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Pill className="w-7 h-7" />
            <span>의약품 정보 도우미</span>
          </Link>
          <h1 className="text-4xl font-bold mt-16 leading-tight">
            복잡한 약 정보,<br />한 줄 질문으로.
          </h1>
          <p className="text-indigo-100 mt-6 text-lg leading-relaxed">
            지금 필요한 약과 건강기능식품 정보를<br />
            가장 빠르고 정확하게 찾아드릴게요.
          </p>

          <div className="mt-10">
            <div className="flex items-center gap-2 text-sm font-medium text-indigo-200 mb-3">
              <Sparkles className="w-4 h-4" />
              <span>이렇게 물어보세요</span>
            </div>
            <ul className="space-y-2">
              <li className="bg-white/10 rounded-xl px-4 py-3 text-sm text-white backdrop-blur-sm border border-white/10">
                &ldquo;소화불량에 먹는 약 알려줘&rdquo;
              </li>
              <li className="bg-white/10 rounded-xl px-4 py-3 text-sm text-white backdrop-blur-sm border border-white/10">
                &ldquo;혈압약이랑 같이 먹으면 안 되는 건강기능식품 있어?&rdquo;
              </li>
              <li className="bg-white/10 rounded-xl px-4 py-3 text-sm text-white backdrop-blur-sm border border-white/10">
                &ldquo;관절에 좋은 오메가3 추천해줘&rdquo;
              </li>
            </ul>
          </div>
        </div>
        <div className="space-y-3 text-sm text-indigo-100 border-t border-white/20 pt-6">
          <div className="flex items-start gap-2">
            <Stethoscope className="w-4 h-4 mt-0.5 shrink-0 text-amber-300" />
            <p>처방·진단을 대신하지 않으며, 의료진과의 상담을 권장합니다.</p>
          </div>
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 mt-0.5 shrink-0 text-emerald-300" />
            <p>입력하신 정보는 본인 기기에만 안전하게 보관됩니다.</p>
          </div>
        </div>
      </aside>

      {/* 우측 폼 영역 */}
      <main className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
