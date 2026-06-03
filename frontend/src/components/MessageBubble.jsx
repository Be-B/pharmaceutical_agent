import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function AiLogo() {
  return (
    <div className="relative shrink-0 mt-0.5" style={{ width: 34, height: 34 }}>
      <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(50,203,148,0.2)' }} />
      <div className="absolute rounded-full flex items-center justify-center font-bold text-sm" style={{ inset: 5, background: '#32CB94', color: '#191C1F' }}>+</div>
    </div>
  );
}

// 마크다운 → 다크 테마 컴포넌트. 본문은 15px / line-height 1.7 로 통일.
const markdownComponents = {
  h1: ({ children }) => <h1 style={{ color: '#EBEFF3', fontSize: '18px', fontWeight: 700, margin: '18px 0 8px' }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ color: '#EBEFF3', fontSize: '16px', fontWeight: 700, margin: '16px 0 6px' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ color: '#32CB94', fontSize: '15px', fontWeight: 700, margin: '14px 0 6px' }}>{children}</h3>,
  p: ({ children }) => <p style={{ color: '#EBEFF3', fontSize: '15px', lineHeight: 1.7, margin: '8px 0' }}>{children}</p>,
  strong: ({ children }) => <strong style={{ color: '#EBEFF3', fontWeight: 700 }}>{children}</strong>,
  em: ({ children }) => <em style={{ color: '#C7D0DA' }}>{children}</em>,
  ul: ({ children }) => <ul style={{ paddingLeft: '20px', margin: '8px 0', color: '#EBEFF3', listStyle: 'disc' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: '20px', margin: '8px 0', color: '#EBEFF3' }}>{children}</ol>,
  li: ({ children }) => <li style={{ fontSize: '15px', lineHeight: 1.7, margin: '3px 0', color: '#EBEFF3' }}>{children}</li>,
  // react-markdown v10은 inline 구분 prop을 주지 않는다. 인라인 코드는 초록 pill,
  // 펜스 코드블록은 아래 pre가 감싸므로(둘 다 #191C1F 배경) 자연스럽게 블록처럼 보인다.
  code: ({ children }) => (
    <code style={{ background: '#191C1F', color: '#32CB94', padding: '1px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'ui-monospace, monospace' }}>{children}</code>
  ),
  pre: ({ children }) => (
    <pre style={{ background: '#191C1F', border: '1px solid #33383E', borderRadius: '8px', padding: '12px 14px', margin: '10px 0', overflowX: 'auto' }}>{children}</pre>
  ),
  blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #32CB94', paddingLeft: '12px', margin: '10px 0', color: '#A6B0BC' }}>{children}</blockquote>,
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #33383E', margin: '14px 0' }} />,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: '#32CB94', textDecoration: 'underline', wordBreak: 'break-all' }}>{children}</a>,
  img: ({ src, alt }) => (
    <img src={src} alt={alt} loading="lazy" style={{ display: 'block', maxWidth: '180px', width: '100%', height: 'auto', borderRadius: '8px', border: '1px solid #33383E', margin: '10px 0' }} />
  ),
  // GFM 표 — 가로 스크롤 래퍼로 감싸 폭이 넘쳐도 레이아웃이 깨지지 않게.
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '12px 0' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13.5px' }}>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  th: ({ children }) => <th style={{ background: '#191C1F', color: '#EBEFF3', fontWeight: 700, textAlign: 'left', padding: '8px 12px', border: '1px solid #33383E', whiteSpace: 'nowrap' }}>{children}</th>,
  td: ({ children }) => <td style={{ color: '#D4DBE3', padding: '8px 12px', border: '1px solid #33383E', verticalAlign: 'top', lineHeight: 1.6 }}>{children}</td>,
};

export default function MessageBubble({ message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isUser) {
    return (
      <div className="flex justify-end items-start gap-2.5 mb-6">
        <div
          className="rounded-2xl rounded-tr-sm"
          style={{ maxWidth: '78%', background: '#2F8F69', color: '#F3F8F5', fontSize: '15px', lineHeight: 1.65, padding: '11px 15px', overflowWrap: 'anywhere' }}
        >
          {message.content}
        </div>
        <div className="shrink-0 flex items-center justify-center rounded-full mt-0.5" style={{ width: 34, height: 34, background: 'rgba(50,203,148,0.18)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" fill="#32CB94" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#32CB94" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-6">
      <AiLogo />
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm" style={{ background: '#24282D', border: '1px solid #33383E', padding: '14px 16px', overflowWrap: 'anywhere' }}>
          {message.profileContext && (
            <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(50,203,148,0.08)', color: '#32CB94' }}>
              프로필 기준: {message.profileContext}
            </div>
          )}
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
          {message.warning && (
            <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(254,193,68,0.08)', color: '#FEC144', border: '1px solid rgba(254,193,68,0.3)' }}>
              ⚠ {message.warning}
            </div>
          )}
        </div>
        {message.content && (
          <div className="flex items-center gap-3 mt-2 px-1">
            <button onClick={handleCopy} className="text-xs transition-colors" style={{ color: copied ? '#32CB94' : '#87929F' }}>
              {copied ? '복사됨 ✓' : '복사'}
            </button>
            <button className="text-xs" style={{ color: '#87929F' }}>👍</button>
            <button className="text-xs" style={{ color: '#87929F' }}>👎</button>
          </div>
        )}
      </div>
    </div>
  );
}
