// Server-Sent Events 스트림 파서.
//
// 백엔드(sse-starlette)는 이벤트를 다음 형식으로 보낸다:
//   event: <type>\n
//   data: <json>\n
//   \n               ← 빈 줄이 이벤트 경계
//
// 핵심: 이벤트 "타입"은 `event:` 줄에 들어있다(`data:` JSON 안이 아님).
// 이전 구현은 `data:`만 읽고 `event:`를 버려서, 토큰을 끝까지 못 골라냈다.
//
// 각 이벤트를 { event, data } 로 yield 한다.
//   - token  → { event: 'token', data: { text } }
//   - tool   → { event: 'tool',  data: { phase, tool_name, input } }
//   - done   → { event: 'done',  data: { message_id, prompt_version_id, session_title } }
//   - error  → { event: 'error', data: { message } }
export async function* parseSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (block) => {
    let eventType = 'message';
    const dataLines = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventType = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    if (dataLines.length === 0) return null;
    const raw = dataLines.join('\n');
    if (raw === '[DONE]') return null;
    let data = raw;
    try { data = JSON.parse(raw); } catch { /* JSON이 아니면 raw 문자열 유지 */ }
    return { event: eventType, data };
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const ev = dispatch(block);
      if (ev) yield ev;
    }
  }
  // 스트림 종료 후 버퍼에 남은 마지막 이벤트 flush
  const tail = buffer.replace(/\r\n/g, '\n').trim();
  if (tail) {
    const ev = dispatch(tail);
    if (ev) yield ev;
  }
}
