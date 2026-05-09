export type DonePayload = {
  message_id?: number;
  prompt_version_id?: number | null;
  /** 첫 응답에서 자동 생성된 세션 제목. 미생성이면 null. */
  session_title?: string | null;
};

export type SSECallbacks = {
  onToken?: (text: string) => void;
  onTool?: (event: { phase: string; tool_name?: string; input?: unknown }) => void;
  onDone?: (payload: DonePayload) => void;
  onError?: (err: { message: string } | Error) => void;
};

export async function streamSSE(
  url: string,
  body: unknown,
  callbacks: SSECallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    callbacks.onError?.(e as Error);
    return;
  }
  if (!res.ok || !res.body) {
    callbacks.onError?.({ message: `HTTP ${res.status}` });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE 이벤트 구분자: LF/CRLF 둘 다 허용 (sse-starlette은 CRLF 사용)
      const blocks = buf.split(/\r?\n\r?\n/);
      buf = blocks.pop() || "";
      for (const block of blocks) parseBlock(block, callbacks);
    }
    if (buf.trim()) parseBlock(buf, callbacks);
  } catch (e) {
    if ((e as { name?: string }).name !== "AbortError")
      callbacks.onError?.(e as Error);
  }
}

function parseBlock(block: string, cb: SSECallbacks) {
  let event = "message";
  let data = "";
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return;
  let payload: { text?: string; phase?: string; tool_name?: string; input?: unknown; message?: string };
  try {
    payload = JSON.parse(data);
  } catch {
    payload = { text: data };
  }
  if (event === "token") cb.onToken?.(payload.text || "");
  else if (event === "tool")
    cb.onTool?.(payload as { phase: string; tool_name?: string; input?: unknown });
  else if (event === "done") cb.onDone?.(payload as DonePayload);
  else if (event === "error") cb.onError?.(payload as { message: string });
}
