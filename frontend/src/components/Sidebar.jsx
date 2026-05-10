import HealthProfile from './HealthProfile';

export default function Sidebar({ conversations, activeId, onSelect, onNew, onLogout, profile, onProfileChange }) {
  return (
    <aside className="flex flex-col h-full shrink-0" style={{ width: '280px', background: '#121518' }}>
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: 'rgba(50,203,148,0.2)' }}>
          <span style={{ color: '#32CB94', fontSize: '20px', fontWeight: 700, lineHeight: 1 }}>+</span>
        </div>
        <span style={{ color: '#EBEFF3', fontSize: '18px', fontWeight: 600 }}>약톡 AI</span>
        <span style={{ background: 'rgba(50,203,148,0.15)', color: '#32CB94', fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: 99 }}>Beta</span>
      </div>

      <div className="mx-4 mb-3" style={{ height: '1px', background: '#33383E' }} />

      {/* Health Profile Toggle */}
      <HealthProfile profile={profile} onChange={onProfileChange} />

      <div className="mx-4 mb-3" style={{ height: '1px', background: '#33383E' }} />

      {/* New Chat */}
      <div className="px-4 mb-4">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 rounded-xl font-medium transition-colors"
          style={{ background: '#24282D', color: '#EBEFF3', border: '1px solid #33383E', fontSize: '15px', padding: '12px 16px' }}
        >
          <span style={{ color: '#32CB94', fontSize: '18px', lineHeight: 1 }}>+</span>
          새 상담
        </button>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto px-4">
        {conversations.length > 0 && (
          <p style={{ color: '#87929F', fontSize: '12px', fontWeight: 500, marginBottom: '8px', paddingLeft: '4px' }}>최근 상담</p>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className="w-full flex items-center gap-2.5 rounded-xl mb-1.5 text-left truncate transition-colors"
            style={
              conv.id === activeId
                ? { background: '#24282D', color: '#EBEFF3', border: '1px solid #33383E', fontSize: '14px', padding: '10px 14px' }
                : { color: '#87929F', fontSize: '14px', padding: '10px 14px' }
            }
          >
            <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: conv.id === activeId ? '#32CB94' : '#33383E' }} />
            <span className="truncate">{conv.title}</span>
          </button>
        ))}
      </div>

      {/* Disclaimer + Logout */}
      <div className="mx-4 mb-4 space-y-2">
        <div className="rounded-xl" style={{ background: '#24282D', color: '#87929F', fontSize: '12px', lineHeight: 1.6, padding: '12px 14px' }}>
          ⚠ 본 서비스는 참고용이며<br />전문의 상담을 권장합니다.
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full rounded-xl text-left transition-colors"
            style={{ color: '#87929F', fontSize: '13px', padding: '10px 14px', border: '1px solid #33383E' }}
          >
            로그아웃
          </button>
        )}
      </div>
    </aside>
  );
}
