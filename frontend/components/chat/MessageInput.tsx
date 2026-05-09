"use client";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MessageInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 마운트 시 자동 포커스
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // 스트리밍이 끝나면(disabled true → false) 입력창으로 포커스 복귀
  useEffect(() => {
    if (!disabled) textareaRef.current?.focus();
  }, [disabled]);

  function submit() {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
    // 보낸 직후에도 포커스 유지 — disabled로 바뀌어도 textarea 자체는 enabled라 그대로 유지됨
    textareaRef.current?.focus();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // IME 조합 중(한글 입력 중)일 때는 Enter를 무시 — 한글 마지막 글자 잘림 방지
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form className="flex items-end gap-2" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        rows={1}
        className={cn(
          "flex-1 border border-gray-200 rounded-2xl px-4 py-3 text-sm resize-none shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
          "transition leading-relaxed",
        )}
        style={{ maxHeight: "120px", overflowY: "auto" }}
        placeholder="의약품, 증상, 복용법 등 무엇이든 물어보세요 (Shift+Enter로 줄바꿈)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        // 스트리밍 중에도 다음 메시지를 미리 작성할 수 있도록 textarea 자체는 비활성화하지 않음
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !text.trim()}
        className="flex-shrink-0 rounded-full shadow-sm"
        aria-label="보내기"
      >
        <Send className="w-4 h-4" />
      </Button>
    </form>
  );
}
