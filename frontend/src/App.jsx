import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import InputBar from './components/InputBar';
import LoginPage from './components/LoginPage';
import { authMe, authLogout, getSessions, createSession, getMessages, sendMessageStream } from './api';
import { parseSSE } from './sse';
import './index.css';

// VITE_API_URL이 없으면 Vercel 프록시(상대경로) 사용, 'mock'이면 mock 모드
const API_URL = import.meta.env.VITE_API_URL;
const USE_MOCK = API_URL === 'mock';

// ── Mock (백엔드 없을 때) ───────────────────────────────
const MOCK_RESPONSES = [
  { content: '프로필을 바탕으로 맞춤 추천을 드립니다.', recommendations: [{ name: '콜라겐 펩타이드', desc: '관절 연골 보호' }, { name: '글루코사민', desc: '관절 연골 재생' }, { name: '비타민 D3', desc: '뼈·관절 건강 유지' }], warning: '본 추천은 참고용입니다. 전문의와 상담하세요.' },
  { content: '말씀하신 약물과 건강기능식품의 상호작용을 확인했습니다.', recommendations: [{ name: '오메가3', desc: '혈압약과 병용 시 주의', safe: '주의 필요' }, { name: '마그네슘', desc: '혈압 조절에 도움', safe: '복용 안전' }], warning: '혈압약 복용 중이시라면 담당 의사와 상의하세요.' },
];

function buildProfileContext(profile) {
  const parts = [];
  if (profile.age) parts.push(`${profile.age}세`);
  if (profile.symptoms.length > 0) parts.push(profile.symptoms.join(', '));
  if (profile.medications) parts.push(`복용약: ${profile.medications}`);
  return parts.join(' · ');
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [profile, setProfile] = useState({ age: '', symptoms: [], medications: '' });

  // ── 인증 확인 ──────────────────────────────────────
  useEffect(() => {
    if (USE_MOCK) { setAuthLoading(false); return; }
    authMe()
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setUser(data); })
      .finally(() => setAuthLoading(false));
  }, []);

  // ── 세션 목록 로드 ──────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (USE_MOCK) return;
    const res = await getSessions();
    if (res.ok) {
      const data = await res.json();
      setSessions(data);
    }
  }, []);

  useEffect(() => {
    if (user) loadSessions();
  }, [user, loadSessions]);

  // ── 세션 선택 → 메시지 로드 ────────────────────────
  const handleSelect = useCallback(async (id) => {
    setActiveId(id);
    if (USE_MOCK) {
      const found = sessions.find((s) => s.id === id);
      setMessages(found?.messages ?? []);
      return;
    }
    const res = await getMessages(id);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.map((m) => ({ id: m.id, role: m.role, content: m.content })));
    }
  }, [sessions]);

  // ── 새 상담 ────────────────────────────────────────
  const handleNew = useCallback(() => {
    setActiveId(null);
    setMessages([]);
  }, []);

  // ── 로그아웃 ───────────────────────────────────────
  const handleLogout = useCallback(async () => {
    if (!USE_MOCK) await authLogout();
    setUser(null);
    setSessions([]);
    setActiveId(null);
    setMessages([]);
  }, []);

  // ── 메시지 전송 ────────────────────────────────────
  const handleSend = useCallback(async (text) => {
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    if (USE_MOCK) {
      // ── Mock 모드 ──────────────────────────────────
      await new Promise((r) => setTimeout(r, 800));
      const mock = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
      const ctx = buildProfileContext(profile);
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', profileContext: ctx || null, ...mock }]);
      setIsStreaming(false);

      // 로컬 세션 관리 (mock)
      if (!activeId) {
        const newId = `mock-${Date.now()}`;
        const newSession = { id: newId, title: text.slice(0, 28) + (text.length > 28 ? '...' : ''), messages: [userMsg] };
        setSessions((prev) => [newSession, ...prev]);
        setActiveId(newId);
      }
      return;
    }

    try {
      // ── 세션 생성 (첫 메시지일 때) ─────────────────
      let sessionId = activeId;
      if (!sessionId) {
        const res = await createSession(text.slice(0, 40));
        if (!res.ok) throw new Error('세션 생성 실패');
        const session = await res.json();
        sessionId = session.id;
        setActiveId(sessionId);
        await loadSessions();
      }

      // ── SSE 스트리밍 ───────────────────────────────
      const response = await sendMessageStream(sessionId, text);
      if (!response.ok) throw new Error('메시지 전송 실패');

      const assistantId = `a-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      for await (const { event, data } of parseSSE(response)) {
        if (event === 'token') {
          const piece = (data && data.text) || '';
          if (piece) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + piece } : m
              )
            );
          }
        } else if (event === 'done') {
          // 백엔드가 자동 생성한 세션 제목을 사이드바에 반영
          if (data && data.session_title) loadSessions();
          break;
        } else if (event === 'error') {
          throw new Error((data && data.message) || '스트리밍 오류');
        }
        // 'tool' 이벤트는 로딩 인디케이터로 충분하므로 무시
      }
    } catch (err) {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: `오류가 발생했습니다: ${err.message}` }]);
    } finally {
      setIsStreaming(false);
    }
  }, [activeId, profile, loadSessions]);

  // ── 렌더 ───────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#191C1F' }}>
        <div className="flex gap-1.5">
          {[0, 150, 300].map((d) => (
            <span key={d} className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: '#32CB94', animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!USE_MOCK && !user) {
    return <LoginPage onLogin={setUser} />;
  }

  const activeTitle = sessions.find((s) => s.id === activeId)?.title;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#191C1F' }}>
      <Sidebar
        conversations={sessions}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={handleNew}
        onLogout={!USE_MOCK ? handleLogout : null}
        profile={profile}
        onProfileChange={setProfile}
      />
      <main className="flex-1 flex flex-col min-w-0" style={{ background: '#191C1F' }}>
        <div className="flex items-center shrink-0" style={{ height: 64, padding: '0 24px', borderBottom: '1px solid #33383E' }}>
          <span className="truncate" style={{ color: '#EBEFF3', fontSize: '15px', fontWeight: 600 }}>
            {activeTitle || '새 상담'}
          </span>
        </div>
        <ChatWindow messages={messages} isLoading={isStreaming} />
        <InputBar onSend={handleSend} isLoading={isStreaming} />
      </main>
    </div>
  );
}
