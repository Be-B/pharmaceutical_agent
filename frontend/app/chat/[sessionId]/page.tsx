"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MessageSquareDashed } from "lucide-react";
import { api, Msg, ApiError } from "@/lib/api";
import { streamSSE } from "@/lib/sse";
import { MessageList, ChatItem } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Stethoscope } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatSession() {
  const params = useParams<{ sessionId: string }>();
  const sid = params.sessionId;
  const [items, setItems] = useState<ChatItem[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [typing, setTyping] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [notFound, setNotFound] = useState(false);

  // 세션 메시지 로드 — 권한 없거나 없는 세션이면 명시적 안내 표시
  useEffect(() => {
    setItems([]);
    setTyping(false);
    setStreaming(false);
    setNotFound(false);
    api.listMessages(sid)
      .then((msgs: Msg[]) => {
        setItems(
          msgs.map((m) => ({
            kind: "msg" as const,
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        );
      })
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
          setNotFound(true);
        }
      });
    return () => abortRef.current?.abort();
  }, [sid]);

  // 스크롤 정책:
  // - 새로고침/세션 진입(스트리밍 아님): 마지막 user 말풍선이 화면 상단에 오도록 즉시 점프
  // - 스트리밍 중: 어시스턴트 답변이 흐르는 하단을 부드럽게 따라감
  useEffect(() => {
    const lastUser = document.querySelector<HTMLElement>("[data-last-user-msg]");
    if (!streaming && lastUser) {
      // paint 직후 점프 (DOM이 채워진 시점 보장)
      requestAnimationFrame(() => {
        lastUser.scrollIntoView({ behavior: "auto", block: "start" });
      });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [items, typing, streaming]);

  async function send(text: string) {
    // Add user message immediately
    setItems((prev) => [
      ...prev,
      { kind: "msg", role: "user", content: text },
    ]);
    setStreaming(true);
    setTyping(true);

    abortRef.current = new AbortController();
    let buf = "";
    let assistantAdded = false;

    await streamSSE(
      `${BASE}/chat/sessions/${sid}/messages`,
      { content: text },
      {
        onToken: (t) => {
          buf += t;
          if (!assistantAdded) {
            // First token: remove typing indicator, add assistant bubble
            setTyping(false);
            setItems((prev) => [
              ...prev,
              { kind: "msg", role: "assistant", content: buf },
            ]);
            assistantAdded = true;
          } else {
            // Subsequent tokens: update last assistant bubble
            setItems((prev) => {
              const out = [...prev];
              const last = out[out.length - 1];
              if (last.kind === "msg" && last.role === "assistant") {
                out[out.length - 1] = { ...last, content: buf };
              }
              return out;
            });
          }
        },
        onTool: (e) => {
          setItems((prev) => {
            const out = [...prev];
            // Insert tool event before the (possibly not yet created) assistant bubble
            const insertAt = assistantAdded ? out.length - 1 : out.length;
            out.splice(insertAt, 0, {
              kind: "tool",
              phase: e.phase,
              name: e.tool_name,
              input: e.input as { query?: string } | undefined,
            });
            return out;
          });
        },
        onDone: (payload) => {
          setStreaming(false);
          setTyping(false);
          // 첫 응답이면 백엔드가 session_title을 채워줌 → 사이드바 새로고침 신호
          if (payload?.session_title) {
            window.dispatchEvent(new CustomEvent("sessions:changed"));
          }
        },
        onError: () => {
          setStreaming(false);
          setTyping(false);
        },
      },
      abortRef.current.signal,
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center">
        <MessageSquareDashed className="w-12 h-12 text-gray-300 mb-3" />
        <h2 className="text-lg font-semibold text-gray-700">대화를 찾을 수 없습니다</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">
          이 대화는 삭제되었거나 접근 권한이 없습니다.
          좌측 사이드바에서 다른 대화를 선택하거나 <b>새 대화</b>를 시작하세요.
        </p>
        <Link
          href="/chat"
          className="mt-5 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
        >
          채팅 홈으로
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message area */}
      <div className="flex-1 overflow-auto py-6">
        <MessageList items={items} />
        {typing && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 px-4 py-3 bg-white">
        <div className="px-4">
          <MessageInput onSend={send} disabled={streaming} />
          <p className="text-xs text-gray-400 mt-2 text-center inline-flex items-center justify-center gap-1.5 w-full">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>처방·진단을 대신하지 않습니다.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
