import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trophy, Timer, CheckCircle, XCircle, RotateCcw, Sparkles, ChevronRight, AlertCircle, BarChart2, Loader } from 'lucide-react';
import { questionsAPI, examAPI, coursesAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const PHASE = { SETUP:'setup', LOADING:'loading', QUIZ:'quiz', RESULT:'result' };

const parseMCQ = (text) => {
  const qs = [];
  text.split(/---+/).forEach(block => {
    const lines = block.trim().split('\n').filter(l=>l.trim());
    let qText='',options=[],answer='',explanation='',tricky=false;
    lines.forEach(l=>{
      if (l.match(/^#{1,3}\s*Q\d+\./)) qText=l.replace(/^#{1,3}\s*Q\d+\.\s*/,'').trim();
      else if (l.match(/^\(A\)/)) options[0]=l.replace(/^\(A\)\s*/,'').trim();
      else if (l.match(/^\(B\)/)) options[1]=l.replace(/^\(B\)\s*/,'').trim();
      else if (l.match(/^\(C\)/)) options[2]=l.replace(/^\(C\)\s*/,'').trim();
      else if (l.match(/^\(D\)/)) options[3]=l.replace(/^\(D\)\s*/,'').trim();
      else if (l.includes('✅ Correct Answer:')) { const m=l.match(/\(([A-D])\)/); if(m) answer=m[1]; }
      else if (l.includes('Explanation:')) explanation=l.replace(/.*Explanation:\s*/,'').trim();
      else if (l.includes('Tricky: Yes')) tricky=true;
    });
    if (qText && options.length===4) qs.push({qText,options,answer,explanation,tricky});
  });
  return qs;
};

const demoQ = count => Array.from({length:count},(_,i)=>({
  qText:`Q${i+1}: Which concept is fundamental to this week's topic?`,
  options:['O(1) average lookup via hashing','O(n²) sorting algorithm','TCP connection handshake','Boyce-Codd Normal Form'],
  answer:['A','B','C','D'][i%4],
  explanation:`This is a core concept. Review Week ${Math.floor(i/3)+1} for details.`,
  tricky: i%5===0,
}));

export default function Exam() {
  const [phase,    setPhase]    = useState(PHASE.SETUP);
  const [courses,  setCourses]  = useState([]);
  const [course,   setCourse]   = useState(null);
  const [duration, setDuration] = useState(20);
  const [qCount,   setQCount]   = useState(15);
  const [qs,       setQs]       = useState([]);
  const [cur,      setCur]      = useState(0);
  const [answers,  setAnswers]  = useState({});
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsed,  setElapsed]  = useState(0);
  const timerRef  = useRef(null);

  useEffect(()=>{
    coursesAPI.list().then(r=>{ setCourses(r.data); if(r.data[0]) setCourse(r.data[0]); }).catch(()=>{});
  },[]);

  const finish = useCallback(()=>{ clearInterval(timerRef.current); setPhase(PHASE.RESULT); },[]);

  useEffect(()=>{
    if(phase!==PHASE.QUIZ) return;
    const t0 = Date.now();
    setTimeLeft(duration*60);
    timerRef.current = setInterval(()=>{
      setElapsed(Math.floor((Date.now()-t0)/1000));
      setTimeLeft(t=>{ if(t<=1){ clearInterval(timerRef.current); finish(); return 0; } return t-1; });
    },1000);
    return ()=>clearInterval(timerRef.current);
  },[phase,duration,finish]);

  // Auto-save result when entering RESULT phase
  useEffect(()=>{
    if(phase!==PHASE.RESULT||!qs.length) return;
    const correct = qs.reduce((a,q,i)=>a+(answers[i]===q.answer?1:0),0);
    const wrong   = qs.reduce((a,q,i)=>a+(answers[i]&&answers[i]!==q.answer?1:0),0);
    const skipped = qs.filter((_,i)=>!answers[i]).length;
    const pct     = Math.round((correct/qs.length)*100);
    const weakT   = qs.filter((_,i)=>answers[i]!==qs[i].answer).map(q=>q.qText.slice(0,50));
    examAPI.save({
      course_id: course?.id, course_label: course?.title||'Practice',
      total_q:qs.length, correct, wrong, skipped, score_pct:pct,
      duration_sec:elapsed, weak_topics:weakT,
      answers:qs.map((q,i)=>({q:q.qText,chosen:answers[i],correct:q.answer,ok:answers[i]===q.answer})),
    }).catch(()=>{});
  },[phase]);

  const start = async () => {
    if(!course){ toast.error('Select a course'); return; }
    setPhase(PHASE.LOADING);
    try {
      const r = await questionsAPI.generate({course:course.code||course.title,type:'mcq',count:qCount});
      const p = parseMCQ(r.data.content);
      setQs(p.length>=3?p:demoQ(qCount));
    } catch { setQs(demoQ(qCount)); }
    setAnswers({}); setCur(0); setRevealed(false);
    setPhase(PHASE.QUIZ);
  };

  const score    = qs.reduce((a,q,i)=>a+(answers[i]===q.answer?1:0),0);
  const pct      = qs.length?Math.round((score/qs.length)*100):0;
  const grade    = pct>=90?'A+':pct>=80?'A':pct>=70?'B':pct>=60?'C':'D';
  const gColor   = pct>=80?'text-green-600 bg-green-100 dark:bg-green-950/40':pct>=60?'text-amber-600 bg-amber-100 dark:bg-amber-950/40':'text-red-500 bg-red-100 dark:bg-red-950/40';
  const msg      = pct>=90?'🎉 Target achieved! 90%+ score!':pct>=80?'🌟 Excellent work!':pct>=60?'💪 Good effort – keep going!':'📚 More revision needed!';
  const tColor   = timeLeft<60?'text-red-500':timeLeft<180?'text-amber-500':'text-brand-500';

  /* ─ SETUP ─ */
  if(phase===PHASE.SETUP) return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto animate-fade-in">
      <div className="card p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/30 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trophy className="w-8 h-8 text-amber-500"/></div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Exam Mode</h2>
          <p className="text-sm text-slate-400 mt-1">Timed MCQ exam · Results saved · Weak areas tracked</p>
        </div>
        <div className="space-y-5">
          <div>
            <label className="label">Course</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {courses.map(c=>(
                <button key={c.id} onClick={()=>setCourse(c)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all text-left ${course?.id===c.id?'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300':'border-slate-200 dark:border-[#21262d] text-slate-600 dark:text-slate-400 hover:border-amber-300'}`}>
                  {c.title}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Duration</label>
            <div className="flex gap-2">
              {[10,20,30,60].map(d=>(
                <button key={d} onClick={()=>setDuration(d)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${duration===d?'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300':'border-slate-200 dark:border-[#21262d] text-slate-500 hover:border-amber-300'}`}>
                  {d}m
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Questions: <strong>{qCount}</strong></label>
            <input type="range" min={5} max={30} value={qCount} onChange={e=>setQCount(+e.target.value)} className="w-full accent-amber-500 cursor-pointer"/>
            <div className="flex justify-between text-xs text-slate-400 mt-1"><span>5</span><span>30</span></div>
          </div>
          <button onClick={start} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-500/30 active:scale-95">
            <Sparkles className="w-5 h-5"/> Start Exam
          </button>
        </div>
      </div>
    </div>
  );

  /* ─ LOADING ─ */
  if(phase===PHASE.LOADING) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <Loader className="w-10 h-10 animate-spin text-brand-500"/>
      <p className="text-slate-500 font-medium">Generating {qCount} exam questions…</p>
    </div>
  );

  /* ─ QUIZ ─ */
  if(phase===PHASE.QUIZ && qs.length>0) {
    const q=qs[cur]; const chosen=answers[cur]; const OPTS=['A','B','C','D'];
    return (
      <div className="p-4 lg:p-6 max-w-2xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-slate-900 dark:text-white">Q {cur+1}/{qs.length}</span>
            <div className="w-28 progress-bar"><div className="progress-bar-fill" style={{width:`${((cur+1)/qs.length)*100}%`}}/></div>
          </div>
          <div className={`flex items-center gap-1.5 font-mono font-bold text-lg ${tColor}`}><Timer className="w-4 h-4"/>{fmt(timeLeft)}</div>
        </div>
        <div className="card p-6 mb-4">
          <div className="flex items-start gap-2 mb-4">
            {q.tricky && <span className="badge bg-red-50 dark:bg-red-950/30 text-red-500 text-[10px] flex-shrink-0">⚠ Tricky</span>}
            <p className="text-slate-900 dark:text-white font-medium leading-relaxed">{q.qText}</p>
          </div>
          <div className="space-y-3">
            {q.options.map((opt,i)=>{
              const lbl=OPTS[i]; let cls='quiz-option';
              if(chosen===lbl) cls+=revealed?(lbl===q.answer?' correct':' wrong'):' selected';
              if(revealed&&lbl===q.answer&&chosen!==lbl) cls+=' correct';
              return (
                <button key={i} className={cls} disabled={revealed}
                  onClick={()=>{ if(!revealed) setAnswers(a=>({...a,[cur]:lbl})); }}>
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 flex-shrink-0 ${chosen===lbl?'bg-brand-500 text-white':'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{lbl}</span>
                  {opt}
                </button>
              );
            })}
          </div>
          {revealed && q.explanation && (
            <div className="mt-4 p-3 bg-brand-50 dark:bg-brand-950/30 rounded-xl border border-brand-200 dark:border-brand-900">
              <p className="text-sm text-brand-800 dark:text-brand-200 font-medium">💡 {q.explanation}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          {chosen && !revealed && <button onClick={()=>setRevealed(true)} className="btn-secondary flex-1"><AlertCircle className="w-4 h-4"/>Reveal</button>}
          <button onClick={()=>{ if(cur<qs.length-1){setCur(c=>c+1);setRevealed(false);}else finish(); }} disabled={!chosen} className="btn-primary flex-1">
            {cur<qs.length-1?<><ChevronRight className="w-4 h-4"/>Next</>:<><Trophy className="w-4 h-4"/>Finish</>}
          </button>
        </div>
      </div>
    );
  }

  /* ─ RESULT ─ */
  const wrong   = qs.reduce((a,q,i)=>a+(answers[i]&&answers[i]!==q.answer?1:0),0);
  const skipped = qs.filter((_,i)=>!answers[i]).length;
  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto animate-fade-in space-y-4">
      <div className="card p-8 text-center">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-display font-black ${gColor}`}>{grade}</div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-1">{msg}</h2>
        <p className="text-slate-500 text-sm mb-5">{score}/{qs.length} correct ({pct}%) · {fmt(elapsed)}</p>
        <div className="progress-bar mb-1"><div className="progress-bar-fill" style={{width:`${pct}%`}}/></div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[['Correct',score,'text-green-600'],['Wrong',wrong,'text-red-500'],['Skipped',skipped,'text-slate-400']].map(([l,v,c])=>(
            <div key={l} className="card p-3 text-center"><div className={`text-2xl font-bold ${c}`}>{v}</div><div className="text-xs text-slate-400">{l}</div></div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="p-4 border-b border-slate-100 dark:border-[#21262d] flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-brand-500"/>
          <h3 className="font-display font-bold text-slate-900 dark:text-white">Answer Review</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-[#21262d] max-h-[50vh] overflow-y-auto">
          {qs.map((q,i)=>{
            const ok=answers[i]===q.answer;
            return (
              <div key={i} className="p-4 flex items-start gap-3">
                {ok?<CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5"/>:<XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5"/>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-300">{q.qText}</p>
                  {!ok && <p className="text-xs text-red-400 mt-0.5">Yours: {answers[i]||'—'} · Correct: {q.answer}</p>}
                  {q.explanation && <p className="text-xs text-slate-400 mt-0.5">💡 {q.explanation}</p>}
                </div>
                {q.tricky && <span className="badge bg-red-50 dark:bg-red-950/30 text-red-400 text-[10px]">Tricky</span>}
              </div>
            );
          })}
        </div>
      </div>
      <button onClick={()=>setPhase(PHASE.SETUP)} className="btn-primary w-full"><RotateCcw className="w-4 h-4"/>New Exam</button>
    </div>
  );
}
