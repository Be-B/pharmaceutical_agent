import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

function AiLogo() {
  return (
    <div className="relative shrink-0 mt-1" style={{ width: 36, height: 36 }}>
      <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(50,203,148,0.2)' }} />
      <div className="absolute rounded-full flex items-center justify-center font-bold text-sm" style={{ inset: 5, background: '#32CB94', color: '#191C1F' }}>+</div>
    </div>
  );
}

const markdownComponents = {
  h1: ({ children }) => <h1 style={{ color: '#EBEFF3', fontSize: '18px', fontWeight: 700, margin: '16px 0 8px' }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ color: '#EBEFF3', fontSize: '16px', fontWeight: 700, margin: '14px 0 6px' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ color: '#32CB94', fontSize: '15px', fontWeight: 600, margin: '12px 0 6px' }}>{children}</h3>,
  p: ({ children }) => <p style={{ color: '#EBEFF3', fontSize: '14px', lineHeight: 1.75, margin: '6px 0' }}>{children}</p>,
  strong: ({ children }) => <strong style={{ color: '#EBEFF3', fontWeight: 600 }}>{children}</strong>,
  ul: ({ children }) => <ul style={{ paddingLeft: '18px', margin: '6px 0', color: '#EBEFF3' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: '18px', margin: '6px 0', color: '#EBEFF3' }}>{children}</ol>,
  li: ({ children }) => <li style={{ fontSize: '14px', lineHeight: 1.75, marginBottom: '4px', color: '#EBEFF3' }}>{children}</li>,
  code: ({ children }) => <code style={{ background: '#191C1F', color: '#32CB94', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}>{children}</code>,
  blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #32CB94', paddingLeft: '12px', margin: '8px 0', color: '#87929F' }}>{children}</blockquote>,
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #33383E', margin: '12px 0' }} />,
  img: ({ src, alt }) => (
    <div style={{ margin: '10px 0' }}>
      <img src={src} alt={alt} style={{ maxWidth: '200px', borderRadius: '8px', border: '1px solid #33383E' }} />
    </div>
  ),
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: '#32CB94', textDecoration: 'underline' }}>{children}</a>,
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
      <div className="flex justify-end items-end gap-2.5 mb-14">
        <div className="max-w-[62%] rounded-2xl rounded-br-sm leading-relaxed" style={{ background: '#2f7a5e', color: '#EBEFF3', border: '1px solid rgba(50,203,148,0.3)', lineHeight: 1.75, fontSize: '17px', padding: '18px 22px' }}>
          {message.content}
        </div>
        <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: 'rgba(50,203,148,0.2)', border: '1px solid rgba(50,203,148,0.3)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" fill="#32CB94"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#32CB94" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-8">
      <AiLogo />
      <div className="flex-1 min-w-0">
        <div className="rounded-xl p-4" style={{ background: '#24282D', border: '1px solid #33383E' }}>
          {message.profileContext && (
            <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(50,203,148,0.08)', color: '#32CB94' }}>
              프로필 기준: {message.profileContext}
            </div>
          )}
          <ReactMarkdown components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
          {message.warning && (
            <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(254,193,68,0.08)', color: '#FEC144', border: '1px solid rgba(254,193,68,0.3)' }}>
              ⚠ {message.warning}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 px-1">
          <button onClick={handleCopy} className="text-xs transition-colors" style={{ color: copied ? '#32CB94' : '#87929F' }}>
            {copied ? '복사됨 ✓' : '복사'}
          </button>
          <button className="text-xs" style={{ color: '#87929F' }}>👍</button>
          <button className="text-xs" style={{ color: '#87929F' }}>👎</button>
        </div>
      </div>
    </div>
  );
}
