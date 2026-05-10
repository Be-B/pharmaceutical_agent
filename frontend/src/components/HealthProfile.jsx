import { useState } from 'react';

const SYMPTOM_OPTIONS = ['관절 통증', '두통', '소화 불량', '피로감', '혈압', '당뇨', '불면증', '피부 트러블'];

export default function HealthProfile({ profile, onChange }) {
  const [open, setOpen] = useState(false);

  const toggleSymptom = (s) => {
    const next = profile.symptoms.includes(s)
      ? profile.symptoms.filter((x) => x !== s)
      : [...profile.symptoms, s];
    onChange({ ...profile, symptoms: next });
  };

  const hasSummary = profile.age || profile.symptoms.length > 0 || profile.medications;

  return (
    <div className="mx-4 mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-xl transition-colors"
        style={{
          background: open ? '#24282D' : 'transparent',
          border: '1px solid #33383E',
          padding: '12px 14px',
        }}
      >
        <div className="flex items-center gap-2.5">
          <span style={{ color: '#32CB94', fontSize: '16px' }}>⊕</span>
          <span style={{ color: '#EBEFF3', fontSize: '15px', fontWeight: 500 }}>내 건강 프로필</span>
        </div>
        <div className="flex items-center gap-2">
          {hasSummary && !open && (
            <span className="truncate max-w-[90px]" style={{ color: '#32CB94', fontSize: '12px' }}>
              {[profile.age && `${profile.age}세`, ...profile.symptoms.slice(0, 1)].filter(Boolean).join(' · ')}
            </span>
          )}
          <span style={{ color: '#32CB94', fontSize: '13px', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
        </div>
      </button>

      {open && (
        <div className="mt-1.5 rounded-xl space-y-3" style={{ background: '#24282D', border: '1px solid #33383E', padding: '14px' }}>
          <div>
            <label style={{ color: '#87929F', fontSize: '12px', display: 'block', marginBottom: '6px' }}>나이</label>
            <input
              type="number"
              placeholder="예: 35"
              value={profile.age}
              onChange={(e) => onChange({ ...profile, age: e.target.value })}
              className="w-full outline-none rounded-lg"
              style={{ background: '#191C1F', color: '#EBEFF3', border: '1px solid #33383E', fontSize: '14px', padding: '10px 12px' }}
            />
          </div>

          <div>
            <label style={{ color: '#87929F', fontSize: '12px', display: 'block', marginBottom: '6px' }}>증상 / 건강 관심사</label>
            <div className="flex flex-wrap gap-1.5">
              {SYMPTOM_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSymptom(s)}
                  className="rounded-full transition-colors"
                  style={
                    profile.symptoms.includes(s)
                      ? { background: 'rgba(50,203,148,0.15)', color: '#32CB94', border: '1px solid #32CB94', fontSize: '12px', padding: '5px 10px' }
                      : { background: '#191C1F', color: '#87929F', border: '1px solid #33383E', fontSize: '12px', padding: '5px 10px' }
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ color: '#87929F', fontSize: '12px', display: 'block', marginBottom: '6px' }}>복용 중인 약 (선택)</label>
            <input
              type="text"
              placeholder="예: 혈압약, 아스피린"
              value={profile.medications}
              onChange={(e) => onChange({ ...profile, medications: e.target.value })}
              className="w-full outline-none rounded-lg"
              style={{ background: '#191C1F', color: '#EBEFF3', border: '1px solid #33383E', fontSize: '14px', padding: '10px 12px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
