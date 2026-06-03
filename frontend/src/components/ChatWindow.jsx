import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

function AiLogo({ size = 64 }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(50,203,148,0.15)' }} />
      <div className="absolute rounded-full flex items-center justify-center font-bold" style={{ inset: size * 0.12, background: '#32CB94', color: '#191C1F', fontSize: size * 0.35 }}>+</div>
    </div>
  );
}

export default function ChatWindow({ messages, isLoading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ gap: '20px', padding: '0 24px' }}>
        <AiLogo size={80} />
        <p style={{ fontSize: '42px', fontWeight: 700, color: '#EBEFF3', letterSpacing: '-1px', lineHeight: 1.15, margin: 0 }}>
          의약품 · 건강기능식품
        </p>
        <p style={{ fontSize: '42px', fontWeight: 700, color: '#32CB94', letterSpacing: '-1px', lineHeight: 1.15, margin: 0 }}>
          상호작용 AI 에이전트
        </p>
        <p style={{ fontSize: '16px', color: '#87929F', marginTop: '4px' }}>
          나이, 증상, 복용 중인 약을 알려주시면 맞춤 추천을 해드립니다.
        </p>
      </div>
    );
  }

  // 첫 토큰을 기다리는 동안에만 '생각 중' 점을 보여준다.
  // (스트리밍이 시작돼 답변 버블이 채워지는 중에는 중복이라 숨긴다)
  const last = messages[messages.length - 1];
  const showThinking = isLoading && (!last || last.role !== 'assistant' || !last.content);

  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center" style={{ padding: '32px 0' }}>
      <div style={{ width: '100%', maxWidth: '760px', padding: '0 28px' }}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {showThinking && (
          <div className="flex gap-3 mb-6">
            <div className="relative shrink-0" style={{ width: 36, height: 36 }}>
              <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(50,203,148,0.2)' }} />
              <div className="absolute rounded-full flex items-center justify-center font-bold text-sm" style={{ inset: 5, background: '#32CB94', color: '#191C1F' }}>+</div>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-3 rounded-xl" style={{ background: '#24282D', border: '1px solid #33383E' }}>
              {[0, 150, 300].map((delay) => (
                <span key={delay} className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#87929F', animationDelay: `${delay}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
