import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { ProductCard } from "./ProductCard";
import { ToolEvent } from "./ToolEvent";

export type ChatItem =
  | {
      kind: "msg";
      role: "user" | "assistant";
      content: string;
      products?: {
        name: string;
        source: string;
        item_code?: string;
        company?: string;
        image_url?: string;
        snippet?: string;
      }[];
    }
  | { kind: "tool"; phase: string; name?: string; input?: { query?: string } };

export function MessageList({ items }: { items: ChatItem[] }) {
  // 마지막 user 메시지 인덱스 — 새로고침 시 이 말풍선이 화면 상단에 오도록 마킹
  const lastUserIdx = items.reduce(
    (acc, it, i) => (it.kind === "msg" && it.role === "user" ? i : acc),
    -1,
  );
  return (
    <div className="flex flex-col gap-2 w-full px-8">
      {items.map((item, i) => {
        if (item.kind === "tool")
          return (
            <ToolEvent
              key={i}
              phase={item.phase}
              name={item.name}
              input={item.input}
            />
          );
        const isUser = item.role === "user";
        const isLastUser = isUser && i === lastUserIdx;
        return (
          <div
            key={i}
            data-last-user-msg={isLastUser ? "true" : undefined}
            className={`flex ${isUser ? "justify-end" : "justify-start"} scroll-mt-4`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                isUser
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-gray-200 text-gray-900"
              }`}
            >
              <div
                className={`prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 ${
                  isUser
                    ? "prose-invert prose-p:text-white prose-strong:text-white prose-headings:text-white"
                    : "prose-gray prose-strong:text-gray-900"
                }`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                >
                  {item.content}
                </ReactMarkdown>
              </div>
              {item.products?.map((p, j) => (
                <ProductCard key={j} p={p} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
