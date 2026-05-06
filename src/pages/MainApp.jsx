import { useState, useMemo, useRef, useEffect } from 'react';
import { useItems, useUserTags } from '../hooks/useItems';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { AI_ENDPOINT, AI_WEEKLY_ENDPOINT, AI_RECOMMEND_ENDPOINT, AI_REPORT_ENDPOINT } from '../constants';

/* utils */
const dday = d => { if (!d) return null; return Math.ceil((new Date(d) - new Date()) / 86400000); };
const pct = cs => { if (!cs?.length) return null; return Math.round(cs.filter(c => c.d).length / cs.length * 100); };
const isYT = u => u && (u.includes('youtube') || u.includes('youtu.be'));
const isIG = u => u && u.includes('instagram');
const today = () => new Date().toISOString().slice(0, 10);

const TAG_PALETTE = ['#7C3AED','#0D9488','#D97706','#DC2626','#2563EB','#059669','#9333EA','#DB2777','#EA580C','#65A30D','#0891B2','#B45309','#6D28D9','#0369A1','#7C3AED'];
const tagColor = (t, allTags) => TAG_PALETTE[allTags.indexOf(t) % TAG_PALETTE.length] || '#7C3AED';

function Tag({ label, selected, onToggle, size = 'md', allTags = [] }) {
  const c = tagColor(label, allTags);
  return (
    <button onClick={() => onToggle && onToggle(label)} style={{
      display:'inline-flex', alignItems:'center',
      padding: size==='sm' ? '3px 9px' : '5px 13px',
      borderRadius:20, border:`1.5px solid ${selected ? c : 'rgba(0,0,0,.12)'}`,
      background: selected ? c : 'transparent', color: selected ? 'white' : '#555',
      fontSize: size==='sm' ? 11 : 13, fontWeight: selected ? 600 : 400,
      cursor: onToggle ? 'pointer' : 'default', flexShrink:0, whiteSpace:'nowrap', transition:'all .12s',
    }}>#{label}</button>
  );
}

function DDay({ due }) {
  const d = dday(due); if (d === null) return null;
  const [c,bg] = d<0 ? ['#DC2626','rgba(220,38,38,.1)'] : d<=5 ? ['#D97706','rgba(217,119,6,.1)'] : ['#7C3AED','rgba(124,58,237,.1)'];
  return <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:bg,color:c,fontWeight:600}}>
    {d<0 ? `D+${Math.abs(d)}` : d===0 ? '오늘!' : `D-${d}`}
  </span>;
}

function Card({ title, children }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11,color:'#aaa',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:8}}>{title}</div>
      <div style={{background:'#fff',borderRadius:16,border:'0.5px solid rgba(0,0,0,.07)',padding:'14px 16px'}}>{children}</div>
    </div>
  );
}

/* ─── CaptureModal ─── */
function CaptureModal({ onClose, onSave, allTags }) {
  const [title,setTitle] = useState('');
  const [memo,setMemo] = useState('');
  const [aiLoading,setAiLoading] = useState(false);
  const [aiTags,setAiTags] = useState([]);
  const memoRef = useRef();
  useEffect(() => { setTimeout(() => memoRef.current?.focus(), 100); }, []);

  const runAI = async () => {
    const content = memo.trim() || title.trim(); if (!content) return;
    setAiLoading(true);
    try {
      const res = await fetch(AI_ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title:content,url:'',userTags:allTags}) });
      const data = await res.json();
      if (data.tags?.length) setAiTags(data.tags);
    } catch(e) { console.error(e); }
    setAiLoading(false);
  };

  const canSave = memo.trim() || title.trim();
  const handleSave = () => {
    if (!canSave) return;
    const effectiveTitle = title.trim() || memo.trim().split('\n')[0].slice(0,60);
    const effectiveMemo  = title.trim() ? memo.trim() : memo.trim().slice(effectiveTitle.length).trim();
    onSave({ title: effectiveTitle, note: effectiveMemo, aiTags });
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:300,display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="su" style={{background:'#fff',borderRadius:'22px 22px 0 0',width:'100%',padding:'20px 18px',paddingBottom:'calc(20px + env(safe-area-inset-bottom))'}}>
        <div style={{width:36,height:4,background:'#ddd',borderRadius:2,margin:'0 auto 16px'}}/>
        <div style={{fontSize:16,fontWeight:700,color:'#111',marginBottom:3}}>✏️ 메모 수집</div>
        <div style={{fontSize:12,color:'#aaa',marginBottom:16}}>지금 떠오른 생각을 바로 던져두세요</div>
        <textarea ref={memoRef} value={memo} onChange={e=>setMemo(e.target.value)} placeholder="지금 생각나는 것, 아이디어, 메모…" rows={5}
          style={{width:'100%',padding:'14px 15px',borderRadius:14,border:'1.5px solid rgba(124,58,237,.3)',background:'#faf9ff',fontSize:15,color:'#111',outline:'none',resize:'none',marginBottom:10,fontFamily:'inherit',boxSizing:'border-box',lineHeight:1.6}}/>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="제목 (선택 — 비우면 첫 줄 자동 사용)"
          style={{width:'100%',padding:'11px 14px',borderRadius:12,border:'0.5px solid rgba(0,0,0,.12)',background:'#f9f9f7',fontSize:13,color:'#333',outline:'none',marginBottom:10,boxSizing:'border-box'}}/>
        {canSave && !aiTags.length && (
          <button onClick={runAI} disabled={aiLoading} style={{width:'100%',padding:10,borderRadius:12,border:'1px solid rgba(124,58,237,.25)',background:'rgba(124,58,237,.06)',color:'#7C3AED',cursor:'pointer',fontSize:13,fontWeight:600,marginBottom:10,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            {aiLoading ? <><span className="spin" style={{display:'inline-block',width:14,height:14,border:'2px solid #7C3AED',borderTopColor:'transparent',borderRadius:'50%'}}/> 분석 중...</> : '🤖 AI 태그 추천'}
          </button>
        )}
        {aiTags.length > 0 && (
          <div style={{marginBottom:10,padding:'10px 12px',background:'rgba(124,58,237,.06)',borderRadius:12,border:'0.5px solid rgba(124,58,237,.15)'}}>
            <div style={{fontSize:11,color:'#7C3AED',fontWeight:600,marginBottom:6}}>🤖 AI 추천 태그</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{aiTags.map(t=><Tag key={t} label={t} selected allTags={allTags} size="sm"/>)}</div>
          </div>
        )}
        <button onClick={handleSave} disabled={!canSave} style={{width:'100%',padding:15,borderRadius:14,background:canSave?'#7C3AED':'#e5e5e5',color:canSave?'white':'#aaa',border:'none',cursor:canSave?'pointer':'default',fontSize:15,fontWeight:700}}>
          📥 수신함에 저장
        </button>
      </div>
    </div>
  );
}

/* ─── ProcessModal (myNote 추가) ─── */
function ProcessModal({ item, projects, allTags, onClose, onProcess }) {
  const [tags,setTags] = useState(item.aiTags || []);
  const [dest,setDest] = useState('resource');
  const [projId,setProjId] = useState(projects[0]?.id || null);
  const [myNote,setMyNote] = useState('');
  const toggle = t => setTags(p => p.includes(t) ? p.filter(x=>x!==t) : [...p,t]);

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:300,display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="su" style={{background:'#fff',borderRadius:'22px 22px 0 0',width:'100%',maxHeight:'88vh',display:'flex',flexDirection:'column'}}>
        <div style={{width:36,height:4,background:'#ddd',borderRadius:2,margin:'12px auto 0'}}/>
        <div style={{padding:'14px 18px 10px',borderBottom:'0.5px solid #f0f0f0'}}>
          <div style={{fontSize:12,color:'#aaa',marginBottom:4}}>수신함 처리</div>
          <div style={{fontSize:15,fontWeight:600,color:'#111',lineHeight:1.4}}>{item.title}</div>
          {item.url && <div style={{fontSize:11,color:'#7C3AED',marginTop:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.url}</div>}
          {item.note && <div style={{fontSize:12,color:'#888',marginTop:4}}>{item.note}</div>}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'16px 18px'}}>
          <div style={{marginBottom:18}}>
            <div style={{fontSize:13,fontWeight:600,color:'#333',marginBottom:4}}>태그 선택 <span style={{color:'#aaa',fontWeight:400,fontSize:11}}>— 1개 이상 필수</span></div>
            <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:10}}>
              {allTags.map(t=><Tag key={t} label={t} selected={tags.includes(t)} onToggle={toggle} allTags={allTags}/>)}
            </div>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:600,color:'#333',marginBottom:10}}>어디로 보낼까요?</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {[['resource','📚','자료함','태그로 인덱싱','#D97706'],['project','🎯','프로젝트 하위로','바로 연결','#7C3AED']].map(([d,ico,label,sub,color])=>(
                <button key={d} onClick={()=>setDest(d)} style={{padding:'14px 10px',borderRadius:14,border:`2px solid ${dest===d?color:'rgba(0,0,0,.1)'}`,background:dest===d?`${color}10`:'transparent',cursor:'pointer',textAlign:'center'}}>
                  <div style={{fontSize:22,marginBottom:4}}>{ico}</div>
                  <div style={{fontSize:13,fontWeight:600,color:dest===d?color:'#555'}}>{label}</div>
                  <div style={{fontSize:10,color:'#aaa',marginTop:2}}>{sub}</div>
                </button>
              ))}
            </div>
          </div>
          {dest === 'resource' && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:600,color:'#333',marginBottom:6}}>💭 왜 저장했나요? <span style={{color:'#aaa',fontWeight:400,fontSize:11}}>(선택)</span></div>
              <textarea value={myNote} onChange={e=>setMyNote(e.target.value)} placeholder="나만의 메모 — 이걸 어디에 쓸지, 왜 중요한지…" rows={3}
                style={{width:'100%',padding:'11px 14px',borderRadius:12,border:'1px solid rgba(124,58,237,.2)',background:'#faf9ff',fontSize:13,color:'#111',outline:'none',resize:'none',fontFamily:'inherit',boxSizing:'border-box',lineHeight:1.6}}/>
            </div>
          )}
          {dest === 'project' && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:'#888',marginBottom:8}}>어떤 프로젝트에 연결할까요?</div>
              {projects.length === 0
                ? <div style={{fontSize:12,color:'#bbb',textAlign:'center',padding:16}}>아직 프로젝트가 없어요</div>
                : projects.map(p=>(
                  <button key={p.id} onClick={()=>setProjId(p.id)} style={{width:'100%',padding:'11px 14px',borderRadius:12,border:`1.5px solid ${projId===p.id?'#7C3AED':'rgba(0,0,0,.1)'}`,background:projId===p.id?'rgba(124,58,237,.06)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',gap:10,textAlign:'left',marginBottom:6}}>
                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,color:'#111'}}>{p.title}</div>{p.due&&<DDay due={p.due}/>}</div>
                    {projId===p.id && <span style={{color:'#7C3AED'}}>✓</span>}
                  </button>
                ))
              }
            </div>
          )}
        </div>
        <div style={{padding:'12px 18px',borderTop:'0.5px solid #f0f0f0',background:'#fff'}}>
          {!tags.length && <div style={{fontSize:11,color:'#EA580C',textAlign:'center',marginBottom:8}}>태그를 1개 이상 선택해주세요</div>}
          <button onClick={()=>tags.length&&onProcess(item.id,tags,dest,dest==='project'?projId:null,myNote)} disabled={!tags.length}
            style={{width:'100%',padding:15,borderRadius:14,background:tags.length?'#7C3AED':'#e5e5e5',color:tags.length?'white':'#aaa',border:'none',cursor:tags.length?'pointer':'default',fontSize:15,fontWeight:700}}>
            {dest==='resource' ? '📚 자료함에 저장' : '🎯 프로젝트에 연결'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── ReportModal ─── */
function ReportModal({ item, allTags, onClose }) {
  const [loading,setLoading] = useState(true);
  const [report,setReport]   = useState('');
  const [error,setError]     = useState('');
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(AI_REPORT_ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:item.url,title:item.title,userTags:allTags}) });
        const data = await res.json();
        if (data.report) setReport(data.report); else setError('리포트 생성에 실패했어요.');
      } catch(e) { setError('네트워크 오류가 발생했어요.'); }
      setLoading(false);
    })();
  }, []);

  const renderMd = text => text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#111">$1</strong>')
    .replace(/^## (.+)$/gm, '<div style="font-size:14px;font-weight:700;color:#7C3AED;margin:18px 0 8px;padding-bottom:5px;border-bottom:1.5px solid rgba(124,58,237,.15)">$1</div>')
    .replace(/^한 줄 요약: (.+)$/gm, '<div style="background:rgba(124,58,237,.07);border-left:3px solid #7C3AED;padding:10px 12px;border-radius:0 10px 10px 0;font-size:14px;font-weight:600;color:#111;margin-bottom:10px;line-height:1.5">$1</div>')
    .replace(/^출처: (.+)$/gm, '<div style="font-size:11px;color:#bbb;margin-top:16px;text-align:right">$1</div>')
    .replace(/^- \[ \] (.+)$/gm, '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:0.5px solid #f5f5f5"><span style="width:20px;height:20px;border:1.5px solid #ddd;border-radius:5px;flex-shrink:0;margin-top:1px;display:inline-block"></span><span style="font-size:13px;color:#333;line-height:1.5">$1</span></div>')
    .replace(/^• (.+)$/gm, '<div style="display:flex;gap:8px;padding:4px 0"><span style="color:#7C3AED;font-weight:700;flex-shrink:0">›</span><span style="font-size:13px;color:#333;line-height:1.5">$1</span></div>')
    .replace(/^주요 포인트:$/gm, '<div style="font-size:12px;color:#aaa;font-weight:600;margin:6px 0 2px">주요 포인트</div>')
    .replace(/\n\n/g, '<div style="height:4px"></div>');

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:400,display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#fff',borderRadius:'22px 22px 0 0',width:'100%',maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'12px 18px 10px',borderBottom:'0.5px solid #f0f0f0',flexShrink:0}}>
          <div style={{width:36,height:4,background:'#ddd',borderRadius:2,margin:'0 auto 14px'}}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{fontSize:13,color:'#7C3AED',fontWeight:700,marginBottom:3}}>📋 인텔리전스 리포트</div>
              <div style={{fontSize:13,fontWeight:600,color:'#111',lineHeight:1.4}}>{item.title}</div>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,color:'#aaa',cursor:'pointer',padding:0}}>×</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'16px 18px 32px'}}>
          {loading && (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'40px 0',gap:14}}>
              <span className="spin" style={{display:'block',width:36,height:36,border:'3px solid #7C3AED',borderTopColor:'transparent',borderRadius:'50%'}}/>
              <div style={{fontSize:13,color:'#aaa',textAlign:'center',lineHeight:1.7}}>자막 분석 중…<br/><span style={{fontSize:11}}>영상 길이에 따라 10~20초 소요됩니다</span></div>
            </div>
          )}
          {error && <div style={{color:'#DC2626',fontSize:13,textAlign:'center',padding:20}}>{error}</div>}
          {report && <div style={{fontSize:13,color:'#333',lineHeight:1.7}} dangerouslySetInnerHTML={{__html:renderMd(report)}}/>}
        </div>
      </div>
    </div>
  );
}

/* ─── RetroModal ─── */
function RetroModal({ project, onClose, onComplete }) {
  const [wellDone,setWellDone] = useState('');
  const [learned,setLearned]   = useState('');
  const [nextTime,setNextTime] = useState('');
  const ta = { width:'100%', padding:'11px 14px', borderRadius:12, border:'1px solid rgba(124,58,237,.2)', background:'#faf9ff', fontSize:13, color:'#111', outline:'none', resize:'none', fontFamily:'inherit', boxSizing:'border-box', lineHeight:1.6 };
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:400,display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#fff',borderRadius:'22px 22px 0 0',width:'100%',maxHeight:'92vh',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'16px 18px 12px',borderBottom:'0.5px solid #f0f0f0',flexShrink:0}}>
          <div style={{width:36,height:4,background:'#ddd',borderRadius:2,margin:'0 auto 14px'}}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:14,color:'#0D9488',fontWeight:700,marginBottom:3}}>🎉 프로젝트 완료 회고</div>
              <div style={{fontSize:15,fontWeight:700,color:'#111'}}>{project.title}</div>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,color:'#aaa',cursor:'pointer'}}>×</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'18px 18px 8px'}}>
          <div style={{fontSize:12,color:'#888',lineHeight:1.7,marginBottom:20,padding:'10px 14px',background:'rgba(13,148,136,.06)',borderRadius:12,border:'0.5px solid rgba(13,148,136,.2)'}}>
            회고는 성장의 시작입니다. 짧게라도 적어두면<br/>다음 프로젝트가 훨씬 수월해집니다 ✨
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:'#059669',marginBottom:8}}>✅ 잘된 점</div>
            <textarea value={wellDone} onChange={e=>setWellDone(e.target.value)} placeholder="이번 프로젝트에서 잘 된 것들…" rows={3} style={ta}/>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:'#2563EB',marginBottom:8}}>💡 배운 점</div>
            <textarea value={learned} onChange={e=>setLearned(e.target.value)} placeholder="새로 알게 된 것, 깨달은 것…" rows={3} style={ta}/>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:'#D97706',marginBottom:8}}>🔄 다음엔 다르게</div>
            <textarea value={nextTime} onChange={e=>setNextTime(e.target.value)} placeholder="다음에는 이렇게 해볼 것…" rows={3} style={ta}/>
          </div>
        </div>
        <div style={{padding:'12px 18px',borderTop:'0.5px solid #f0f0f0',flexShrink:0}}>
          <button onClick={()=>onComplete({wellDone,learned,nextTime})}
            style={{width:'100%',padding:15,borderRadius:14,background:'#0D9488',color:'white',border:'none',cursor:'pointer',fontSize:15,fontWeight:700}}>
            🗂 완료하고 보관함으로 이동
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── AddProjectModal (archive insights 포함) ─── */
function AddProjectModal({ onClose, onSave, archives }) {
  const [title,setTitle] = useState('');
  const [due,setDue]     = useState('');
  const [checks,setChecks] = useState([]);
  const [ckInput,setCkInput] = useState('');
  const ref = useRef();
  const ckRef = useRef();
  useEffect(() => { setTimeout(() => ref.current?.focus(), 100); }, []);

  const addCheck = () => {
    const t = ckInput.trim(); if (!t) return;
    setChecks(p => [...p, t]); setCkInput('');
    setTimeout(() => ckRef.current?.focus(), 50);
  };

  const relatedArchives = useMemo(() => {
    if (!title.trim() || !archives?.length) return [];
    const words = title.trim().toLowerCase().split(/\s+/).filter(w=>w.length>1);
    if (!words.length) return [];
    return archives.filter(a =>
      a.originalType === 'project' && a.retro &&
      words.some(w => (a.title||'').toLowerCase().includes(w))
    ).slice(0,3);
  }, [title, archives]);

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:300,display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="su" style={{background:'#fff',borderRadius:'22px 22px 0 0',width:'100%',maxHeight:'90vh',display:'flex',flexDirection:'column',paddingBottom:'env(safe-area-inset-bottom)'}}>
        <div style={{padding:'16px 18px 12px',borderBottom:'0.5px solid #f0f0f0',flexShrink:0}}>
          <div style={{width:36,height:4,background:'#ddd',borderRadius:2,margin:'0 auto 14px'}}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:17,fontWeight:700,color:'#111'}}>🎯 새 프로젝트</div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,color:'#aaa',cursor:'pointer'}}>×</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'16px 18px'}}>
          <input ref={ref} value={title} onChange={e=>setTitle(e.target.value)} placeholder="프로젝트 이름 *"
            style={{width:'100%',padding:'13px 15px',borderRadius:13,border:'1.5px solid rgba(124,58,237,.3)',background:'#faf9ff',fontSize:15,color:'#111',outline:'none',marginBottom:16,boxSizing:'border-box'}}/>
          {relatedArchives.length > 0 && (
            <div style={{marginBottom:16,padding:'12px 14px',background:'rgba(13,148,136,.06)',borderRadius:14,border:'1px solid rgba(13,148,136,.2)'}}>
              <div style={{fontSize:12,fontWeight:700,color:'#0D9488',marginBottom:8}}>💡 비슷한 과거 프로젝트 인사이트</div>
              {relatedArchives.map(a=>(
                <div key={a.id} style={{marginBottom:8,padding:'8px 10px',background:'white',borderRadius:10,border:'0.5px solid rgba(13,148,136,.15)'}}>
                  <div style={{fontSize:12,fontWeight:600,color:'#555',marginBottom:4}}>{a.title}</div>
                  {a.retro?.learned && <div style={{fontSize:11,color:'#2563EB'}}>💡 {a.retro.learned.slice(0,70)}{a.retro.learned.length>70?'…':''}</div>}
                  {a.retro?.nextTime && <div style={{fontSize:11,color:'#D97706',marginTop:2}}>🔄 {a.retro.nextTime.slice(0,70)}{a.retro.nextTime.length>70?'…':''}</div>}
                </div>
              ))}
            </div>
          )}
          <div style={{marginBottom:18}}>
            <label style={{fontSize:12,color:'#aaa',fontWeight:600,display:'block',marginBottom:6}}>마감일 (없으면 비워두세요)</label>
            <input type="date" value={due} onChange={e=>setDue(e.target.value)}
              style={{width:'100%',padding:'11px 14px',borderRadius:12,border:'0.5px solid rgba(0,0,0,.12)',background:'#f9f9f7',fontSize:14,color:'#333',outline:'none',boxSizing:'border-box'}}/>
          </div>
          <div>
            <label style={{fontSize:12,color:'#aaa',fontWeight:600,display:'block',marginBottom:8}}>체크리스트 <span style={{color:'#bbb',fontWeight:400}}>— 할 일을 한 줄씩</span></label>
            {checks.map((t,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:'#f9f9f7',borderRadius:10,marginBottom:6,border:'0.5px solid rgba(0,0,0,.08)'}}>
                <div style={{width:18,height:18,borderRadius:'50%',border:'1.5px solid #ddd',flexShrink:0}}/>
                <span style={{flex:1,fontSize:14,color:'#333'}}>{t}</span>
                <button onClick={()=>setChecks(p=>p.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:'#ccc',fontSize:18,cursor:'pointer',padding:0,lineHeight:1}}>×</button>
              </div>
            ))}
            <div style={{display:'flex',gap:8}}>
              <input ref={ckRef} value={ckInput} onChange={e=>setCkInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCheck()} placeholder="할 일 입력 후 + 또는 Enter"
                style={{flex:1,padding:'11px 13px',borderRadius:11,border:'1px solid rgba(124,58,237,.2)',background:'#faf9ff',fontSize:13,color:'#111',outline:'none'}}/>
              <button onClick={addCheck} disabled={!ckInput.trim()} style={{padding:'11px 16px',borderRadius:11,background:ckInput.trim()?'#7C3AED':'#e5e5e5',color:ckInput.trim()?'white':'#aaa',border:'none',cursor:ckInput.trim()?'pointer':'default',fontSize:18,fontWeight:700}}>+</button>
            </div>
          </div>
        </div>
        <div style={{padding:'12px 18px',borderTop:'0.5px solid #f0f0f0',flexShrink:0}}>
          <button onClick={()=>title.trim()&&onSave({title,due:due||null,checks:checks.map((t,i)=>({id:String(Date.now()+i),t,d:false}))})} disabled={!title.trim()}
            style={{width:'100%',padding:15,borderRadius:14,background:title.trim()?'#7C3AED':'#e5e5e5',color:title.trim()?'white':'#aaa',border:'none',cursor:title.trim()?'pointer':'default',fontSize:15,fontWeight:700}}>
            프로젝트 만들기 {checks.length>0 && `(체크리스트 ${checks.length}개)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── AddAreaModal ─── */
function AddAreaModal({ onClose, onSave }) {
  const [title,setTitle] = useState('');
  const [desc,setDesc]   = useState('');
  const ref = useRef();
  useEffect(() => { setTimeout(() => ref.current?.focus(), 100); }, []);
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:300,display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="su" style={{background:'#fff',borderRadius:'22px 22px 0 0',width:'100%',paddingBottom:'env(safe-area-inset-bottom)'}}>
        <div style={{padding:'16px 18px 12px',borderBottom:'0.5px solid #f0f0f0'}}>
          <div style={{width:36,height:4,background:'#ddd',borderRadius:2,margin:'0 auto 14px'}}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:17,fontWeight:700,color:'#111'}}>🏛 새 영역</div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,color:'#aaa',cursor:'pointer'}}>×</button>
          </div>
        </div>
        <div style={{padding:'16px 18px'}}>
          <div style={{fontSize:12,color:'#888',lineHeight:1.7,marginBottom:16,padding:'10px 14px',background:'rgba(124,58,237,.05)',borderRadius:12,border:'0.5px solid rgba(124,58,237,.15)'}}>
            영역은 <b>마감일 없이 지속적으로 유지하는 책임</b>입니다.<br/>예: 건강, 재무, 사업운영, 인간관계
          </div>
          <input ref={ref} value={title} onChange={e=>setTitle(e.target.value)} placeholder="영역 이름 * (예: 건강, 사업운영)"
            style={{width:'100%',padding:'13px 15px',borderRadius:13,border:'1.5px solid rgba(124,58,237,.3)',background:'#faf9ff',fontSize:15,color:'#111',outline:'none',marginBottom:12,boxSizing:'border-box'}}/>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="이 영역의 기준이나 목표 상태는? (선택)" rows={3}
            style={{width:'100%',padding:'11px 14px',borderRadius:12,border:'0.5px solid rgba(0,0,0,.12)',background:'#f9f9f7',fontSize:13,color:'#333',outline:'none',resize:'none',fontFamily:'inherit',boxSizing:'border-box',lineHeight:1.6,marginBottom:16}}/>
          <button onClick={()=>title.trim()&&onSave({title,desc})} disabled={!title.trim()}
            style={{width:'100%',padding:15,borderRadius:14,background:title.trim()?'#7C3AED':'#e5e5e5',color:title.trim()?'white':'#aaa',border:'none',cursor:title.trim()?'pointer':'default',fontSize:15,fontWeight:700}}>
            영역 만들기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── LinkResourcePanel ─── */
function LinkResourcePanel({ project, resources, onLink, onClose, allTags }) {
  const [tagFilter,setTagFilter] = useState([]);
  const [selected,setSelected]   = useState([]);
  const alreadyLinked = project.linkedIds || [];
  const usedTags = [...new Set(resources.flatMap(r=>r.tags))].sort();
  const toggleTag = t => setTagFilter(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t]);
  const toggleRes = id => setSelected(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const available = resources.filter(r => {
    if (alreadyLinked.includes(r.id)) return false;
    if (tagFilter.length === 0) return true;
    return tagFilter.some(t=>r.tags.includes(t));
  });
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:300,display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="su" style={{background:'#fff',borderRadius:'22px 22px 0 0',width:'100%',maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
        <div style={{width:36,height:4,background:'#ddd',borderRadius:2,margin:'12px auto 0'}}/>
        <div style={{padding:'14px 18px 12px',borderBottom:'0.5px solid #f0f0f0'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:'#111'}}>📚 자료 연결하기</div>
              <div style={{fontSize:12,color:'#aaa',marginTop:2}}>"{project.title}"에 가져올 자료 선택</div>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,color:'#aaa',cursor:'pointer'}}>×</button>
          </div>
        </div>
        <div style={{padding:'12px 18px',borderBottom:'0.5px solid #f0f0f0',flexShrink:0}}>
          <div style={{display:'flex',gap:7,overflowX:'auto',paddingBottom:4}}>
            {usedTags.map(t=><Tag key={t} label={t} selected={tagFilter.includes(t)} onToggle={toggleTag} allTags={allTags} size="sm"/>)}
            {tagFilter.length>0 && <button onClick={()=>setTagFilter([])} style={{padding:'3px 10px',borderRadius:20,border:'0.5px solid rgba(0,0,0,.12)',background:'transparent',color:'#aaa',fontSize:11,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>전체 보기</button>}
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'12px 18px'}}>
          <div style={{fontSize:11,fontWeight:600,color:'#aaa',marginBottom:10}}>연결할 자료 선택 ({selected.length}개)</div>
          {available.length===0 && (
            <div style={{textAlign:'center',padding:30,color:'#bbb'}}>
              <div style={{fontSize:32,marginBottom:8}}>📭</div>
              <div style={{fontSize:13}}>{tagFilter.length>0?'선택한 태그에 해당하는 자료가 없어요':'자료함이 비어있어요'}</div>
            </div>
          )}
          {available.map(r => {
            const isSel = selected.includes(r.id);
            return (
              <div key={r.id} onClick={()=>toggleRes(r.id)} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 14px',borderRadius:14,marginBottom:8,cursor:'pointer',background:isSel?'rgba(124,58,237,.07)':'#f9f9f7',border:`1.5px solid ${isSel?'#7C3AED':'rgba(0,0,0,.07)'}`}}>
                <div style={{width:22,height:22,borderRadius:'50%',flexShrink:0,border:`2px solid ${isSel?'#7C3AED':'#ddd'}`,background:isSel?'#7C3AED':'transparent',display:'flex',alignItems:'center',justifyContent:'center',marginTop:1}}>
                  {isSel && <svg width="12" height="10" viewBox="0 0 12 10"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  {r.url && <div style={{fontSize:10,fontWeight:600,color:isYT(r.url)?'#DC2626':'#7C3AED',marginBottom:3}}>{isYT(r.url)?'▶ YouTube':isIG(r.url)?'📷 Instagram':'🔗 링크'}</div>}
                  <div style={{fontSize:14,fontWeight:500,color:'#111',marginBottom:4}}>{r.title}</div>
                  {r.note && <div style={{fontSize:12,color:'#888',marginBottom:6,lineHeight:1.4}}>{r.note}</div>}
                  <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{r.tags.map(t=><Tag key={t} label={t} selected allTags={allTags} size="sm"/>)}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{padding:'12px 18px',borderTop:'0.5px solid #f0f0f0',background:'#fff'}}>
          <button onClick={()=>selected.length&&onLink(selected)} disabled={!selected.length}
            style={{width:'100%',padding:15,borderRadius:14,background:selected.length?'#7C3AED':'#e5e5e5',color:selected.length?'white':'#aaa',border:'none',cursor:selected.length?'pointer':'default',fontSize:15,fontWeight:700}}>
            {selected.length ? `📎 ${selected.length}개 자료 연결하기` : '자료를 선택해주세요'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── InboxView ─── */
function InboxView({ items, projects, allTags, onProcess, onDelete }) {
  const [proc,setProc] = useState(null);
  if (!items.length) return (
    <div style={{textAlign:'center',padding:'60px 30px',color:'#aaa'}}>
      <div style={{fontSize:48,marginBottom:12}}>📥</div>
      <div style={{fontSize:16,fontWeight:600,color:'#555',marginBottom:6}}>수신함이 비어있어요</div>
      <div style={{fontSize:13,lineHeight:1.6}}>아래 ✏️ 버튼을 눌러<br/>생각이 떠오를 때마다 바로 던져두세요</div>
    </div>
  );
  return (
    <div>
      <div style={{fontSize:12,color:'#aaa',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span>{items.length}개 처리 대기 중</span>
        <span style={{color:'#7C3AED',fontSize:11,fontWeight:500}}>탭하여 처리 →</span>
      </div>
      {items.map(item => (
        <div key={item.id} className="fi" style={{background:'#fff',borderRadius:16,padding:'14px 16px',marginBottom:10,border:'0.5px solid rgba(0,0,0,.07)'}}>
          <div onClick={()=>setProc(item)} style={{cursor:'pointer'}}>
            {item.url && (
              <div style={{marginBottom:6}}>
                <span style={{fontSize:12,background:isYT(item.url)?'rgba(220,38,38,.1)':'rgba(124,58,237,.1)',color:isYT(item.url)?'#DC2626':'#7C3AED',padding:'2px 8px',borderRadius:10,fontWeight:500}}>
                  {isYT(item.url)?'▶ YouTube':isIG(item.url)?'📷 Instagram':'🔗 링크'}
                </span>
              </div>
            )}
            <div style={{fontSize:15,fontWeight:500,color:'#111',marginBottom:3}}>{item.title}</div>
            {item.note && <div style={{fontSize:12,color:'#888',marginBottom:6}}>{item.note}</div>}
            {item.aiTags?.length>0 && (
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:6}}>
                <span style={{fontSize:10,color:'#7C3AED',fontWeight:600}}>🤖</span>
                {item.aiTags.map(t=><Tag key={t} label={t} selected allTags={allTags} size="sm"/>)}
              </div>
            )}
            <div style={{fontSize:11,color:'#bbb'}}>{item.createdAt}</div>
          </div>
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <button onClick={()=>setProc(item)} style={{flex:1,padding:9,borderRadius:10,background:'rgba(124,58,237,.08)',color:'#7C3AED',border:'1px solid rgba(124,58,237,.2)',cursor:'pointer',fontSize:13,fontWeight:600}}>처리하기 →</button>
            {item.url && <button onClick={()=>window.open(item.url,'_blank')} style={{padding:'9px 12px',borderRadius:10,background:'rgba(13,148,136,.08)',color:'#0D9488',border:'0.5px solid rgba(13,148,136,.25)',cursor:'pointer',fontSize:13,fontWeight:600}}>🔗 열기</button>}
            <button onClick={()=>onDelete(item.id)} style={{padding:'9px 12px',borderRadius:10,background:'rgba(0,0,0,.04)',color:'#aaa',border:'0.5px solid rgba(0,0,0,.08)',cursor:'pointer',fontSize:13}}>삭제</button>
          </div>
        </div>
      ))}
      {proc && <ProcessModal item={proc} projects={projects} allTags={allTags}
        onClose={()=>setProc(null)}
        onProcess={(id,tags,dest,projId,myNote)=>{onProcess(id,tags,dest,projId,myNote);setProc(null);}}/>}
    </div>
  );
}

/* ─── ResourceView ─── */
function ResourceView({ items, projects, allTags, onLinkToProject, onDelete }) {
  const [filter,setFilter]     = useState([]);
  const [sel,setSel]           = useState(null);
  const [reportItem,setReportItem] = useState(null);
  const [confirmDel,setConfirmDel] = useState(null);
  const usedTags = [...new Set(items.flatMap(i=>i.tags))].sort();
  const toggle = t => setFilter(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t]);
  const filtered = filter.length ? items.filter(i=>filter.some(t=>i.tags.includes(t))) : items;
  return (
    <div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:12,color:'#aaa',marginBottom:8}}>태그로 필터링</div>
        <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>
          {usedTags.map(t=><Tag key={t} label={t} selected={filter.includes(t)} onToggle={toggle} allTags={allTags} size="sm"/>)}
          {filter.length>0 && <button onClick={()=>setFilter([])} style={{padding:'3px 10px',borderRadius:20,border:'0.5px solid rgba(0,0,0,.12)',background:'transparent',color:'#aaa',fontSize:11,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>초기화</button>}
        </div>
      </div>
      <div style={{fontSize:12,color:'#aaa',marginBottom:10}}>{filtered.length}개 자료</div>
      {!filtered.length && <div style={{textAlign:'center',padding:40,color:'#aaa'}}><div style={{fontSize:40,marginBottom:8}}>📚</div><div>자료가 없어요</div></div>}
      {filtered.map(item => (
        <div key={item.id} className="fi" onClick={()=>setSel(sel?.id===item.id?null:item)}
          style={{background:'#fff',borderRadius:16,padding:'14px 16px',marginBottom:10,border:`0.5px solid ${sel?.id===item.id?'rgba(217,119,6,.4)':'rgba(0,0,0,.07)'}`,borderLeft:sel?.id===item.id?'3px solid #D97706':'0.5px solid rgba(0,0,0,.07)',cursor:'pointer'}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:6}}>
            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',flex:1}}>
              {item.url && (
                <>
                  <span style={{fontSize:11,color:isYT(item.url)?'#DC2626':'#7C3AED',fontWeight:500}}>{isYT(item.url)?'▶ YouTube':isIG(item.url)?'📷 Instagram':'🔗 링크'}</span>
                  <button onClick={e=>{e.stopPropagation();window.open(item.url,'_blank');}} style={{fontSize:11,padding:'2px 9px',borderRadius:10,background:'rgba(13,148,136,.08)',color:'#0D9488',border:'0.5px solid rgba(13,148,136,.25)',cursor:'pointer',fontWeight:600}}>열기</button>
                  {isYT(item.url) && <button onClick={e=>{e.stopPropagation();setReportItem(item);}} style={{fontSize:11,padding:'2px 9px',borderRadius:10,background:'rgba(124,58,237,.08)',color:'#7C3AED',border:'0.5px solid rgba(124,58,237,.25)',cursor:'pointer',fontWeight:600}}>📋 AI 리포트</button>}
                </>
              )}
            </div>
            <button onClick={e=>{e.stopPropagation();setConfirmDel(item.id);}} style={{background:'none',border:'none',color:'#ccc',fontSize:18,cursor:'pointer',padding:'0 0 0 8px',lineHeight:1,flexShrink:0}}>×</button>
          </div>
          <div style={{fontSize:15,fontWeight:500,color:'#111',marginBottom:6}}>{item.title}</div>
          {item.myNote && <div style={{fontSize:12,color:'#7C3AED',marginBottom:5,fontStyle:'italic',lineHeight:1.5}}>💭 {item.myNote}</div>}
          {item.note && <div style={{fontSize:12,color:'#888',marginBottom:7,lineHeight:1.5}}>{item.note}</div>}
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{item.tags.map(t=><Tag key={t} label={t} selected allTags={allTags} size="sm"/>)}</div>
          {sel?.id===item.id && (
            <div className="fi" style={{marginTop:12,paddingTop:12,borderTop:'0.5px solid #f0f0f0'}}>
              <div style={{fontSize:11,color:'#aaa',marginBottom:8}}>프로젝트에 연결</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {projects.map(p=>(
                  <button key={p.id} onClick={e=>{e.stopPropagation();onLinkToProject(item.id,p.id);}} style={{padding:'5px 12px',borderRadius:20,background:'rgba(124,58,237,.08)',color:'#7C3AED',border:'0.5px solid rgba(124,58,237,.2)',cursor:'pointer',fontSize:12,fontWeight:500}}>🎯 {p.title}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      {reportItem && <ReportModal item={reportItem} allTags={allTags} onClose={()=>setReportItem(null)}/>}
      {confirmDel && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={()=>setConfirmDel(null)}>
          <div style={{background:'#fff',borderRadius:20,padding:'24px 20px',width:'100%',maxWidth:320}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:28,textAlign:'center',marginBottom:10}}>🗑️</div>
            <div style={{fontSize:15,fontWeight:700,color:'#111',textAlign:'center',marginBottom:6}}>자료를 삭제할까요?</div>
            <div style={{fontSize:12,color:'#aaa',textAlign:'center',marginBottom:20}}>삭제된 자료는 복구할 수 없어요</div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setConfirmDel(null)} style={{flex:1,padding:12,borderRadius:12,background:'#f5f5f3',color:'#555',border:'none',cursor:'pointer',fontSize:14,fontWeight:600}}>취소</button>
              <button onClick={()=>{onDelete(confirmDel);setConfirmDel(null);setSel(null);}} style={{flex:1,padding:12,borderRadius:12,background:'#DC2626',color:'white',border:'none',cursor:'pointer',fontSize:14,fontWeight:600}}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ProjectView ─── */
function ProjectView({ projects, resources, allTags, onCheck, onCheckAdd, onCheckDelete, onAddProject, onLinkResources, onUnlink, onAIRecommend, onCompleteProject }) {
  const [sel,setSel]           = useState(null);
  const [showLink,setShowLink] = useState(false);
  const [aiLoading,setAiLoading] = useState(false);
  const [ckInput,setCkInput]   = useState('');
  const [reportItem,setReportItem] = useState(null);
  const [showRetro,setShowRetro]   = useState(false);
  const selP = sel ? projects.find(p=>p.id===sel) : null;
  const linkedRes = selP ? resources.filter(r=>(selP.linkedIds||[]).includes(r.id)) : [];
  const p = selP ? pct(selP.checks) : null;

  const handleAIRecommend = async () => {
    if (!selP) return;
    setAiLoading(true);
    try {
      const unlinked = resources.filter(r=>!(selP.linkedIds||[]).includes(r.id));
      const recommended = await onAIRecommend(selP, unlinked);
      if (recommended?.length) { onLinkResources(selP.id, recommended); alert(`🤖 AI가 ${recommended.length}개 자료를 추천해 연결했어요!`); }
      else alert('추천할 자료를 찾지 못했어요.');
    } catch(e) { console.error(e); alert('AI 추천 실패'); }
    setAiLoading(false);
  };

  // selP가 완료/아카이브로 이동했으면 sel 초기화
  useEffect(() => {
    if (sel && !projects.find(p=>p.id===sel)) { setSel(null); setShowLink(false); setShowRetro(false); }
  }, [projects, sel]);

  return (
    <div>
      {!selP ? (
        <>
          <button onClick={onAddProject} style={{width:'100%',padding:14,borderRadius:14,background:'rgba(124,58,237,.06)',border:'1.5px dashed rgba(124,58,237,.3)',color:'#7C3AED',cursor:'pointer',fontSize:14,fontWeight:600,marginBottom:14}}>
            + 새 프로젝트 추가
          </button>
          {projects.length===0 && (
            <div style={{textAlign:'center',padding:'50px 30px',color:'#aaa'}}>
              <div style={{fontSize:44,marginBottom:12}}>🎯</div>
              <div style={{fontSize:15,fontWeight:600,color:'#555',marginBottom:6}}>아직 프로젝트가 없어요</div>
              <div style={{fontSize:13,lineHeight:1.6}}>목표가 있는 일을<br/>프로젝트로 만들어보세요</div>
            </div>
          )}
          {projects.map(proj => {
            const pp = pct(proj.checks);
            return (
              <div key={proj.id} onClick={()=>setSel(proj.id)} className="fi" style={{background:'#fff',borderRadius:16,padding:16,marginBottom:10,border:'0.5px solid rgba(0,0,0,.07)',cursor:'pointer',borderTop:'3px solid #7C3AED'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                  <div style={{fontSize:16,fontWeight:600,color:'#111',flex:1,paddingRight:8}}>{proj.title}</div>
                  <DDay due={proj.due}/>
                </div>
                {pp !== null && (
                  <>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:11,color:'#aaa'}}>진행률</span>
                      <span style={{fontSize:11,fontWeight:600,color:pp===100?'#0D9488':'#7C3AED'}}>{pp}%</span>
                    </div>
                    <div style={{background:'#f0f0f0',borderRadius:4,height:5,overflow:'hidden',marginBottom:8}}>
                      <div style={{height:'100%',borderRadius:4,background:pp===100?'#0D9488':'#7C3AED',width:`${pp}%`,transition:'width .4s'}}/>
                    </div>
                  </>
                )}
                <div style={{fontSize:11,color:'#aaa'}}>연결 자료 {(proj.linkedIds||[]).length}개</div>
              </div>
            );
          })}
        </>
      ) : (
        <div className="fi">
          <button onClick={()=>{setSel(null);setShowLink(false);}} style={{background:'none',border:'none',color:'#7C3AED',fontSize:14,fontWeight:500,cursor:'pointer',marginBottom:14,padding:0}}>
            ← 프로젝트 목록
          </button>
          <div style={{background:'#fff',borderRadius:16,padding:16,marginBottom:12,border:'0.5px solid rgba(0,0,0,.07)',borderTop:'3px solid #7C3AED'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div style={{fontSize:18,fontWeight:700,color:'#111',flex:1}}>{selP.title}</div>
              <DDay due={selP.due}/>
            </div>
            {/* 체크리스트 */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontSize:12,fontWeight:600,color:'#555'}}>체크리스트 {p!==null && <span style={{color:'#7C3AED'}}>({p}%)</span>}</div>
              <span style={{fontSize:11,color:'#bbb'}}>{(selP.checks||[]).filter(c=>c.d).length}/{(selP.checks||[]).length} 완료</span>
            </div>
            {(selP.checks||[]).map(ck => (
              <div key={ck.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'0.5px solid #f5f5f5'}}>
                <div onClick={()=>onCheck(selP.id,ck.id)} style={{width:22,height:22,borderRadius:'50%',flexShrink:0,border:`2px solid ${ck.d?'#0D9488':'#ddd'}`,background:ck.d?'#0D9488':'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                  {ck.d && <svg width="11" height="9" viewBox="0 0 11 9"><path d="M1 4.5l3.5 3.5 5.5-7" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span onClick={()=>onCheck(selP.id,ck.id)} style={{fontSize:14,color:ck.d?'#bbb':'#333',textDecoration:ck.d?'line-through':'none',flex:1,cursor:'pointer'}}>{ck.t}</span>
                <button onClick={()=>onCheckDelete(selP.id,ck.id)} style={{background:'none',border:'none',color:'#ddd',fontSize:16,cursor:'pointer',padding:0,lineHeight:1}}>×</button>
              </div>
            ))}
            <div style={{display:'flex',gap:8,marginTop:10}}>
              <input value={ckInput} onChange={e=>setCkInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&ckInput.trim()){onCheckAdd(selP.id,ckInput.trim());setCkInput('');}}}
                placeholder="할 일 추가…"
                style={{flex:1,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(124,58,237,.2)',background:'#faf9ff',fontSize:13,color:'#111',outline:'none'}}/>
              <button onClick={()=>{if(ckInput.trim()){onCheckAdd(selP.id,ckInput.trim());setCkInput('');}}} disabled={!ckInput.trim()}
                style={{padding:'9px 14px',borderRadius:10,background:ckInput.trim()?'#7C3AED':'#e5e5e5',color:ckInput.trim()?'white':'#aaa',border:'none',cursor:ckInput.trim()?'pointer':'default',fontSize:16,fontWeight:700}}>+</button>
            </div>
            {/* 완료하기 버튼 */}
            <button onClick={()=>setShowRetro(true)} style={{width:'100%',marginTop:16,padding:'12px',borderRadius:12,background:'rgba(13,148,136,.08)',color:'#0D9488',border:'1.5px solid rgba(13,148,136,.3)',cursor:'pointer',fontSize:14,fontWeight:700}}>
              ✅ 프로젝트 완료하기
            </button>
          </div>
          {/* 연결 자료 */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontSize:14,fontWeight:700,color:'#333'}}>📚 연결된 자료 <span style={{color:'#aaa',fontWeight:400,fontSize:12}}>({linkedRes.length}개)</span></div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={handleAIRecommend} disabled={aiLoading} style={{padding:'7px 10px',borderRadius:20,background:'rgba(124,58,237,.08)',color:'#7C3AED',border:'1px solid rgba(124,58,237,.2)',cursor:'pointer',fontSize:11,fontWeight:600}}>
                {aiLoading ? '...' : '🤖 AI 추천'}
              </button>
              <button onClick={()=>setShowLink(true)} style={{padding:'7px 14px',borderRadius:20,background:'rgba(217,119,6,.08)',color:'#D97706',border:'1px solid rgba(217,119,6,.25)',cursor:'pointer',fontSize:12,fontWeight:600}}>+ 가져오기</button>
            </div>
          </div>
          {linkedRes.length===0 && (
            <div onClick={()=>setShowLink(true)} style={{textAlign:'center',padding:28,background:'#f9f9f7',borderRadius:14,border:'1.5px dashed rgba(217,119,6,.3)',cursor:'pointer',marginBottom:10}}>
              <div style={{fontSize:28,marginBottom:6}}>📚</div>
              <div style={{fontSize:13,color:'#aaa',marginBottom:4}}>연결된 자료가 없어요</div>
              <div style={{fontSize:12,color:'#D97706',fontWeight:600}}>+ 자료함에서 가져오기</div>
            </div>
          )}
          {linkedRes.map(r => (
            <div key={r.id} style={{background:'rgba(217,119,6,.05)',borderRadius:13,padding:'13px 14px',marginBottom:8,border:'0.5px solid rgba(217,119,6,.2)'}}>
              {r.url && (
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6,flexWrap:'wrap'}}>
                  <span style={{fontSize:10,fontWeight:600,color:isYT(r.url)?'#DC2626':'#7C3AED'}}>{isYT(r.url)?'▶ YouTube':isIG(r.url)?'📷 Instagram':'🔗 링크'}</span>
                  <button onClick={()=>window.open(r.url,'_blank')} style={{fontSize:11,padding:'2px 9px',borderRadius:10,background:'rgba(13,148,136,.1)',color:'#0D9488',border:'0.5px solid rgba(13,148,136,.3)',cursor:'pointer',fontWeight:600}}>열기</button>
                  {isYT(r.url) && <button onClick={()=>setReportItem(r)} style={{fontSize:11,padding:'2px 9px',borderRadius:10,background:'rgba(124,58,237,.1)',color:'#7C3AED',border:'0.5px solid rgba(124,58,237,.3)',cursor:'pointer',fontWeight:600}}>📋 AI 리포트</button>}
                  <div style={{flex:1}}/>
                  <button onClick={()=>onUnlink(selP.id,r.id)} style={{background:'none',border:'none',color:'#ccc',fontSize:18,cursor:'pointer',padding:0,lineHeight:1}}>×</button>
                </div>
              )}
              {!r.url && <div style={{display:'flex',justifyContent:'flex-end',marginBottom:4}}><button onClick={()=>onUnlink(selP.id,r.id)} style={{background:'none',border:'none',color:'#ccc',fontSize:18,cursor:'pointer',padding:0,lineHeight:1}}>×</button></div>}
              <div style={{fontSize:13,fontWeight:600,color:'#78350F',marginBottom:4}}>{r.title}</div>
              {r.myNote && <div style={{fontSize:12,color:'#7C3AED',marginBottom:4,fontStyle:'italic'}}>💭 {r.myNote}</div>}
              {r.note && <div style={{fontSize:12,color:'#92400E',marginBottom:6,lineHeight:1.4}}>{r.note}</div>}
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{r.tags.map(t=><Tag key={t} label={t} selected allTags={allTags} size="sm"/>)}</div>
            </div>
          ))}
          {reportItem && <ReportModal item={reportItem} allTags={allTags} onClose={()=>setReportItem(null)}/>}
          {showLink && <LinkResourcePanel project={selP} resources={resources} allTags={allTags} onLink={ids=>{onLinkResources(selP.id,ids);setShowLink(false);}} onClose={()=>setShowLink(false)}/>}
          {showRetro && <RetroModal project={selP} onClose={()=>setShowRetro(false)} onComplete={retro=>{onCompleteProject(selP.id,retro);setShowRetro(false);}}/>}
        </div>
      )}
    </div>
  );
}

/* ─── AreaView ─── */
function AreaView({ areas, resources, allTags, onAddArea, onLinkResources, onUnlink, onArchiveArea }) {
  const [sel,setSel]           = useState(null);
  const [showLink,setShowLink] = useState(false);
  const [reportItem,setReportItem]     = useState(null);
  const [confirmArchive,setConfirmArchive] = useState(null);
  const selA = sel ? areas.find(a=>a.id===sel) : null;
  const linkedRes = selA ? resources.filter(r=>(selA.linkedIds||[]).includes(r.id)) : [];

  useEffect(() => {
    if (sel && !areas.find(a=>a.id===sel)) { setSel(null); setShowLink(false); }
  }, [areas, sel]);

  return (
    <div>
      {!selA ? (
        <>
          <button onClick={onAddArea} style={{width:'100%',padding:14,borderRadius:14,background:'rgba(147,51,234,.06)',border:'1.5px dashed rgba(147,51,234,.3)',color:'#9333EA',cursor:'pointer',fontSize:14,fontWeight:600,marginBottom:14}}>
            + 새 영역 추가
          </button>
          <div style={{fontSize:12,color:'#888',lineHeight:1.7,padding:'10px 14px',background:'#f9f9f7',borderRadius:12,marginBottom:14,border:'0.5px solid rgba(0,0,0,.07)'}}>
            🏛 <b>영역</b>은 마감일 없이 지속되는 책임입니다.<br/>건강, 재무, 사업운영처럼 삶의 주요 영역을 관리하세요.
          </div>
          {areas.length===0 && (
            <div style={{textAlign:'center',padding:'50px 30px',color:'#aaa'}}>
              <div style={{fontSize:44,marginBottom:12}}>🏛</div>
              <div style={{fontSize:15,fontWeight:600,color:'#555',marginBottom:6}}>아직 영역이 없어요</div>
              <div style={{fontSize:13,lineHeight:1.6}}>건강, 재무, 사업운영처럼<br/>지속적으로 관리할 영역을 만들어보세요</div>
            </div>
          )}
          {areas.map(area => (
            <div key={area.id} onClick={()=>setSel(area.id)} className="fi" style={{background:'#fff',borderRadius:16,padding:16,marginBottom:10,border:'0.5px solid rgba(0,0,0,.07)',cursor:'pointer',borderTop:'3px solid #9333EA'}}>
              <div style={{fontSize:16,fontWeight:600,color:'#111',marginBottom:area.desc?6:4}}>{area.title}</div>
              {area.desc && <div style={{fontSize:12,color:'#888',marginBottom:8,lineHeight:1.5}}>{area.desc}</div>}
              <div style={{fontSize:11,color:'#aaa'}}>연결 자료 {(area.linkedIds||[]).length}개</div>
            </div>
          ))}
        </>
      ) : (
        <div className="fi">
          <button onClick={()=>{setSel(null);setShowLink(false);}} style={{background:'none',border:'none',color:'#7C3AED',fontSize:14,fontWeight:500,cursor:'pointer',marginBottom:14,padding:0}}>
            ← 영역 목록
          </button>
          <div style={{background:'#fff',borderRadius:16,padding:16,marginBottom:12,border:'0.5px solid rgba(0,0,0,.07)',borderTop:'3px solid #9333EA'}}>
            <div style={{fontSize:18,fontWeight:700,color:'#111',marginBottom:selA.desc?6:12}}>{selA.title}</div>
            {selA.desc && <div style={{fontSize:13,color:'#888',marginBottom:14,lineHeight:1.6}}>{selA.desc}</div>}
            <button onClick={()=>setConfirmArchive(selA.id)} style={{width:'100%',padding:'10px',borderRadius:12,background:'rgba(107,114,128,.06)',color:'#6B7280',border:'1px solid rgba(107,114,128,.2)',cursor:'pointer',fontSize:13,fontWeight:600}}>
              🗂 이 영역 보관하기
            </button>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontSize:14,fontWeight:700,color:'#333'}}>📚 연결된 자료 <span style={{color:'#aaa',fontWeight:400,fontSize:12}}>({linkedRes.length}개)</span></div>
            <button onClick={()=>setShowLink(true)} style={{padding:'7px 14px',borderRadius:20,background:'rgba(217,119,6,.08)',color:'#D97706',border:'1px solid rgba(217,119,6,.25)',cursor:'pointer',fontSize:12,fontWeight:600}}>+ 가져오기</button>
          </div>
          {linkedRes.length===0 && (
            <div onClick={()=>setShowLink(true)} style={{textAlign:'center',padding:28,background:'#f9f9f7',borderRadius:14,border:'1.5px dashed rgba(217,119,6,.3)',cursor:'pointer',marginBottom:10}}>
              <div style={{fontSize:28,marginBottom:6}}>📚</div>
              <div style={{fontSize:13,color:'#aaa',marginBottom:4}}>연결된 자료가 없어요</div>
              <div style={{fontSize:12,color:'#D97706',fontWeight:600}}>+ 자료함에서 가져오기</div>
            </div>
          )}
          {linkedRes.map(r => (
            <div key={r.id} style={{background:'rgba(147,51,234,.05)',borderRadius:13,padding:'13px 14px',marginBottom:8,border:'0.5px solid rgba(147,51,234,.15)'}}>
              {r.url && (
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6,flexWrap:'wrap'}}>
                  <span style={{fontSize:10,fontWeight:600,color:isYT(r.url)?'#DC2626':'#7C3AED'}}>{isYT(r.url)?'▶ YouTube':isIG(r.url)?'📷 Instagram':'🔗 링크'}</span>
                  <button onClick={()=>window.open(r.url,'_blank')} style={{fontSize:11,padding:'2px 9px',borderRadius:10,background:'rgba(13,148,136,.1)',color:'#0D9488',border:'0.5px solid rgba(13,148,136,.3)',cursor:'pointer',fontWeight:600}}>열기</button>
                  {isYT(r.url) && <button onClick={()=>setReportItem(r)} style={{fontSize:11,padding:'2px 9px',borderRadius:10,background:'rgba(124,58,237,.1)',color:'#7C3AED',border:'0.5px solid rgba(124,58,237,.3)',cursor:'pointer',fontWeight:600}}>📋 AI 리포트</button>}
                  <div style={{flex:1}}/>
                  <button onClick={()=>onUnlink(selA.id,r.id)} style={{background:'none',border:'none',color:'#ccc',fontSize:18,cursor:'pointer',padding:0,lineHeight:1}}>×</button>
                </div>
              )}
              {!r.url && <div style={{display:'flex',justifyContent:'flex-end',marginBottom:4}}><button onClick={()=>onUnlink(selA.id,r.id)} style={{background:'none',border:'none',color:'#ccc',fontSize:18,cursor:'pointer',padding:0,lineHeight:1}}>×</button></div>}
              <div style={{fontSize:13,fontWeight:600,color:'#581C87',marginBottom:4}}>{r.title}</div>
              {r.myNote && <div style={{fontSize:12,color:'#7C3AED',marginBottom:4,fontStyle:'italic'}}>💭 {r.myNote}</div>}
              {r.note && <div style={{fontSize:12,color:'#7E22CE',marginBottom:6,lineHeight:1.4}}>{r.note}</div>}
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{r.tags.map(t=><Tag key={t} label={t} selected allTags={allTags} size="sm"/>)}</div>
            </div>
          ))}
          {reportItem && <ReportModal item={reportItem} allTags={allTags} onClose={()=>setReportItem(null)}/>}
          {showLink && <LinkResourcePanel project={selA} resources={resources} allTags={allTags} onLink={ids=>{onLinkResources(selA.id,ids);setShowLink(false);}} onClose={()=>setShowLink(false)}/>}
          {confirmArchive && (
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={()=>setConfirmArchive(null)}>
              <div style={{background:'#fff',borderRadius:20,padding:'24px 20px',width:'100%',maxWidth:320}} onClick={e=>e.stopPropagation()}>
                <div style={{fontSize:28,textAlign:'center',marginBottom:10}}>🗂</div>
                <div style={{fontSize:15,fontWeight:700,color:'#111',textAlign:'center',marginBottom:6}}>이 영역을 보관할까요?</div>
                <div style={{fontSize:12,color:'#aaa',textAlign:'center',marginBottom:20}}>보관된 영역은 보관함에서 확인할 수 있어요</div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>setConfirmArchive(null)} style={{flex:1,padding:12,borderRadius:12,background:'#f5f5f3',color:'#555',border:'none',cursor:'pointer',fontSize:14,fontWeight:600}}>취소</button>
                  <button onClick={()=>{onArchiveArea(confirmArchive);setConfirmArchive(null);setSel(null);}} style={{flex:1,padding:12,borderRadius:12,background:'#6B7280',color:'white',border:'none',cursor:'pointer',fontSize:14,fontWeight:600}}>보관</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── ArchiveView (필터 + 회고 펼치기) ─── */
function ArchiveView({ items, allTags }) {
  const [filter,setFilter]         = useState('all');
  const [expandedRetro,setExpandedRetro] = useState(null);
  const filterTabs = [['all','전체'],['project','프로젝트'],['area','영역'],['resource','자료']];
  const filtered = filter==='all' ? items : items.filter(i => {
    if (filter==='resource') return !i.originalType || i.originalType==='resource';
    return i.originalType===filter;
  });
  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:16,overflowX:'auto',paddingBottom:2}}>
        {filterTabs.map(([v,label])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{padding:'6px 14px',borderRadius:20,border:`1.5px solid ${filter===v?'#7C3AED':'rgba(0,0,0,.1)'}`,background:filter===v?'#7C3AED':'transparent',color:filter===v?'white':'#555',fontSize:12,fontWeight:filter===v?700:400,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
            {label}
          </button>
        ))}
      </div>
      {!filtered.length && <div style={{textAlign:'center',padding:'60px 30px',color:'#aaa'}}><div style={{fontSize:40,marginBottom:10}}>🗂</div><div>완료된 항목이 없어요</div></div>}
      {filtered.map(item => (
        <div key={item.id} style={{background:'#fff',borderRadius:14,padding:'14px 16px',marginBottom:8,border:'0.5px solid rgba(0,0,0,.06)',opacity:.85}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
            <div style={{fontSize:14,fontWeight:500,color:'#555',flex:1}}>{item.title}</div>
            <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,marginLeft:8,flexShrink:0,fontWeight:600,
              background:item.originalType==='project'?'rgba(124,58,237,.1)':item.originalType==='area'?'rgba(147,51,234,.1)':'rgba(217,119,6,.1)',
              color:item.originalType==='project'?'#7C3AED':item.originalType==='area'?'#9333EA':'#D97706'}}>
              {item.originalType==='project'?'프로젝트':item.originalType==='area'?'영역':'자료'}
            </span>
          </div>
          {item.note && <div style={{fontSize:12,color:'#aaa',marginBottom:6}}>{item.note}</div>}
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:6}}>{(item.tags||[]).map(t=><Tag key={t} label={t} selected allTags={allTags} size="sm"/>)}</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:10,color:'#ccc'}}>{item.completedAt||item.archivedAt||item.createdAt}</div>
            {item.retro && (
              <button onClick={()=>setExpandedRetro(expandedRetro===item.id?null:item.id)} style={{fontSize:11,padding:'3px 10px',borderRadius:10,background:'rgba(13,148,136,.08)',color:'#0D9488',border:'0.5px solid rgba(13,148,136,.2)',cursor:'pointer',fontWeight:600}}>
                {expandedRetro===item.id ? '▲ 회고 닫기' : '📋 회고 보기'}
              </button>
            )}
          </div>
          {expandedRetro===item.id && item.retro && (
            <div style={{marginTop:12,padding:'12px 14px',background:'rgba(13,148,136,.04)',borderRadius:12,border:'0.5px solid rgba(13,148,136,.15)'}}>
              {item.retro.wellDone && (
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#059669',marginBottom:4}}>✅ 잘된 점</div>
                  <div style={{fontSize:12,color:'#333',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{item.retro.wellDone}</div>
                </div>
              )}
              {item.retro.learned && (
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#2563EB',marginBottom:4}}>💡 배운 점</div>
                  <div style={{fontSize:12,color:'#333',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{item.retro.learned}</div>
                </div>
              )}
              {item.retro.nextTime && (
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'#D97706',marginBottom:4}}>🔄 다음엔 다르게</div>
                  <div style={{fontSize:12,color:'#333',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{item.retro.nextTime}</div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── SettingsModal ─── */
function SettingsModal({ user, allTags, onSaveTags, onLogout, onClose }) {
  const [editTags,setEditTags]     = useState(allTags);
  const [newTag,setNewTag]         = useState('');
  const [weeklyLoading,setWeeklyLoading] = useState(false);
  const [weeklyResult,setWeeklyResult]   = useState(null);

  const addTag = () => { const t=newTag.trim().replace(/^#/,''); if(!t||editTags.includes(t)) return; setEditTags(p=>[...p,t]); setNewTag(''); };
  const removeTag = t => setEditTags(p=>p.filter(x=>x!==t));

  const runWeekly = async () => {
    setWeeklyLoading(true);
    try {
      const res = await fetch(AI_WEEKLY_ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({uid:user.uid}) });
      const data = await res.json();
      setWeeklyResult(data);
    } catch(e) { console.error(e); alert('주간 리뷰 생성 실패'); }
    setWeeklyLoading(false);
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:300,display:'flex',alignItems:'flex-end'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#f7f7f5',borderRadius:'22px 22px 0 0',width:'100%',maxHeight:'92vh',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'16px 18px 12px',borderBottom:'0.5px solid #e8e8e6',background:'#fff',borderRadius:'22px 22px 0 0',flexShrink:0}}>
          <div style={{width:36,height:4,background:'#ddd',borderRadius:2,margin:'0 auto 14px'}}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:17,fontWeight:700,color:'#111'}}>⚙️ 설정</div>
            <button onClick={onClose} style={{background:'none',border:'none',fontSize:22,color:'#aaa',cursor:'pointer'}}>×</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'16px 16px'}}>
          <Card title="계정">
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              {user.photoURL
                ? <img src={user.photoURL} style={{width:40,height:40,borderRadius:'50%'}} alt=""/>
                : <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#7C3AED,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:16,fontWeight:700}}>{user.displayName?.[0]||'?'}</div>
              }
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:'#111'}}>{user.displayName||'사용자'}</div>
                <div style={{fontSize:12,color:'#aaa'}}>{user.email}</div>
              </div>
              <button onClick={onLogout} style={{padding:'6px 12px',borderRadius:8,background:'rgba(220,38,38,.06)',color:'#DC2626',border:'0.5px solid rgba(220,38,38,.2)',fontSize:12,cursor:'pointer'}}>로그아웃</button>
            </div>
          </Card>
          <Card title="내 태그 관리">
            <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:12}}>
              {editTags.map(t=>(
                <div key={t} style={{display:'inline-flex',alignItems:'center',gap:4}}>
                  <Tag label={t} selected allTags={editTags} size="sm"/>
                  <button onClick={()=>removeTag(t)} style={{background:'none',border:'none',color:'#ccc',fontSize:14,cursor:'pointer',padding:0,lineHeight:1}}>×</button>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <input value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTag()} placeholder="새 태그 입력 (Enter)"
                style={{flex:1,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(124,58,237,.25)',background:'#faf9ff',fontSize:13,outline:'none'}}/>
              <button onClick={addTag} style={{padding:'9px 14px',borderRadius:10,background:'#7C3AED',color:'white',border:'none',cursor:'pointer',fontSize:13}}>추가</button>
            </div>
            {JSON.stringify(editTags)!==JSON.stringify(allTags) && (
              <button onClick={()=>onSaveTags(editTags)} style={{width:'100%',marginTop:10,padding:'10px',borderRadius:10,background:'#0D9488',color:'white',border:'none',cursor:'pointer',fontSize:13,fontWeight:600}}>
                ✓ 태그 저장
              </button>
            )}
          </Card>
          <Card title="🧠 주간 뇌 리뷰 (AI)">
            <div style={{fontSize:13,color:'#555',lineHeight:1.7,marginBottom:12}}>이번 주 수집한 내용을 AI가 분석해 패턴과 인사이트를 정리해드려요.</div>
            <button onClick={runWeekly} disabled={weeklyLoading} style={{width:'100%',padding:12,borderRadius:12,background:weeklyLoading?'#e5e5e5':'linear-gradient(135deg,#7C3AED,#a78bfa)',color:weeklyLoading?'#aaa':'white',border:'none',cursor:weeklyLoading?'default':'pointer',fontSize:14,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              {weeklyLoading ? <><span className="spin" style={{display:'inline-block',width:14,height:14,border:'2px solid #7C3AED',borderTopColor:'transparent',borderRadius:'50%'}}/> 분析 중...</> : '📊 이번 주 리뷰 생성'}
            </button>
            {weeklyResult && (
              <div className="fi" style={{marginTop:12,padding:'14px',background:'rgba(124,58,237,.04)',borderRadius:12,border:'0.5px solid rgba(124,58,237,.15)'}}>
                <div style={{fontSize:12,fontWeight:600,color:'#7C3AED',marginBottom:8}}>📋 주간 리뷰</div>
                <div style={{fontSize:13,color:'#333',lineHeight:1.8,whiteSpace:'pre-wrap'}}>{weeklyResult.review}</div>
                {weeklyResult.suggestion && (
                  <div style={{marginTop:10,padding:'10px 12px',background:'rgba(217,119,6,.06)',borderRadius:10,border:'0.5px solid rgba(217,119,6,.2)'}}>
                    <div style={{fontSize:11,fontWeight:600,color:'#D97706',marginBottom:4}}>💡 프로젝트 제안</div>
                    <div style={{fontSize:13,color:'#78350F'}}>{weeklyResult.suggestion}</div>
                  </div>
                )}
              </div>
            )}
          </Card>
          <Card title="공유 기능 (PWA 설치 후)">
            <div style={{fontSize:13,color:'#555',lineHeight:1.7}}>📱 앱 설치 후 유튜브·인스타 등에서<br/><b>공유 → 제2의뇌</b> 선택하면<br/>수신함에 자동으로 저장됩니다.</div>
            <div style={{marginTop:10,padding:'10px 12px',background:'#f9f9f7',borderRadius:10,fontSize:11,color:'#aaa',lineHeight:1.6}}>
              Android: Chrome → 메뉴 → 홈 화면에 추가<br/>iOS 16.4+: Safari → 공유 → 홈 화면에 추가
            </div>
          </Card>
          <div style={{textAlign:'center',fontSize:11,color:'#ccc',padding:16}}>제2의뇌 v2.0.0</div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MainApp
════════════════════════════════════════ */
export default function MainApp({ user }) {
  const { items, loading, addItem, updateItem, deleteItem } = useItems(user.uid);
  const { tags: userTags, saveTags } = useUserTags(user.uid);

  const [tab,setTab]             = useState('inbox');
  const [showCap,setShowCap]     = useState(false);
  const [showAddProj,setShowAddProj] = useState(false);
  const [showAddArea,setShowAddArea] = useState(false);
  const [showSettings,setShowSettings] = useState(false);

  const allTags = userTags.length ? userTags : [];

  /* 공유 수신 처리 */
  useEffect(() => {
    if (!window.__pendingShare) return;
    const { url, title } = window.__pendingShare;
    delete window.__pendingShare;
    const t = title || url; if (!t) return;
    addItem({ type:'inbox', title:t, url:url||'', tags:[], note:'🤖 AI 분析 중...', aiTags:[], createdAt:today() }).then(async (docRef) => {
      try {
        const res = await fetch(AI_ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title:t,url:url||'',userTags:[]}) });
        const data = await res.json();
        const updates = { note: data.summary||'', aiTags: data.tags||[] };
        if (data.fetchedTitle) updates.title = data.fetchedTitle;
        await updateItem(docRef.id, updates);
      } catch(e) { console.error(e); await updateItem(docRef.id, { note:'' }); }
    });
    setTab('inbox');
  }, []); // eslint-disable-line

  /* 뷰 분리 */
  const inbox     = useMemo(() => items.filter(i=>i.type==='inbox'),    [items]);
  const resources = useMemo(() => items.filter(i=>i.type==='resource'), [items]);
  const projects  = useMemo(() => items.filter(i=>i.type==='project'),  [items]);
  const areas     = useMemo(() => items.filter(i=>i.type==='area'),     [items]);
  const archives  = useMemo(() => items.filter(i=>i.type==='archive'),  [items]);

  /* 핸들러 */
  const doCapture = ({ title, note, aiTags }) => {
    addItem({ type:'inbox', title, url:'', tags:[], note, aiTags:aiTags||[], createdAt:today() });
    setShowCap(false);
  };

  const doProcess = (id, tags, dest, projId, myNote='') => {
    updateItem(id, { type:'resource', tags, ...(myNote ? { myNote } : {}) });
    if (dest==='project' && projId) {
      const proj = items.find(i=>i.id===projId);
      if (proj) updateItem(projId, { linkedIds:[...(proj.linkedIds||[]),id] });
    }
  };

  const doCheck = (projId, ckId) => {
    const proj = items.find(i=>i.id===projId); if (!proj) return;
    updateItem(projId, { checks: proj.checks.map(c=>c.id===ckId?{...c,d:!c.d}:c) });
  };
  const doCheckAdd = (projId, text) => {
    const proj = items.find(i=>i.id===projId); if (!proj) return;
    updateItem(projId, { checks:[...(proj.checks||[]),{id:String(Date.now()),t:text,d:false}] });
  };
  const doCheckDelete = (projId, ckId) => {
    const proj = items.find(i=>i.id===projId); if (!proj) return;
    updateItem(projId, { checks:(proj.checks||[]).filter(c=>c.id!==ckId) });
  };

  const doLinkToProject = (resId, projId) => {
    const proj = items.find(i=>i.id===projId); if (!proj) return;
    const ex = proj.linkedIds||[];
    if (!ex.includes(resId)) updateItem(projId, { linkedIds:[...ex,resId] });
  };
  const doLinkResources = (containerId, resIds) => {
    const container = items.find(i=>i.id===containerId); if (!container) return;
    const ex = container.linkedIds||[];
    updateItem(containerId, { linkedIds:[...ex,...resIds.filter(id=>!ex.includes(id))] });
  };
  const doUnlink = (containerId, resId) => {
    const container = items.find(i=>i.id===containerId); if (!container) return;
    updateItem(containerId, { linkedIds:(container.linkedIds||[]).filter(x=>x!==resId) });
  };

  const doAddProject = ({ title, due, checks }) => {
    addItem({ type:'project', title, due, tags:[], linkedIds:[], checks:checks||[], createdAt:today() });
    setShowAddProj(false);
  };
  const doCompleteProject = (projId, retro) => {
    updateItem(projId, { type:'archive', originalType:'project', status:'completed', completedAt:today(), retro });
  };

  const doAddArea = ({ title, desc }) => {
    addItem({ type:'area', title, desc, tags:[], linkedIds:[], createdAt:today() });
    setShowAddArea(false);
  };
  const doArchiveArea = (areaId) => {
    updateItem(areaId, { type:'archive', originalType:'area', archivedAt:today() });
  };

  const doAIRecommend = async (project, unlinkedResources) => {
    const res = await fetch(AI_RECOMMEND_ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ project:{title:project.title,desc:project.desc,tags:project.tags}, resources:unlinkedResources.map(r=>({id:r.id,title:r.title,note:r.note,tags:r.tags})) }) });
    const data = await res.json();
    return data.recommendedIds || [];
  };

  const doLogout = () => signOut(auth);

  const tabs = [
    { id:'inbox',    ico:'📥', label:'수신함',  badge: inbox.length||null },
    { id:'project',  ico:'🎯', label:'프로젝트' },
    { id:'area',     ico:'🏛', label:'영역' },
    { id:'resource', ico:'📚', label:'자료함' },
    { id:'archive',  ico:'🗂', label:'보관' },
  ];
  const titles = { inbox:'📥 수신함', project:'🎯 프로젝트', area:'🏛 영역', resource:'📚 자료함', archive:'🗂 보관함' };

  if (loading) return (
    <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,background:'#f7f7f5'}}>
      <span className="spin" style={{display:'block',width:32,height:32,border:'3px solid #7C3AED',borderTopColor:'transparent',borderRadius:'50%'}}/>
      <div style={{fontSize:13,color:'#aaa'}}>로딩 중...</div>
    </div>
  );

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#f7f7f5',maxWidth:430,margin:'0 auto',position:'relative'}}>
      {/* 상단바 */}
      <div style={{background:'#fff',padding:'14px 18px 10px',borderBottom:'0.5px solid rgba(0,0,0,.07)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontSize:17,fontWeight:700,color:'#111'}}>{titles[tab]}</div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{fontSize:12,fontWeight:600,color:'#7C3AED'}}>🧠 제2의뇌</div>
          <button onClick={()=>setShowSettings(true)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',padding:0,lineHeight:1,color:'#888'}}>⚙️</button>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div style={{flex:1,overflowY:'auto',padding:'16px 16px 80px'}}>
        {tab==='inbox'    && <InboxView items={inbox} projects={projects} allTags={allTags} onProcess={doProcess} onDelete={deleteItem}/>}
        {tab==='project'  && <ProjectView projects={projects} resources={resources} allTags={allTags} onCheck={doCheck} onCheckAdd={doCheckAdd} onCheckDelete={doCheckDelete} onAddProject={()=>setShowAddProj(true)} onLinkResources={doLinkResources} onUnlink={doUnlink} onAIRecommend={doAIRecommend} onCompleteProject={doCompleteProject}/>}
        {tab==='area'     && <AreaView areas={areas} resources={resources} allTags={allTags} onAddArea={()=>setShowAddArea(true)} onLinkResources={doLinkResources} onUnlink={doUnlink} onArchiveArea={doArchiveArea}/>}
        {tab==='resource' && <ResourceView items={resources} projects={projects} allTags={allTags} onLinkToProject={doLinkToProject} onDelete={deleteItem}/>}
        {tab==='archive'  && <ArchiveView items={archives} allTags={allTags}/>}
      </div>

      {/* FAB */}
      <button onClick={()=>setShowCap(true)} style={{position:'fixed',bottom:76,right:20,width:56,height:56,borderRadius:'50%',background:'#7C3AED',color:'white',border:'none',cursor:'pointer',fontSize:24,boxShadow:'0 4px 20px rgba(124,58,237,.45)',zIndex:100}}>
        ✏️
      </button>

      {/* 하단 탭바 */}
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,background:'rgba(255,255,255,.95)',backdropFilter:'blur(12px)',borderTop:'0.5px solid rgba(0,0,0,.08)',display:'flex',paddingBottom:'env(safe-area-inset-bottom)',zIndex:99}}>
        {tabs.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,padding:'8px 0 10px',border:'none',background:'transparent',cursor:'pointer',position:'relative'}}>
            <span style={{fontSize:20}}>{t.ico}</span>
            <span style={{fontSize:10,fontWeight:tab===t.id?700:400,color:tab===t.id?'#7C3AED':'#aaa'}}>{t.label}</span>
            {t.badge && <span style={{position:'absolute',top:6,right:'calc(50% - 14px)',background:'#EA580C',color:'white',borderRadius:10,fontSize:9,padding:'1px 5px',fontWeight:700,minWidth:16,textAlign:'center'}}>{t.badge}</span>}
            {tab===t.id && <div style={{position:'absolute',bottom:0,width:20,height:2,background:'#7C3AED',borderRadius:1}}/>}
          </button>
        ))}
      </div>

      {/* 모달 */}
      {showCap      && <CaptureModal onClose={()=>setShowCap(false)} onSave={doCapture} allTags={allTags}/>}
      {showAddProj  && <AddProjectModal onClose={()=>setShowAddProj(false)} onSave={doAddProject} archives={archives}/>}
      {showAddArea  && <AddAreaModal onClose={()=>setShowAddArea(false)} onSave={doAddArea}/>}
      {showSettings && <SettingsModal user={user} allTags={allTags} onSaveTags={saveTags} onLogout={doLogout} onClose={()=>setShowSettings(false)}/>}
    </div>
  );
}
