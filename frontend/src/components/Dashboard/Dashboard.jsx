import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Brain, Cloud, Database, Code, Network, Shield, Plus, ArrowRight,
         Trophy, FileText, MessageCircle, TrendingUp, Clock, Cpu, Layers, Eye,
         Fingerprint, Target, Star } from 'lucide-react';
import { coursesAPI, examAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
// NEW: Import the notification hook
import { useNotification } from '../../Notifications'; 

const ICONS  = { AI:Brain,ML:Cpu,HCI:MessageCircle,CV:Eye,IP:Layers,BC:Fingerprint,
                 DBMS:Database,DSA:Code,CN:Network,OS:Shield,CLOUD:Cloud,DL:Brain };
const COLORS = { AI:'from-violet-500 to-purple-600',ML:'from-blue-500 to-indigo-600',
                 HCI:'from-pink-500 to-rose-600',CV:'from-emerald-500 to-green-600',
                 IP:'from-sky-500 to-cyan-600',BC:'from-orange-500 to-amber-600',
                 DBMS:'from-red-500 to-orange-600',DSA:'from-teal-500 to-brand-600',
                 CN:'from-indigo-500 to-blue-600',OS:'from-yellow-500 to-orange-600',
                 CLOUD:'from-sky-400 to-blue-500',DL:'from-purple-500 to-indigo-600' };
const ACTIONS = [
  { icon:FileText,      label:'Generate Notes', path:'/courses', color:'text-brand-600 bg-brand-50 dark:bg-brand-950/30' },
  { icon:MessageCircle, label:'AI Chatbot',      path:'/chatbot', color:'text-violet-600 bg-violet-50 dark:bg-violet-950/30' },
  { icon:Trophy,        label:'Exam Mode',       path:'/exam',    color:'text-amber-600 bg-amber-50 dark:bg-amber-950/30'  },
  { icon:TrendingUp,    label:'Progress',        path:'/progress',color:'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [courses, setCourses] = useState([]);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  
  // NEW: Get the notification functions
  const { success, error, info } = useNotification();

  useEffect(() => {
    // NEW: Refactored to use try/catch for better error handling
    const fetchData = async () => {
      try {
        const [coursesRes, statsRes] = await Promise.all([
          coursesAPI.list(),
          examAPI.stats(),
        ]);
        setCourses(coursesRes.data);
        setStats(statsRes.data);
        // NEW: Show a success message when data loads
        success('Dashboard loaded successfully!');
      } catch (err) {
        console.error(err);
        // NEW: Show an error message if the API call fails
        error('Failed to load dashboard data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [success, error]); // NEW: Added dependencies for the hook

  const greet = () => { const h = new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening'; };

  return (
    <div className="p-4 lg:p-6 space-y-7 animate-fade-in">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 p-6 lg:p-8 text-white">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full pointer-events-none" />
        <div className="absolute right-8 -bottom-4 w-28 h-28 bg-white/10 rounded-full pointer-events-none" />
        <div className="relative">
          <p className="text-brand-100 text-sm">{greet()},</p>
          <h2 className="font-display text-2xl lg:text-3xl font-bold mt-0.5 mb-2">{user?.name?.split(' ')[0] || 'Student'} 👋</h2>
          <p className="text-brand-100 text-sm max-w-md leading-relaxed">AI-powered NPTEL prep platform. Target: <strong>90%+ score.</strong></p>
          <div className="flex flex-wrap gap-3 mt-5">
            {/* NEW: Added notification to button click */}
            <button onClick={() => { info('Opening your courses...'); navigate('/courses'); }} className="bg-white text-brand-700 font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-brand-50 transition-all active:scale-95 flex items-center gap-2">
              <BookOpen className="w-4 h-4"/> My Courses
            </button>
            {/* NEW: Added notification to button click */}
            <button onClick={() => { info('Redirecting to practice exam...'); navigate('/exam'); }} className="bg-white/20 hover:bg-white/30 font-semibold text-sm px-5 py-2.5 rounded-xl transition-all active:scale-95">
              Take Practice Exam
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Courses',    value:loading?'…':courses.length,                                   icon:BookOpen, color:'text-brand-600 bg-brand-50 dark:bg-brand-950/30' },
          { label:'Exams Taken',value:loading?'…':(stats?.total_exams??0),                          icon:Trophy,   color:'text-amber-600 bg-amber-50 dark:bg-amber-950/30'  },
          { label:'Avg Score',  value:loading?'…':(stats?.avg_score?`${stats.avg_score}%`:'N/A'),   icon:Target,   color:'text-violet-600 bg-violet-50 dark:bg-violet-950/30' },
          { label:'Best Score', value:loading?'…':(stats?.best_score?`${stats.best_score}%`:'N/A'), icon:Star,     color:'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
        ].map(({label,value,icon:Icon,color}) => (
          <div key={label} className="card p-5 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-5 h-5"/></div>
            <div><div className="text-xl font-display font-bold text-slate-900 dark:text-white">{value}</div><div className="text-xs text-slate-400">{label}</div></div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {ACTIONS.map(({icon:Icon,label,path,color}) => (
            // NEW: Added notification to button click
            <button key={path} onClick={() => { info(`Opening ${label}...`); navigate(path); }} className="card card-hover p-4 text-left group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} mb-3`}><Icon className="w-4 h-4"/></div>
              <div className="font-semibold text-sm text-slate-900 dark:text-white">{label}</div>
              <div className="mt-2 flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Open <ArrowRight className="w-3 h-3"/></div>
            </button>
          ))}
        </div>
      </div>

      {/* Courses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">Your Courses</h3>
          <button onClick={() => navigate('/courses')} className="text-sm text-brand-600 font-semibold hover:underline flex items-center gap-1">Manage <ArrowRight className="w-3 h-3"/></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? Array(8).fill(0).map((_,i) => <div key={i} className="h-40 rounded-2xl shimmer-loading"/>) :
           courses.slice(0,8).map(c => {
            const Icon = ICONS[c.code] || BookOpen;
            const grad = COLORS[c.code] || 'from-slate-500 to-gray-600';
            const pct  = c.total_weeks ? Math.round((c.weeks_done/c.total_weeks)*100) : 0;
            return (
              // NEW: Added notification to course click
              <button key={c.id} onClick={() => { info(`Opening course: ${c.title}`); navigate(`/courses/${c.id}`); }} className="card card-hover p-5 text-left">
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center mb-3 shadow-sm`}><Icon className="w-5 h-5 text-white"/></div>
                <div className="font-semibold text-sm text-slate-900 dark:text-white leading-snug mb-1">{c.title}</div>
                <div className="flex items-center gap-1 text-xs text-slate-400 mb-3"><Clock className="w-3 h-3"/>{c.total_weeks} weeks</div>
                <div className="progress-bar mb-1"><div className="progress-bar-fill" style={{width:`${pct}%`}}/></div>
                <div className="text-xs text-slate-400">{c.weeks_done}/{c.total_weeks} done</div>
              </button>
            );
           })}
          {/* NEW: Added notification to "Add Course" button */}
          <button onClick={() => { info('Opening course management to add a new course...'); navigate('/courses'); }} className="card card-hover p-5 border-dashed border-2 border-slate-200 dark:border-[#21262d] flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-brand-500 hover:border-brand-400 min-h-[160px]">
            <Plus className="w-8 h-8"/><span className="text-sm font-medium">Add Course</span>
          </button>
        </div>
      </div>
      <div className="disclaimer">⚠️ <strong>Disclaimer:</strong> This tool is for educational purposes only. Original NPTEL content belongs to NPTEL / IITs. AI-generated notes are supplementary study aids only.</div>
    </div>
  );
}