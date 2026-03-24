import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Trash2, ChevronRight, Search, Clock, X } from 'lucide-react';
import { coursesAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const PRESET = [
  {title:'Artificial Intelligence',code:'AI',total_weeks:12},
  {title:'Machine Learning',code:'ML',total_weeks:12},
  {title:'Human Computer Interaction',code:'HCI',total_weeks:12},
  {title:'Computer Vision',code:'CV',total_weeks:12},
  {title:'Image Processing',code:'IP',total_weeks:12},
  {title:'Blockchain Technology',code:'BC',total_weeks:12},
  {title:'Database Management Systems',code:'DBMS',total_weeks:12},
  {title:'Data Structures & Algorithms',code:'DSA',total_weeks:12},
  {title:'Computer Networks',code:'CN',total_weeks:12},
  {title:'Operating Systems',code:'OS',total_weeks:12},
  {title:'Cloud Computing',code:'CLOUD',total_weeks:8},
  {title:'Deep Learning',code:'DL',total_weeks:12},
];

export default function CourseManager() {
  const navigate  = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search,  setSearch]  = useState('');
  const [form,    setForm]    = useState({title:'',code:'',total_weeks:12});
  const [saving,  setSaving]  = useState(false);

  const load = () => {
    setLoading(true);
    coursesAPI.list().then(r=>setCourses(r.data)).catch(()=>toast.error('Failed to load')).finally(()=>setLoading(false));
  };
  useEffect(load, []);

  const addCourse = async preset => {
    setSaving(true);
    try {
      const payload = preset || form;
      if (!payload.title.trim()) { toast.error('Title required'); return; }
      const r = await coursesAPI.create(payload);
      setCourses(p=>[...p,{...r.data,weeks_done:0}]);
      setShowAdd(false); setForm({title:'',code:'',total_weeks:12});
      toast.success('Course added!');
    } catch(e) { toast.error(e.response?.data?.error||'Failed'); }
    finally { setSaving(false); }
  };

  const deleteCourse = async (id, title) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try { await coursesAPI.delete(id); setCourses(p=>p.filter(c=>c.id!==id)); toast.success('Deleted'); }
    catch { toast.error('Delete failed'); }
  };

  const filtered = courses.filter(c=>c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">My Courses</h1>
          <p className="text-sm text-slate-400 mt-0.5">{courses.length} course{courses.length!==1?'s':''}</p>
        </div>
        <button onClick={()=>setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4"/>Add Course</button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search courses…" className="input pl-10"/>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array(6).fill(0).map((_,i)=><div key={i} className="h-44 rounded-2xl shimmer-loading"/>)}</div>
      ) : filtered.length===0 ? (
        <div className="card p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3"/>
          <p className="text-slate-500 font-medium">No courses yet.</p>
          <button onClick={()=>setShowAdd(true)} className="btn-primary mt-4 inline-flex"><Plus className="w-4 h-4"/>Add Course</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c=>{
            const pct = c.total_weeks?Math.round((c.weeks_done/c.total_weeks)*100):0;
            return (
              <div key={c.id} className="card p-5 group relative">
                <button onClick={()=>deleteCourse(c.id,c.title)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 btn-ghost p-1.5 text-red-400 hover:text-red-500 transition-opacity"><Trash2 className="w-3.5 h-3.5"/></button>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-brand-600 font-display font-bold text-xs">{c.code||c.title.slice(0,2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-900 dark:text-white leading-snug">{c.title}</div>
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5"><Clock className="w-3 h-3"/>{c.total_weeks} weeks</div>
                  </div>
                </div>
                <div className="progress-bar mb-1"><div className="progress-bar-fill" style={{width:`${pct}%`}}/></div>
                <div className="flex justify-between text-xs text-slate-400 mb-3"><span>{c.weeks_done}/{c.total_weeks} weeks</span><span>{pct}%</span></div>
                <button onClick={()=>navigate(`/courses/${c.id}`)} className="w-full btn-primary text-sm py-2">Open Course<ChevronRight className="w-3.5 h-3.5"/></button>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>setShowAdd(false)}>
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#21262d]">
              <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">Add a Course</h2>
              <button onClick={()=>setShowAdd(false)} className="btn-ghost p-2"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-5 border-b border-slate-100 dark:border-[#21262d] space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Custom Course</h3>
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Course title" className="input"/>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="Code (e.g. AI)" className="input"/>
                <input type="number" value={form.total_weeks} onChange={e=>setForm(f=>({...f,total_weeks:+e.target.value}))} min={1} max={24} className="input"/>
              </div>
              <button onClick={()=>addCourse(null)} disabled={saving||!form.title} className="btn-primary w-full">
                {saving?<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<Plus className="w-4 h-4"/>}Add Custom
              </button>
            </div>
            <div className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Popular NPTEL Courses</h3>
              <div className="space-y-2">
                {PRESET.map(p=>(
                  <button key={p.code} onClick={()=>addCourse(p)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-[#21262d] transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center"><span className="text-brand-600 font-bold text-xs">{p.code}</span></div>
                      <div><div className="text-sm font-medium text-slate-800 dark:text-slate-200">{p.title}</div><div className="text-xs text-slate-400">{p.total_weeks} weeks</div></div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors"/>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
