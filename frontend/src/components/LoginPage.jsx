import { useState } from 'react';
import { authLogin } from '../api';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await authLogin(email, password);
      if (res.ok) {
        const data = await res.json();
        onLogin(data);
      } else {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center" style={{ background: '#191C1F' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center rounded-full mb-4" style={{ width: 56, height: 56, background: 'rgba(50,203,148,0.15)' }}>
            <div className="flex items-center justify-center rounded-full font-bold text-xl" style={{ width: 40, height: 40, background: '#32CB94', color: '#191C1F' }}>+</div>
          </div>
          <h1 style={{ color: '#EBEFF3', fontSize: '22px', fontWeight: 700 }}>약톡 AI</h1>
          <p style={{ color: '#87929F', fontSize: '14px', marginTop: 6 }}>의약품 · 건강기능식품 상호작용 에이전트</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label style={{ color: '#87929F', fontSize: '13px', display: 'block', marginBottom: 6 }}>아이디 / 이메일</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="아이디 또는 이메일을 입력하세요"
              className="w-full outline-none rounded-xl"
              style={{ background: '#24282D', color: '#EBEFF3', border: '1px solid #33383E', fontSize: '15px', padding: '12px 14px' }}
            />
          </div>
          <div>
            <label style={{ color: '#87929F', fontSize: '13px', display: 'block', marginBottom: 6 }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="w-full outline-none rounded-xl"
              style={{ background: '#24282D', color: '#EBEFF3', border: '1px solid #33383E', fontSize: '15px', padding: '12px 14px' }}
            />
          </div>

          {error && (
            <p style={{ color: '#FEC144', fontSize: '13px', textAlign: 'center' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-xl font-semibold transition-colors"
            style={{
              background: loading || !email || !password ? '#33383E' : '#32CB94',
              color: loading || !email || !password ? '#87929F' : '#191C1F',
              fontSize: '15px',
              padding: '13px',
              marginTop: 8,
              cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-center mt-6" style={{ color: '#87929F', fontSize: '12px' }}>
          ⚠ 본 서비스는 참고용이며 전문의 상담을 권장합니다.
        </p>
      </div>
    </div>
  );
}
