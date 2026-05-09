import { Search, CheckCircle2 } from "lucide-react";

export function ToolEvent({
  phase,
  name,
  input,
}: {
  phase: string;
  name?: string;
  input?: { query?: string };
}) {
  const isStart = phase === "tool-started";
  const Icon = isStart ? Search : CheckCircle2;
  const colorClass = isStart ? "text-indigo-500" : "text-emerald-500";
  const label = isStart ? `${name} 검색중...` : `${name} 완료`;

  return (
    <div className="text-xs text-gray-500 italic my-1 inline-flex items-center gap-1.5">
      <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
      <span>{label}</span>
      {input?.query && (
        <span className="text-gray-400">— &quot;{input.query}&quot;</span>
      )}
    </div>
  );
}
