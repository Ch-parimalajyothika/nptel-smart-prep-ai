import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, FileText, HelpCircle, Clipboard, Loader } from 'lucide-react';
import { coursesAPI } from '../../utils/api';
import toast from 'react-hot-toast';

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate     = useNavigate();
  const [course,  setCourse]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    coursesAPI.get(parseInt(courseId))
      .then(r=>setCourse(r.data))
      .catch(()=>toast.error('Course not found'))
      .finally(()=>setLoading(false));
  },[courseId]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader className="w-6 h-6 animate-spin text-brand-500"/></div>;
  if (!course)  return <div className="p-6 text-center text-slate-400">Course not found.</div>;

  const total       = course.total_weeks || 12;
  const stored      = course.weeks || [];
  const allWeeks    = Array.from({length:total},(_,i)=>stored.find(w=>w.week_number===i+1)||{week_number:i+1,has_transcript:0,has_notes:0,has_mcqs:0});
  const done        = allWeeks.filter(w=>w.has_notes&&w.has_mcqs).length;
  const partial     = allWeeks.filter(w=>(w.has_transcript||w.has_notes)&&!(w.has_notes&&w.has_mcqs)).length;
  const status      = w=>(w.has_notes&&w.has_mcqs)?'done':(w.has_transcript||w.has_notes)?'partial':'empty';

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div className="flex items-start gap-4">
        <button onClick={()=>navigate('/courses')} className="btn-ghost p-2 mt-1"><ArrowLeft className="w-4 h-4"/></button>
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{course.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
            <span>{total} weeks</span><span>·</span>
            <span className="text-green-500">{done} complete</span>
            {partial>0&&<><span>·</span><span className="text-amber-500">{partial} in progress</span></>}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-slate-700 dark:text-slate-300">Overall Progress</span>
          <span className="text-brand-600 font-semibold">{Math.round((done/total)*100)}%</span>
        </div>
        <div className="progress-bar"><div className="progress-bar-fill" style={{width:`${(done/total)*100}%`}}/></div>
        <div className="flex gap-4 mt-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-500 inline-block"/>Complete</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>In Progress</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 inline-block"/>Not Started</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><Clipboard className="w-3 h-3"/>Transcript</span>
        <span className="flex items-center gap-1"><FileText className="w-3 h-3"/>Notes</span>
        <span className="flex items-center gap-1"><HelpCircle className="w-3 h-3"/>MCQs</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {allWeeks.map(w=>{
          const s = status(w);
          return (
            <button key={w.week_number} onClick={()=>navigate(`/courses/${courseId}/week/${w.week_number}`)} className="card card-hover p-4 text-left group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${s==='done'?'bg-brand-500 text-white':s==='partial'?'bg-amber-400 text-white':'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                    {s==='done'?<Check className="w-3.5 h-3.5"/>:w.week_number}
                  </div>
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">Week {w.week_number}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500 transition-colors"/>
              </div>
              {w.title&&<p className="text-xs text-slate-400 mb-2 truncate">{w.title}</p>}
              <div className="flex gap-2">
                {[[Clipboard,w.has_transcript,'T'],[FileText,w.has_notes,'N'],[HelpCircle,w.has_mcqs,'Q']].map(([Icon,active,label])=>(
                  <div key={label} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${active?'bg-brand-50 dark:bg-brand-950/30 text-brand-600':'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    <Icon className="w-3 h-3"/>{label}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
