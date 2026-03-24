import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, FileText, Zap, List, Code2, RefreshCw, Download, Copy,
         Check, Sparkles, ChevronLeft, ChevronRight, Youtube, Upload, AlertTriangle,
         BookOpen, HelpCircle, Clipboard, FileDown, Loader, Info } from 'lucide-react';
import { weeksAPI, coursesAPI, pdfAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const NOTE_TABS=[
  {id:'summary',   label:'Summary',      icon:Zap},
  {id:'detailed',  label:'Detailed',     icon:FileText},
  {id:'keypoints', label:'Key Points',   icon:List},
  {id:'formulas',  label:'Formulas',     icon:Code2},
  {id:'revision',  label:'Last-Day Rev.',icon:RefreshCw},
];
const NOTE_FIELD={summary:'summary_notes',detailed:'detailed_notes',keypoints:'key_concepts',formulas:'formulas',revision:'revision_notes'};

export default function WeekView() {
  const { courseId, weekNum } = useParams();
  const navigate = useNavigate();
  const cid = parseInt(courseId), wnum = parseInt(weekNum);

  const [course,     setCourse]     = useState(null);
  const [weekData,   setWeekData]   = useState(null);
  const [activeTab,  setActiveTab]  = useState('transcript');
  const [noteTab,    setNoteTab]    = useState('summary');
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [ytUrl,      setYtUrl]      = useState('');
  const [ytLoading,  setYtLoading]  = useState(false);
  const [ytMsg,      setYtMsg]      = useState('');
  const [transcript, setTranscript] = useState('');
  const [copied,     setCopied]     = useState(false);
  const [pdfLoad,    setPdfLoad]    = useState(false);

  useEffect(()=>{
    Promise.all([
      coursesAPI.get(cid).then(r=>setCourse(r.data)),
      weeksAPI.get(cid,wnum).then(r=>{ setWeekData(r.data); setTranscript(r.data.transcript||''); }),
    ]).catch(()=>toast.error('Failed to load week')).finally(()=>setLoading(false));
  },[cid,wnum]);

  const saveTranscript=async()=>{
    if(!transcript.trim()){ toast.error('Enter transcript text'); return; }
    setGenerating(true);
    try{
      await weeksAPI.saveTranscript(cid,wnum,{transcript,title:`Week ${wnum}`});
      setWeekData(p=>({...p,transcript}));
      toast.success('Transcript saved & indexed for RAG!');
    }catch{ toast.error('Save failed'); }
    finally{ setGenerating(false); }
  };

  const fetchYT=async()=>{
    if(!ytUrl.trim()){ toast.error('Enter a YouTube URL'); return; }
    setYtLoading(true); setYtMsg('');
    try{
      const r=await weeksAPI.fetchYouTube(cid,{url:ytUrl,week_number:wnum});
      setYtMsg(r.data.status);
      if(r.data.success){
        setTranscript(r.data.transcript||'');
        setWeekData(p=>({...p,transcript:r.data.transcript}));
        toast.success('YouTube transcript fetched!');
        setYtUrl('');
      }
    }catch(e){ setYtMsg(e.response?.data?.message||'Failed'); toast.error('Fetch failed'); }
    finally{ setYtLoading(false); }
  };

  const genNotes=async type=>{
    if(!weekData?.transcript){ toast.error('Add a transcript first'); return; }
    setGenerating(true);
    try{
      const r=await weeksAPI.generateNotes(cid,wnum,{type});
      setWeekData(p=>({...p,[NOTE_FIELD[type]]:r.data.content}));
      toast.success(`${type} notes generated!`);
    }catch(e){ toast.error(e.response?.data?.error||'Failed'); }
    finally{ setGenerating(false); }
  };

  const genMCQs=async()=>{
    if(!weekData?.transcript){ toast.error('Add transcript first'); return; }
    setGenerating(true);
    try{
      const r=await weeksAPI.generateMCQs(cid,wnum,{count:20});
      setWeekData(p=>({...p,mcqs:r.data.content}));
      toast.success('20 MCQs generated!');
    }catch(e){ toast.error(e.response?.data?.error||'Failed'); }
    finally{ setGenerating(false); }
  };

  const dlPDF=async()=>{
    const content=weekData?.[NOTE_FIELD[noteTab]];
    if(!content){ toast.error('Generate notes first'); return; }
    setPdfLoad(true);
    try{
      const r=await pdfAPI.generate({content,title:`Week ${wnum} — ${noteTab}`,course:course?.title||'NPTEL',week:wnum,note_type:noteTab});
      const url=URL.createObjectURL(new Blob([r.data],{type:'application/pdf'}));
      const a=document.createElement('a'); a.href=url; a.download=`week${wnum}-${noteTab}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded!');
    }catch{ toast.error('PDF failed — is reportlab installed?'); }
    finally{ setPdfLoad(false); }
  };

  const copyContent=text=>{ navigator.clipboard.writeText(text||''); setCopied(true); toast.success('Copied!'); setTimeout(()=>setCopied(false),2000); };
  const getNoteContent=()=>weekData?.[NOTE_FIELD[noteTab]]||null;

  if(loading) return <div className="flex items-center justify-center h-64"><Loader className="w-6 h-6 animate-spin text-brand-500"/></div>;

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={()=>navigate(`/courses/${cid}`)} className="btn-ghost p-2"><ArrowLeft className="w-4 h-4"/></button>
        <div className="flex-1">
          <div className="text-xs text-slate-400 mb-0.5">{course?.title}</div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Week {wnum}</h1>
        </div>
        <div className="flex gap-2">
          {wnum>1&&<button onClick={()=>navigate(`/courses/${cid}/week/${wnum-1}`)} className="btn-secondary py-2 px-3"><ChevronLeft className="w-4 h-4"/></button>}
          {wnum<(course?.total_weeks||12)&&<button onClick={()=>navigate(`/courses/${cid}/week/${wnum+1}`)} className="btn-secondary py-2 px-3"><ChevronRight className="w-4 h-4"/></button>}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[{id:'transcript',label:'Transcript',icon:Clipboard},{id:'notes',label:'Notes',icon:FileText},{id:'mcqs',label:'MCQs (20)',icon:HelpCircle}].map(({id,label,icon:Icon})=>(
          <button key={id} onClick={()=>setActiveTab(id)} className={`tab-btn flex items-center gap-2 flex-shrink-0 ${activeTab===id?'active':'inactive'}`}>
            <Icon className="w-3.5 h-3.5"/>{label}
          </button>
        ))}
      </div>

      {activeTab==='transcript'&&(
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Youtube className="w-4 h-4 text-red-500"/>Fetch from YouTube</h3>
            <div className="flex gap-3">
              <input value={ytUrl} onChange={e=>setYtUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="input"/>
              <button onClick={fetchYT} disabled={ytLoading} className="btn-primary flex-shrink-0">
                {ytLoading?<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Sparkles className="w-4 h-4"/>}Fetch
              </button>
            </div>
            {ytMsg&&<div className={`mt-3 p-3 rounded-xl text-sm whitespace-pre-line ${ytMsg.includes('✅')?'bg-green-50 dark:bg-green-950/20 text-green-700':'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300'}`}>{ytMsg}</div>}
            <p className="text-xs text-slate-400 mt-2">Fetches publicly available YouTube captions only. Compliant with YouTube ToS.</p>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><Upload className="w-4 h-4 text-brand-500"/>Paste Transcript</h3>
            <textarea value={transcript} onChange={e=>setTranscript(e.target.value)} rows={10}
              placeholder="Paste lecture transcript here…" className="input resize-y text-sm font-mono leading-relaxed"/>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-slate-400">{transcript.length} chars</span>
              <button onClick={saveTranscript} disabled={generating||!transcript.trim()} className="btn-primary">
                {generating?<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Check className="w-4 h-4"/>}Save & Index
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab==='notes'&&(
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap gap-2">
            {NOTE_TABS.map(({id,label,icon:Icon})=>(
              <button key={id} onClick={()=>setNoteTab(id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${noteTab===id?'bg-brand-500 text-white':'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#21262d]'}`}>
                <Icon className="w-3.5 h-3.5"/>{label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={()=>genNotes(noteTab)} disabled={generating} className="btn-primary">
              {generating?<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Sparkles className="w-4 h-4"/>}Generate {noteTab}
            </button>
            {getNoteContent()&&<>
              <button onClick={()=>copyContent(getNoteContent())} className="btn-secondary">{copied?<Check className="w-4 h-4 text-green-500"/>:<Copy className="w-4 h-4"/>}Copy</button>
              <button onClick={dlPDF} disabled={pdfLoad} className="btn-secondary">{pdfLoad?<Loader className="w-4 h-4 animate-spin"/>:<FileDown className="w-4 h-4"/>}PDF</button>
            </>}
          </div>
          {getNoteContent()?<div className="card p-6 prose-custom max-h-[65vh] overflow-y-auto"><ReactMarkdown>{getNoteContent()}</ReactMarkdown></div>
          :<div className="card p-12 text-center"><BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3"/><p className="text-slate-500">{weekData?.transcript?'Click Generate above.':'Add transcript first.'}</p></div>}
        </div>
      )}

      {activeTab==='mcqs'&&(
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={genMCQs} disabled={generating} className="btn-primary">
              {generating?<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Sparkles className="w-4 h-4"/>}Generate 20 MCQs
            </button>
            {weekData?.mcqs&&<button onClick={()=>copyContent(typeof weekData.mcqs==='string'?weekData.mcqs:'')} className="btn-secondary">{copied?<Check className="w-4 h-4 text-green-500"/>:<Copy className="w-4 h-4"/>}Copy All</button>}
          </div>
          {weekData?.mcqs?<div className="card p-6 prose-custom max-h-[65vh] overflow-y-auto"><ReactMarkdown>{typeof weekData.mcqs==='string'?weekData.mcqs:''}</ReactMarkdown></div>
          :<div className="card p-12 text-center"><HelpCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3"/><p className="text-slate-500">{weekData?.transcript?'Click Generate MCQs above.':'Add transcript first.'}</p></div>}
        </div>
      )}
    </div>
  );
}
