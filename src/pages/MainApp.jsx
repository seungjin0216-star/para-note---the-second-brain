import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useItems, useUserTags } from '../hooks/useItems';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { AI_ENDPOINT, AI_WEEKLY_ENDPOINT, AI_RECOMMEND_ENDPOINT } from '../constants';

/* ─── 유틸 ─── */
const dday = d => { if (!d) return null; return Math.ceil((new Date(d) - new Date()) / 86400000); };
const pct = cs => { if (!cs?.length) return null; return Math.round(cs.filter(c => c.d).length / cs.length * 100); };
const isYT = u => u && (u.includes('youtube') || u.includes('youtu.be'));
const isIG = u => u && u.includes('instagram');
const today = () => new Date().toISOString().slice(0, 10);

/* ─── 색상 ─── */
const TAG_PALETTE = ['#7C3AED','#0D9488','#D97706','#DC2626','#2563EB','#059669','#9333EA','#DB2777','#EA580C','#65A30D','#0891B2','#B45309','#6D28D9','#0369A1','#7C3AED'];
const tagColor = (t, allTags) => TAG_PALETTE[allTags.indexOf(t) % TAG_PALETTE.length] || '#7C3AED';

/* ─── Tag 칩 ─── */
function Tag({ label, selected, onToggle, size = 'md', allTags = [] }) {
  const c = tagColor(label, allTags);
  return (
    <button
      onClick={() => onToggle && onToggle(label)}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: size === 'sm' ? '3px 9px' : '5px 13px',
        borderRadius: 20, border: `1.5px solid ${selected ? c : 'rgba(0,0,0,.12)'}`,
        background: selected ? c : 'transparent',
        color: selected ? 'white' : '#555',
        fontSize: size === 'sm' ? 11 : 13, fontWeight: selected ? 600 : 400,
        cursor: onToggle ? 'pointer' : 'default', flexShrink: 0, whiteSpace: 'nowrap',
        transition: 'all .12s',
      }}
    >#{label}</button>
  );
}

/* ─── D-day 뱃지 ─── */
function DDay({ due }) {
  const d = dday(due); if (d === null) return null;
  const [c, bg] = d < 0 ? ['#DC2626','rgba(220,38,38,.1)'] : d <= 5 ? ['#D97706','rgba(217,119,6,.1)'] : ['#7C3AED','rgba(124,58,237,.1)'];
  return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: bg, color: c, fontWeight: 600 }}>
    {d < 0 ? `D+${Math.abs(d)}` : d === 0 ? '오늘!' : `D-${d}`}
  </span>;
}

/* ─── 수집 모달 (AI 요약 포함) ─── */
function CaptureModal({ onClose, onSave, allTags }) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(null); // {summary, tags}
  const ref = useRef();
  useEffect(() => { setTimeout(() => ref.current?.focus(), 100); }, []);

  const runAI = async () => {
    if (!title.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, url: title.startsWith('http') ? title : '', userTags: allTags }),
      });
      const data = await res.json();
      if (data.summary) {
        setAiSuggested(data);
        setNote(data.summary);
      }
    } catch (e) { console.error('AI 요약 실패', e); }
    setAiLoading(false);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title, note, aiTags: aiSuggested?.tags || [] });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="su" style={{ background: '#fff', borderRadius: '22px 22px 0 0', width: '100%', padding: '20px 18px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
        <div style={{ width: 36, height: 4, background: '#ddd', borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 3 }}>✏️ 빠른 수집</div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14 }}>지금 생각, 링크, 영감 — 분류 없이 수신함으로</div>
        <input ref={ref} value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && title.trim() && handleSave()}
          placeholder="생각이나 URL을 붙여넣어요..."
          style={{ width: '100%', padding: '13px 15px', borderRadius: 13, border: '1.5px solid rgba(124,58,237,.3)', background: '#faf9ff', fontSize: 15, color: '#111', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />

        {/* AI 요약 버튼 */}
        {title.trim() && !aiSuggested && (
          <button onClick={runAI} disabled={aiLoading}
            style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid rgba(124,58,237,.25)', background: 'rgba(124,58,237,.06)', color: '#7C3AED', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {aiLoading ? <><span className="spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #7C3AED', borderTopColor: 'transparent', borderRadius: '50%' }} /> AI 분석 중...</> : '🤖 AI 요약 + 태그 추천'}
          </button>
        )}

        {/* AI 추천 태그 */}
        {aiSuggested?.tags?.length > 0 && (
          <div style={{ marginBottom: 10, padding: '10px 12px', background: 'rgba(124,58,237,.06)', borderRadius: 12, border: '0.5px solid rgba(124,58,237,.15)' }}>
            <div style={{ fontSize: 11, color: '#7C3AED', fontWeight: 600, marginBottom: 6 }}>🤖 AI 추천 태그</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {aiSuggested.tags.map(t => <Tag key={t} label={t} selected allTags={allTags} size="sm" />)}
            </div>
          </div>
        )}

        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="메모 (선택)" rows={2}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '0.5px solid rgba(0,0,0,.12)', background: '#f9f9f7', fontSize: 13, color: '#333', outline: 'none', resize: 'none', marginBottom: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        <button onClick={handleSave}
          style={{ width: '100%', padding: 15, borderRadius: 14, background: title.trim() ? '#7C3AED' : '#e5e5e5', color: title.trim() ? 'white' : '#aaa', border: 'none', cursor: title.trim() ? 'pointer' : 'default', fontSize: 15, fontWeight: 700 }}>
          📥 수신함에 저장
        </button>
      </div>
    </div>
  );
}

/* ─── 수신함 처리 모달 ─── */
function ProcessModal({ item, projects, allTags, onClose, onProcess }) {
  const [tags, setTags] = useState(item.aiTags || []);
  const [dest, setDest] = useState('resource');
  const [projId, setProjId] = useState(projects[0]?.id || null);
  const toggle = t => setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="su" style={{ background: '#fff', borderRadius: '22px 22px 0 0', width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: 36, height: 4, background: '#ddd', borderRadius: 2, margin: '12px auto 0' }} />

        <div style={{ padding: '14px 18px 10px', borderBottom: '0.5px solid #f0f0f0' }}>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>수신함 처리 — 외장메모리에 저장</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111', lineHeight: 1.4 }}>{item.title}</div>
          {item.url && <div style={{ fontSize: 11, color: '#7C3AED', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.url}</div>}
          {item.note && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{item.note}</div>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {/* 태그 선택 */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 4 }}>
              태그 선택 <span style={{ color: '#aaa', fontWeight: 400, fontSize: 11 }}>— 1개 이상 필수</span>
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
              {allTags.map(t => <Tag key={t} label={t} selected={tags.includes(t)} onToggle={toggle} allTags={allTags} />)}
            </div>
          </div>

          {/* 목적지 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }}>어디로 보낼까요?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['resource', '📚', '자료함', '태그로 인덱싱', '#D97706'], ['project', '🎯', '프로젝트 하위로', '바로 연결', '#7C3AED']].map(([d, ico, label, sub, color]) => (
                <button key={d} onClick={() => setDest(d)}
                  style={{ padding: '14px 10px', borderRadius: 14, border: `2px solid ${dest === d ? color : 'rgba(0,0,0,.1)'}`, background: dest === d ? `${color}10` : 'transparent', cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{ico}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: dest === d ? color : '#555' }}>{label}</div>
                  <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 프로젝트 선택 */}
          {dest === 'project' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>어떤 프로젝트에 연결할까요?</div>
              {projects.length === 0
                ? <div style={{ fontSize: 12, color: '#bbb', textAlign: 'center', padding: 16 }}>아직 프로젝트가 없어요</div>
                : projects.map(p => (
                  <button key={p.id} onClick={() => setProjId(p.id)}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${projId === p.id ? '#7C3AED' : 'rgba(0,0,0,.1)'}`, background: projId === p.id ? 'rgba(124,58,237,.06)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{p.title}</div>
                      {p.due && <DDay due={p.due} />}
                    </div>
                    {projId === p.id && <span style={{ color: '#7C3AED' }}>✓</span>}
                  </button>
                ))
              }
            </div>
          )}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '0.5px solid #f0f0f0', background: '#fff' }}>
          {!tags.length && <div style={{ fontSize: 11, color: '#EA580C', textAlign: 'center', marginBottom: 8 }}>태그를 1개 이상 선택해주세요</div>}
          <button onClick={() => tags.length && onProcess(item.id, tags, dest, dest === 'project' ? projId : null)}
            disabled={!tags.length}
            style={{ width: '100%', padding: 15, borderRadius: 14, background: tags.length ? '#7C3AED' : '#e5e5e5', color: tags.length ? 'white' : '#aaa', border: 'none', cursor: tags.length ? 'pointer' : 'default', fontSize: 15, fontWeight: 700 }}>
            {dest === 'resource' ? '📚 자료함에 저장' : '🎯 프로젝트에 연결'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── 새 프로젝트 모달 ─── */
function AddProjectModal({ onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState('');
  const ref = useRef();
  useEffect(() => { setTimeout(() => ref.current?.focus(), 100); }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="su" style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 420, padding: '22px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#111' }}>🎯 새 프로젝트</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#aaa', cursor: 'pointer' }}>×</button>
        </div>
        <input ref={ref} value={title} onChange={e => setTitle(e.target.value)}
          placeholder="프로젝트 이름 *"
          style={{ width: '100%', padding: '13px 15px', borderRadius: 13, border: '1.5px solid rgba(124,58,237,.3)', background: '#faf9ff', fontSize: 15, color: '#111', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
        <textarea value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="목표 설명 (선택)" rows={2}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '0.5px solid rgba(0,0,0,.12)', background: '#f9f9f7', fontSize: 13, color: '#333', outline: 'none', resize: 'none', marginBottom: 10, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 5 }}>마감일</label>
          <input type="date" value={due} onChange={e => setDue(e.target.value)}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '0.5px solid rgba(0,0,0,.12)', background: '#f9f9f7', fontSize: 14, color: '#333', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <button onClick={() => title.trim() && onSave({ title, desc, due: due || null })}
          disabled={!title.trim()}
          style={{ width: '100%', padding: 15, borderRadius: 14, background: title.trim() ? '#7C3AED' : '#e5e5e5', color: title.trim() ? 'white' : '#aaa', border: 'none', cursor: title.trim() ? 'pointer' : 'default', fontSize: 15, fontWeight: 700 }}>
          프로젝트 만들기
        </button>
      </div>
    </div>
  );
}

/* ─── 자료 연결 패널 ─── */
function LinkResourcePanel({ project, resources, onLink, onClose, allTags }) {
  const [tagFilter, setTagFilter] = useState([]);
  const [selected, setSelected] = useState([]);
  const alreadyLinked = project.linkedIds || [];
  const usedTags = [...new Set(resources.flatMap(r => r.tags))].sort();
  const toggleTag = t => setTagFilter(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  const toggleRes = id => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const available = resources.filter(r => {
    if (alreadyLinked.includes(r.id)) return false;
    if (tagFilter.length === 0) return true;
    return tagFilter.some(t => r.tags.includes(t));
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="su" style={{ background: '#fff', borderRadius: '22px 22px 0 0', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: 36, height: 4, background: '#ddd', borderRadius: 2, margin: '12px auto 0' }} />

        <div style={{ padding: '14px 18px 12px', borderBottom: '0.5px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>📚 자료 연결하기</div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>"{project.title}" 에 가져올 자료 선택</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#aaa', cursor: 'pointer' }}>×</button>
          </div>
        </div>

        <div style={{ padding: '12px 18px', borderBottom: '0.5px solid #f0f0f0', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Step 1 — 태그로 필터링</div>
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4 }}>
            {usedTags.map(t => <Tag key={t} label={t} selected={tagFilter.includes(t)} onToggle={toggleTag} allTags={allTags} size="sm" />)}
            {tagFilter.length > 0 && <button onClick={() => setTagFilter([])} style={{ padding: '3px 10px', borderRadius: 20, border: '0.5px solid rgba(0,0,0,.12)', background: 'transparent', color: '#aaa', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>전체 보기</button>}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            Step 2 — 연결할 자료 선택 ({selected.length}개 선택됨)
          </div>
          {available.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: '#bbb' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13 }}>{tagFilter.length > 0 ? '선택한 태그에 해당하는 자료가 없어요' : '자료함이 비어있어요'}</div>
            </div>
          )}
          {available.map(r => {
            const isSel = selected.includes(r.id);
            return (
              <div key={r.id} onClick={() => toggleRes(r.id)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 14, marginBottom: 8, cursor: 'pointer', background: isSel ? 'rgba(124,58,237,.07)' : '#f9f9f7', border: `1.5px solid ${isSel ? '#7C3AED' : 'rgba(0,0,0,.07)'}` }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, border: `2px solid ${isSel ? '#7C3AED' : '#ddd'}`, background: isSel ? '#7C3AED' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  {isSel && <svg width="12" height="10" viewBox="0 0 12 10"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {r.url && <div style={{ fontSize: 10, fontWeight: 600, color: isYT(r.url) ? '#DC2626' : '#7C3AED', marginBottom: 3 }}>{isYT(r.url) ? '▶ YouTube' : isIG(r.url) ? '📷 Instagram' : '🔗 링크'}</div>}
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#111', marginBottom: 4 }}>{r.title}</div>
                  {r.note && <div style={{ fontSize: 12, color: '#888', marginBottom: 6, lineHeight: 1.4 }}>{r.note}</div>}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {r.tags.map(t => <Tag key={t} label={t} selected allTags={allTags} size="sm" />)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '0.5px solid #f0f0f0', background: '#fff' }}>
          <button onClick={() => selected.length && onLink(selected)} disabled={!selected.length}
            style={{ width: '100%', padding: 15, borderRadius: 14, background: selected.length ? '#7C3AED' : '#e5e5e5', color: selected.length ? 'white' : '#aaa', border: 'none', cursor: selected.length ? 'pointer' : 'default', fontSize: 15, fontWeight: 700 }}>
            {selected.length ? `📎 ${selected.length}개 자료 연결하기` : '자료를 선택해주세요'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── 수신함 뷰 ─── */
function InboxView({ items, projects, allTags, onProcess, onDelete }) {
  const [proc, setProc] = useState(null);
  if (!items.length) return (
    <div style={{ textAlign: 'center', padding: '60px 30px', color: '#aaa' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>📥</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#555', marginBottom: 6 }}>수신함이 비어있어요</div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>아래 ✏️ 버튼을 눌러<br />생각이 떠오를 때마다 바로 던져두세요</div>
    </div>
  );
  return (
    <div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{items.length}개 처리 대기 중</span>
        <span style={{ color: '#7C3AED', fontSize: 11, fontWeight: 500 }}>탭하여 처리 →</span>
      </div>
      {items.map(item => (
        <div key={item.id} className="fi"
          style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, border: '0.5px solid rgba(0,0,0,.07)' }}>
          <div onClick={() => setProc(item)} style={{ cursor: 'pointer' }}>
            {item.url && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 12, background: isYT(item.url) ? 'rgba(220,38,38,.1)' : 'rgba(124,58,237,.1)', color: isYT(item.url) ? '#DC2626' : '#7C3AED', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>
                  {isYT(item.url) ? '▶ YouTube' : isIG(item.url) ? '📷 Instagram' : '🔗 링크'}
                </span>
              </div>
            )}
            <div style={{ fontSize: 15, fontWeight: 500, color: '#111', marginBottom: 3 }}>{item.title}</div>
            {item.note && <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{item.note}</div>}
            {item.aiTags?.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: '#7C3AED', fontWeight: 600 }}>🤖</span>
                {item.aiTags.map(t => <Tag key={t} label={t} selected allTags={allTags} size="sm" />)}
              </div>
            )}
            <div style={{ fontSize: 11, color: '#bbb' }}>{item.createdAt}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => setProc(item)}
              style={{ flex: 1, padding: 9, borderRadius: 10, background: 'rgba(124,58,237,.08)', color: '#7C3AED', border: '1px solid rgba(124,58,237,.2)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              처리하기 →
            </button>
            <button onClick={() => onDelete(item.id)}
              style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(0,0,0,.04)', color: '#aaa', border: '0.5px solid rgba(0,0,0,.08)', cursor: 'pointer', fontSize: 13 }}>
              삭제
            </button>
          </div>
        </div>
      ))}
      {proc && <ProcessModal item={proc} projects={projects} allTags={allTags}
        onClose={() => setProc(null)}
        onProcess={(id, tags, dest, projId) => { onProcess(id, tags, dest, projId); setProc(null); }} />}
    </div>
  );
}

/* ─── 자료함 뷰 ─── */
function ResourceView({ items, projects, allTags, onLinkToProject }) {
  const [filter, setFilter] = useState([]);
  const [sel, setSel] = useState(null);
  const usedTags = [...new Set(items.flatMap(i => i.tags))].sort();
  const toggle = t => setFilter(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  const filtered = filter.length ? items.filter(i => filter.some(t => i.tags.includes(t))) : items;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>태그로 필터링</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {usedTags.map(t => <Tag key={t} label={t} selected={filter.includes(t)} onToggle={toggle} allTags={allTags} size="sm" />)}
          {filter.length > 0 && <button onClick={() => setFilter([])} style={{ padding: '3px 10px', borderRadius: 20, border: '0.5px solid rgba(0,0,0,.12)', background: 'transparent', color: '#aaa', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>초기화</button>}
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 10 }}>{filtered.length}개 자료</div>
      {!filtered.length && <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}><div style={{ fontSize: 40, marginBottom: 8 }}>📚</div><div>자료가 없어요</div></div>}
      {filtered.map(item => (
        <div key={item.id} className="fi" onClick={() => setSel(sel?.id === item.id ? null : item)}
          style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, border: `0.5px solid ${sel?.id === item.id ? 'rgba(217,119,6,.4)' : 'rgba(0,0,0,.07)'}`, borderLeft: sel?.id === item.id ? '3px solid #D97706' : '0.5px solid rgba(0,0,0,.07)', cursor: 'pointer' }}>
          {item.url && <div style={{ fontSize: 11, color: isYT(item.url) ? '#DC2626' : '#7C3AED', marginBottom: 5, fontWeight: 500 }}>{isYT(item.url) ? '▶ YouTube' : isIG(item.url) ? '📷 Instagram' : '🔗 링크'}</div>}
          <div style={{ fontSize: 15, fontWeight: 500, color: '#111', marginBottom: 6 }}>{item.title}</div>
          {item.note && <div style={{ fontSize: 12, color: '#888', marginBottom: 7, lineHeight: 1.5 }}>{item.note}</div>}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {item.tags.map(t => <Tag key={t} label={t} selected allTags={allTags} size="sm" />)}
          </div>
          {sel?.id === item.id && (
            <div className="fi" style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid #f0f0f0' }}>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8 }}>프로젝트에 연결</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {projects.map(p => (
                  <button key={p.id} onClick={e => { e.stopPropagation(); onLinkToProject(item.id, p.id); }}
                    style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(124,58,237,.08)', color: '#7C3AED', border: '0.5px solid rgba(124,58,237,.2)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                    🎯 {p.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── 프로젝트 뷰 ─── */
function ProjectView({ projects, resources, allTags, onCheck, onAddProject, onLinkResources, onUnlink, onAIRecommend }) {
  const [sel, setSel] = useState(null);
  const [showLink, setShowLink] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const selP = sel ? projects.find(p => p.id === sel) : null;
  const linkedRes = selP ? resources.filter(r => (selP.linkedIds || []).includes(r.id)) : [];
  const p = selP ? pct(selP.checks) : null;

  const handleAIRecommend = async () => {
    if (!selP) return;
    setAiLoading(true);
    try {
      const unlinked = resources.filter(r => !(selP.linkedIds || []).includes(r.id));
      const recommended = await onAIRecommend(selP, unlinked);
      if (recommended?.length) {
        onLinkResources(selP.id, recommended);
        alert(`🤖 AI가 ${recommended.length}개 자료를 추천해 연결했어요!`);
      } else {
        alert('추천할 자료를 찾지 못했어요.');
      }
    } catch (e) { console.error(e); alert('AI 추천 실패'); }
    setAiLoading(false);
  };

  return (
    <div>
      {!selP ? (
        <>
          <button onClick={onAddProject}
            style={{ width: '100%', padding: 14, borderRadius: 14, background: 'rgba(124,58,237,.06)', border: '1.5px dashed rgba(124,58,237,.3)', color: '#7C3AED', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            + 새 프로젝트 추가
          </button>
          {projects.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 30px', color: '#aaa' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🎯</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#555', marginBottom: 6 }}>아직 프로젝트가 없어요</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>목표와 마감일이 있는 일을<br />프로젝트로 만들어보세요</div>
            </div>
          )}
          {projects.map(proj => {
            const pp = pct(proj.checks);
            return (
              <div key={proj.id} onClick={() => setSel(proj.id)} className="fi"
                style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, border: '0.5px solid rgba(0,0,0,.07)', cursor: 'pointer', borderTop: '3px solid #7C3AED' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111', flex: 1, paddingRight: 8 }}>{proj.title}</div>
                  <DDay due={proj.due} />
                </div>
                {proj.desc && <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>{proj.desc}</div>}
                {pp !== null && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#aaa' }}>진행률</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: pp === 100 ? '#0D9488' : '#7C3AED' }}>{pp}%</span>
                    </div>
                    <div style={{ background: '#f0f0f0', borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', borderRadius: 4, background: pp === 100 ? '#0D9488' : '#7C3AED', width: `${pp}%`, transition: 'width .4s' }} />
                    </div>
                  </>
                )}
                <div style={{ fontSize: 11, color: '#aaa' }}>연결 자료 {(proj.linkedIds || []).length}개</div>
              </div>
            );
          })}
        </>
      ) : (
        <div className="fi">
          <button onClick={() => { setSel(null); setShowLink(false); }}
            style={{ background: 'none', border: 'none', color: '#7C3AED', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginBottom: 14, padding: 0 }}>
            ← 프로젝트 목록
          </button>

          <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, border: '0.5px solid rgba(0,0,0,.07)', borderTop: '3px solid #7C3AED' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111', flex: 1 }}>{selP.title}</div>
              <DDay due={selP.due} />
            </div>
            {selP.desc && <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>{selP.desc}</div>}

            {/* 체크리스트 */}
            <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>
              체크리스트 {p !== null && <span style={{ color: '#7C3AED' }}>({p}%)</span>}
            </div>
            {(selP.checks || []).map(ck => (
              <div key={ck.id} onClick={() => onCheck(selP.id, ck.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '0.5px solid #f5f5f5', cursor: 'pointer' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, border: `2px solid ${ck.d ? '#0D9488' : '#ddd'}`, background: ck.d ? '#0D9488' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {ck.d && <svg width="11" height="9" viewBox="0 0 11 9"><path d="M1 4.5l3.5 3.5 5.5-7" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <span style={{ fontSize: 14, color: ck.d ? '#bbb' : '#333', textDecoration: ck.d ? 'line-through' : 'none', flex: 1 }}>{ck.t}</span>
              </div>
            ))}
            {!(selP.checks?.length) && <div style={{ fontSize: 12, color: '#ccc', textAlign: 'center', padding: '10px 0' }}>체크리스트 없음</div>}
          </div>

          {/* 연결 자료 섹션 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>📚 연결된 자료 <span style={{ color: '#aaa', fontWeight: 400, fontSize: 12 }}>({linkedRes.length}개)</span></div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleAIRecommend} disabled={aiLoading}
                style={{ padding: '7px 10px', borderRadius: 20, background: 'rgba(124,58,237,.08)', color: '#7C3AED', border: '1px solid rgba(124,58,237,.2)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                {aiLoading ? '...' : '🤖 AI 추천'}
              </button>
              <button onClick={() => setShowLink(true)}
                style={{ padding: '7px 14px', borderRadius: 20, background: 'rgba(217,119,6,.08)', color: '#D97706', border: '1px solid rgba(217,119,6,.25)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                + 가져오기
              </button>
            </div>
          </div>

          {linkedRes.length === 0 && (
            <div onClick={() => setShowLink(true)}
              style={{ textAlign: 'center', padding: 28, background: '#f9f9f7', borderRadius: 14, border: '1.5px dashed rgba(217,119,6,.3)', cursor: 'pointer', marginBottom: 10 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📚</div>
              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>연결된 자료가 없어요</div>
              <div style={{ fontSize: 12, color: '#D97706', fontWeight: 600 }}>+ 자료함에서 가져오기</div>
            </div>
          )}

          {linkedRes.map(r => (
            <div key={r.id} style={{ background: 'rgba(217,119,6,.05)', borderRadius: 13, padding: '13px 14px', marginBottom: 8, border: '0.5px solid rgba(217,119,6,.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  {r.url && <div style={{ fontSize: 10, fontWeight: 600, color: isYT(r.url) ? '#DC2626' : '#7C3AED', marginBottom: 3 }}>{isYT(r.url) ? '▶ YouTube' : isIG(r.url) ? '📷 Instagram' : '🔗 링크'}</div>}
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#78350F', marginBottom: 4 }}>{r.title}</div>
                  {r.note && <div style={{ fontSize: 12, color: '#92400E', marginBottom: 6, lineHeight: 1.4 }}>{r.note}</div>}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {r.tags.map(t => <Tag key={t} label={t} selected allTags={allTags} size="sm" />)}
                  </div>
                </div>
                <button onClick={() => onUnlink(selP.id, r.id)}
                  style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 18, cursor: 'pointer', padding: '0 0 0 8px', lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
            </div>
          ))}

          {showLink && (
            <LinkResourcePanel project={selP} resources={resources} allTags={allTags}
              onLink={ids => { onLinkResources(selP.id, ids); setShowLink(false); }}
              onClose={() => setShowLink(false)} />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── 보관함 뷰 ─── */
function ArchiveView({ items, allTags }) {
  return (
    <div>
      {!items.length && <div style={{ textAlign: 'center', padding: '60px 30px', color: '#aaa' }}><div style={{ fontSize: 40, marginBottom: 10 }}>🗂</div><div>완료된 항목이 없어요</div></div>}
      {items.map(item => (
        <div key={item.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 8, border: '0.5px solid rgba(0,0,0,.06)', opacity: .7 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#555', marginBottom: 6 }}>{item.title}</div>
          {item.note && <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>{item.note}</div>}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {item.tags.map(t => <Tag key={t} label={t} selected allTags={allTags} size="sm" />)}
          </div>
          <div style={{ fontSize: 10, color: '#ccc', marginTop: 6 }}>{item.createdAt}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── 설정 뷰 ─── */
function SettingsView({ user, allTags, onSaveTags, onLogout }) {
  const [editTags, setEditTags] = useState(allTags);
  const [newTag, setNewTag] = useState('');
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyResult, setWeeklyResult] = useState(null);

  const addTag = () => {
    const t = newTag.trim().replace(/^#/, '');
    if (!t || editTags.includes(t)) return;
    setEditTags(p => [...p, t]);
    setNewTag('');
  };
  const removeTag = t => setEditTags(p => p.filter(x => x !== t));

  const runWeekly = async () => {
    setWeeklyLoading(true);
    try {
      const res = await fetch(AI_WEEKLY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid }),
      });
      const data = await res.json();
      setWeeklyResult(data);
    } catch (e) { console.error(e); alert('주간 리뷰 생성 실패'); }
    setWeeklyLoading(false);
  };

  return (
    <div>
      {/* 계정 */}
      <Card title="계정">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user.photoURL
            ? <img src={user.photoURL} style={{ width: 40, height: 40, borderRadius: '50%' }} alt="" />
            : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 700 }}>{user.displayName?.[0] || '?'}</div>
          }
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{user.displayName || '사용자'}</div>
            <div style={{ fontSize: 12, color: '#aaa' }}>{user.email}</div>
          </div>
          <button onClick={onLogout}
            style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(220,38,38,.06)', color: '#DC2626', border: '0.5px solid rgba(220,38,38,.2)', fontSize: 12, cursor: 'pointer' }}>
            로그아웃
          </button>
        </div>
      </Card>

      {/* 태그 관리 */}
      <Card title="내 태그 관리">
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
          {editTags.map(t => (
            <div key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Tag label={t} selected allTags={editTags} size="sm" />
              <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 14, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newTag} onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTag()}
            placeholder="새 태그 입력 (Enter)"
            style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(124,58,237,.25)', background: '#faf9ff', fontSize: 13, outline: 'none' }} />
          <button onClick={addTag}
            style={{ padding: '9px 14px', borderRadius: 10, background: '#7C3AED', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13 }}>추가</button>
        </div>
        {JSON.stringify(editTags) !== JSON.stringify(allTags) && (
          <button onClick={() => onSaveTags(editTags)}
            style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 10, background: '#0D9488', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            ✓ 태그 저장
          </button>
        )}
      </Card>

      {/* 주간 뇌 리뷰 */}
      <Card title="🧠 주간 뇌 리뷰 (AI)">
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7, marginBottom: 12 }}>
          이번 주 수집한 내용을 AI가 분석해 패턴과 인사이트를 정리해드려요.
        </div>
        <button onClick={runWeekly} disabled={weeklyLoading}
          style={{ width: '100%', padding: 12, borderRadius: 12, background: weeklyLoading ? '#e5e5e5' : 'linear-gradient(135deg,#7C3AED,#a78bfa)', color: weeklyLoading ? '#aaa' : 'white', border: 'none', cursor: weeklyLoading ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {weeklyLoading ? <><span className="spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #7C3AED', borderTopColor: 'transparent', borderRadius: '50%' }} /> 분석 중...</> : '📊 이번 주 리뷰 생성'}
        </button>
        {weeklyResult && (
          <div className="fi" style={{ marginTop: 12, padding: '14px', background: 'rgba(124,58,237,.04)', borderRadius: 12, border: '0.5px solid rgba(124,58,237,.15)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7C3AED', marginBottom: 8 }}>📋 주간 리뷰</div>
            <div style={{ fontSize: 13, color: '#333', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{weeklyResult.review}</div>
            {weeklyResult.suggestion && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(217,119,6,.06)', borderRadius: 10, border: '0.5px solid rgba(217,119,6,.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#D97706', marginBottom: 4 }}>💡 프로젝트 제안</div>
                <div style={{ fontSize: 13, color: '#78350F' }}>{weeklyResult.suggestion}</div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 공유 기능 안내 */}
      <Card title="공유 기능 (PWA 설치 후)">
        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7 }}>
          📱 앱 설치 후 유튜브·인스타 등에서<br />
          <b>공유 → 제2의뇌</b> 선택하면<br />
          수신함에 자동으로 저장됩니다.
        </div>
        <div style={{ marginTop: 10, padding: '10px 12px', background: '#f9f9f7', borderRadius: 10, fontSize: 11, color: '#aaa', lineHeight: 1.6 }}>
          Android: Chrome → 메뉴 → 홈 화면에 추가<br />
          iOS 16.4+: Safari → 공유 → 홈 화면에 추가
        </div>
      </Card>

      <div style={{ textAlign: 'center', fontSize: 11, color: '#ccc', padding: 16 }}>제2의뇌 v1.0.0</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>{title}</div>
      <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid rgba(0,0,0,.07)', padding: '14px 16px' }}>{children}</div>
    </div>
  );
}

/* ════════════════════════════════════════
   메인 앱
════════════════════════════════════════ */
export default function MainApp({ user }) {
  const { items, loading, addItem, updateItem, deleteItem } = useItems(user.uid);
  const { tags: userTags, saveTags } = useUserTags(user.uid);

  const [tab, setTab] = useState('inbox');
  const [showCap, setShowCap] = useState(false);
  const [showAddProj, setShowAddProj] = useState(false);

  const allTags = userTags.length ? userTags : [];

  /* 공유 수신 처리 — main.jsx에서 React 시작 전에 캡처한 window.__pendingShare 소비 */
  useEffect(() => {
    if (!window.__pendingShare) return;
    const { url, title } = window.__pendingShare;
    delete window.__pendingShare;
    const t = title || url;
    if (!t) return;
    addItem({
      type: 'inbox',
      title: t,
      url: url || '',
      tags: [], note: '', aiTags: [],
      createdAt: today(),
    });
    setTab('inbox');
  }, []);  // eslint-disable-line

  /* ─ 필터된 뷰 ─ */
  const inbox = useMemo(() => items.filter(i => i.type === 'inbox'), [items]);
  const resources = useMemo(() => items.filter(i => i.type === 'resource'), [items]);
  const projects = useMemo(() => items.filter(i => i.type === 'project'), [items]);
  const archives = useMemo(() => items.filter(i => i.type === 'archive'), [items]);

  /* ─ 수집 ─ */
  const doCapture = ({ title, note, aiTags }) => {
    const isURL = title.startsWith('http');
    addItem({ type: 'inbox', title, url: isURL ? title : '', tags: [], note, aiTags: aiTags || [], createdAt: today() });
    setShowCap(false);
  };

  /* ─ 수신함 처리 ─ */
  const doProcess = (id, tags, dest, projId) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    // inbox → resource
    updateItem(id, { type: 'resource', tags });
    if (dest === 'project' && projId) {
      const proj = items.find(i => i.id === projId);
      if (proj) updateItem(projId, { linkedIds: [...(proj.linkedIds || []), id] });
    }
  };

  /* ─ 수신함 삭제 ─ */
  const doDeleteInbox = id => deleteItem(id);

  /* ─ 체크리스트 토글 ─ */
  const doCheck = (projId, ckId) => {
    const proj = items.find(i => i.id === projId);
    if (!proj) return;
    updateItem(projId, { checks: proj.checks.map(c => c.id === ckId ? { ...c, d: !c.d } : c) });
  };

  /* ─ 자료 → 프로젝트 단일 연결 ─ */
  const doLinkToProject = (resId, projId) => {
    const proj = items.find(i => i.id === projId);
    if (!proj) return;
    const existing = proj.linkedIds || [];
    if (!existing.includes(resId)) updateItem(projId, { linkedIds: [...existing, resId] });
  };

  /* ─ 프로젝트 → 자료 여러 개 연결 ─ */
  const doLinkResources = (projId, resIds) => {
    const proj = items.find(i => i.id === projId);
    if (!proj) return;
    const existing = proj.linkedIds || [];
    const newIds = resIds.filter(id => !existing.includes(id));
    updateItem(projId, { linkedIds: [...existing, ...newIds] });
  };

  /* ─ 연결 해제 ─ */
  const doUnlink = (projId, resId) => {
    const proj = items.find(i => i.id === projId);
    if (!proj) return;
    updateItem(projId, { linkedIds: (proj.linkedIds || []).filter(x => x !== resId) });
  };

  /* ─ 새 프로젝트 ─ */
  const doAddProject = ({ title, desc, due }) => {
    addItem({ type: 'project', title, desc, due, tags: [], linkedIds: [], checks: [], createdAt: today() });
    setShowAddProj(false);
  };

  /* ─ AI 자료 추천 ─ */
  const doAIRecommend = async (project, unlinkedResources) => {
    const res = await fetch(AI_RECOMMEND_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: { title: project.title, desc: project.desc, tags: project.tags },
        resources: unlinkedResources.map(r => ({ id: r.id, title: r.title, note: r.note, tags: r.tags })),
      }),
    });
    const data = await res.json();
    return data.recommendedIds || [];
  };

  /* ─ 로그아웃 ─ */
  const doLogout = () => signOut(auth);

  /* ─ 탭 정의 ─ */
  const tabs = [
    { id: 'inbox', ico: '📥', label: '수신함', badge: inbox.length || null },
    { id: 'project', ico: '🎯', label: '프로젝트' },
    { id: 'resource', ico: '📚', label: '자료함' },
    { id: 'archive', ico: '🗂', label: '보관' },
    { id: 'settings', ico: '⚙️', label: '설정' },
  ];

  const titles = { inbox: '📥 수신함', project: '🎯 프로젝트', resource: '📚 자료함', archive: '🗂 보관함', settings: '⚙️ 설정' };

  if (loading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: '#f7f7f5' }}>
      <span className="spin" style={{ display: 'block', width: 32, height: 32, border: '3px solid #7C3AED', borderTopColor: 'transparent', borderRadius: '50%' }} />
      <div style={{ fontSize: 13, color: '#aaa' }}>로딩 중...</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f7f7f5', maxWidth: 430, margin: '0 auto', position: 'relative' }}>

      {/* 상단바 */}
      <div style={{ background: '#fff', padding: '14px 18px 10px', borderBottom: '0.5px solid rgba(0,0,0,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#111' }}>{titles[tab]}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#7C3AED' }}>🧠 제2의뇌</div>
      </div>

      {/* 컨텐츠 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 80px' }}>
        {tab === 'inbox' && <InboxView items={inbox} projects={projects} allTags={allTags} onProcess={doProcess} onDelete={doDeleteInbox} />}
        {tab === 'project' && <ProjectView projects={projects} resources={resources} allTags={allTags} onCheck={doCheck} onAddProject={() => setShowAddProj(true)} onLinkResources={doLinkResources} onUnlink={doUnlink} onAIRecommend={doAIRecommend} />}
        {tab === 'resource' && <ResourceView items={resources} projects={projects} allTags={allTags} onLinkToProject={doLinkToProject} />}
        {tab === 'archive' && <ArchiveView items={archives} allTags={allTags} />}
        {tab === 'settings' && <SettingsView user={user} allTags={allTags} onSaveTags={saveTags} onLogout={doLogout} />}
      </div>

      {/* FAB */}
      {tab !== 'settings' && (
        <button onClick={() => setShowCap(true)}
          style={{ position: 'fixed', bottom: 76, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#7C3AED', color: 'white', border: 'none', cursor: 'pointer', fontSize: 24, boxShadow: '0 4px 20px rgba(124,58,237,.45)', zIndex: 100 }}>
          ✏️
        </button>
      )}

      {/* 하단 탭바 */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(12px)', borderTop: '0.5px solid rgba(0,0,0,.08)', display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 99 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '8px 0 10px', border: 'none', background: 'transparent', cursor: 'pointer', position: 'relative' }}>
            <span style={{ fontSize: 20 }}>{t.ico}</span>
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? '#7C3AED' : '#aaa' }}>{t.label}</span>
            {t.badge && <span style={{ position: 'absolute', top: 6, right: 'calc(50% - 14px)', background: '#EA580C', color: 'white', borderRadius: 10, fontSize: 9, padding: '1px 5px', fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{t.badge}</span>}
            {tab === t.id && <div style={{ position: 'absolute', bottom: 0, width: 20, height: 2, background: '#7C3AED', borderRadius: 1 }} />}
          </button>
        ))}
      </div>

      {/* 모달 */}
      {showCap && <CaptureModal onClose={() => setShowCap(false)} onSave={doCapture} allTags={allTags} />}
      {showAddProj && <AddProjectModal onClose={() => setShowAddProj(false)} onSave={doAddProject} />}
    </div>
  );
}
