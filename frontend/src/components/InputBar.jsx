import { useState, useRef } from 'react';

export default function InputBar({ onSend, isLoading }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px';
  };

  const active = input.trim() && !isLoading;

  return (
    <div className="flex flex-col items-center" style={{ background: '#191C1F', padding: '8px 28px 20px' }}>
      <div style={{ width: '100%', maxWidth: '760px' }}>
        <div
          className="flex items-end gap-2.5 rounded-2xl transition-colors"
          style={{ background: '#24282D', border: `1px solid ${active ? '#32CB94' : '#33383E'}`, padding: '14px 14px 14px 18px' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="나이, 증상, 현재 복용약을 알려주세요..."
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none max-h-[200px] overflow-y-auto"
            style={{ color: '#EBEFF3', fontSize: '15px', lineHeight: 1.5 }}
          />
          <button
            onClick={handleSubmit}
            disabled={!active}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: active ? '#32CB94' : '#33383E',
              color: active ? '#191C1F' : '#87929F',
              cursor: active ? 'pointer' : 'not-allowed',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 4l8 8H4l8-8zM12 4v16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs mt-2.5" style={{ color: '#87929F' }}>
          Enter로 전송 · Shift+Enter 줄바꿈 · 본 서비스는 참고용입니다
        </p>
      </div>
    </div>
  );
}
