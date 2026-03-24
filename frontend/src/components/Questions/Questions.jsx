import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { HelpCircle, Sparkles, Copy, Check, Download, ChevronDown } from 'lucide-react';
import { questionsAPI, coursesAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const Q_TYPES=[
  {id:'mcq',   label:'MCQ',             desc:'Multiple choice + answers + explanations'},
  {id:'short', label:'Short Questions', desc:'2–3 sentence answers'},
  {id:'long',  label:'Long Questions',  desc:'Detailed descriptive answers'},
  {id:'exam',  label:'Exam-Focused',    desc:'Previous year & high-weight pattern'},
];
const WEEKS=Array.from({length:12},(_,i)=>({id:String(i+1),label:`Week ${i+1}`}));

export default function Questions() {
  const [courses, setCourses] = useState([]);
  const [course,  setCourse]  = useState('');
  const [week,    setWeek]    = useState('');
  const [qtype,   setQtype]   = useState('mcq');
  const [count,   setCount]   = useState(10);
  const [topic,   setTopic]   = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied,  setCopied]  = useState(false);

  useEffect(()=>{ coursesAPI.list().then(r=>setCourses(r.data)).catch(()=>{}); },[]);

  const generate=async()=>{
    if(!course){ toast.error('Select a course'); return; }
    setLoading(true); setContent('');
    try{
      const r=await questionsAPI.generate({course,week:week?parseInt(week):null,type:qtype,count,topic});
      setContent(r.data.content);
      toast.success('Questions generated!');
    }catch{
      setContent(genDemo(course,week,qtype,count,topic));
      toast.success('Questions generated (demo mode)');
    }finally{ setLoading(false); }
  };

  const copy=()=>{ navigator.clipboard.writeText(content); setCopied(true); toast.success('Copied!'); setTimeout(()=>setCopied(false),2000); };
  const dl=()=>{ const b=new Blob([content],{type:'text/markdown'}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download=`questions-${qtype}.md`; a.click(); URL.revokeObjectURL(u); };

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-violet-50 dark:bg-violet-950/30 rounded-xl flex items-center justify-center"><HelpCircle className="w-5 h-5 text-violet-600"/></div>
          <div><h2 className="font-display font-bold text-slate-900 dark:text-white">Question Generator</h2><p className="text-sm text-slate-400">MCQ-focused with explanations & difficulty tags</p></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div>
            <label className="label">Course</label>
            <div className="relative">
              <select value={course} onChange={e=>setCourse(e.target.value)} className="input appearance-none pr-10">
                <option value="">Select course…</option>
                {courses.map(c=><option key={c.id} value={c.code||c.title}>{c.title}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
            </div>
          </div>
          <div>
            <label className="label">Week (optional)</label>
            <div className="relative">
              <select value={week} onChange={e=>setWeek(e.target.value)} className="input appearance-none pr-10">
                <option value="">All weeks</option>
                {WEEKS.map(w=><option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
            </div>
          </div>
          <div>
            <label className="label">Topic (optional)</label>
            <input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. Neural Networks…" className="input"/>
          </div>
          <div>
            <label className="label">Count: <strong>{count}</strong></label>
            <input type="range" min={3} max={30} value={count} onChange={e=>setCount(+e.target.value)} className="w-full accent-violet-500 cursor-pointer mt-3"/>
            <div className="flex justify-between text-xs text-slate-400 mt-1"><span>3</span><span>30</span></div>
          </div>
        </div>
        <div className="mb-5">
          <label className="label">Question Type</label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Q_TYPES.map(({id,label,desc})=>(
              <button key={id} onClick={()=>setQtype(id)} className={`p-3 rounded-xl border-2 text-left transition-all ${qtype===id?'border-violet-500 bg-violet-50 dark:bg-violet-950/30':'border-slate-200 dark:border-[#21262d] hover:border-violet-300'}`}>
                <div className={`text-sm font-semibold ${qtype===id?'text-violet-700 dark:text-violet-300':'text-slate-700 dark:text-slate-300'}`}>{label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
              </button>
            ))}
          </div>
        </div>
        <button onClick={generate} disabled={loading} className="btn-primary">
          {loading?<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Generating…</>:<><Sparkles className="w-4 h-4"/>Generate Questions</>}
        </button>
      </div>

      {content&&(
        <div className="card animate-slide-up">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#21262d]">
            <span className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2"><HelpCircle className="w-4 h-4 text-violet-500"/>{count} {Q_TYPES.find(q=>q.id===qtype)?.label}</span>
            <div className="flex items-center gap-2">
              <button onClick={copy} className="btn-ghost p-2">{copied?<Check className="w-3.5 h-3.5 text-green-500"/>:<Copy className="w-3.5 h-3.5"/>}</button>
              <button onClick={dl} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"><Download className="w-3 h-3"/>Save</button>
            </div>
          </div>
          <div className="p-6 prose-custom max-h-[65vh] overflow-y-auto"><ReactMarkdown>{content}</ReactMarkdown></div>
        </div>
      )}
    </div>
  );
}

const genDemo=(course,week,type,count,topic)=>{
  const t=topic||'Core Concepts';
  if(type==='mcq'){
    let o=`# MCQ Questions: ${t}\n\n`;
    for(let i=1;i<=count;i++){
      o+=`### Q${i}. Which of the following best describes ${t} in ${course}?\n\n(A) It provides O(1) access to elements via direct addressing\n(B) It organises data hierarchically for efficient retrieval\n(C) It replaces the need for explicit memory management\n(D) It enables parallel execution of independent sub-tasks\n\n**✅ Correct Answer: (B)**\n**Explanation**: ${t} fundamentally deals with hierarchical organisation to enable efficient retrieval.\n**Difficulty**: Medium\n**Tricky**: ${i%5===0?'Yes — options A and B are commonly confused':'No'}\n\n---\n\n`;
    }
    return o;
  }
  if(type==='short'){
    let o=`# Short Answer Questions: ${t}\n\n`;
    for(let i=1;i<=count;i++){
      o+=`### Q${i}. Define ${t} and explain its significance in ${course}.\n\n**Answer**: ${t} refers to the systematic approach used in computer science to solve problems efficiently. Its significance lies in reducing time and space complexity while maintaining correctness of results.\n\n---\n\n`;
    }
    return o;
  }
  if(type==='long'){
    let o=`# Long Answer Questions: ${t}\n\n`;
    for(let i=1;i<=Math.min(count,5);i++){
      o+=`### Q${i}. [10 Marks] Explain ${t} with examples and applications.\n\n**Answer**:\n\n**Introduction**: ${t} is a fundamental concept enabling efficient solutions.\n\n**Detailed Explanation**:\n1. Initialise required data structures\n2. Process inputs systematically\n3. Apply the core algorithm\n4. Return results with guaranteed properties\n\n**Example**: Given n elements, apply ${t} to achieve O(log n) performance...\n\n**Applications**: Used in search engines, database indexing, compiler design.\n\n**Conclusion**: ${t} is essential for building scalable systems.\n\n---\n\n`;
    }
    return o;
  }
  let o=`# Exam-Focused Questions: ${t}\n\n> 🎯 Based on NPTEL exam patterns\n\n`;
  for(let i=1;i<=count;i++){
    o+=`### Q${i}. [${i<=2?'2':i<=4?'5':'10'} Marks] Application of ${t}\n\nApply the principles of ${t} to solve: Given n=1000, find the optimal solution.\n\n**Answer Outline**:\n- Define the problem formally (1 mark)\n- State relevant theorem (1 mark)\n- Show step-by-step solution (2 marks)\n- State time/space complexity (1 mark)\n\n---\n\n`;
  }
  return o;
};
