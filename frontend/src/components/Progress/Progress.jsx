import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, CheckCircle, Circle, AlertTriangle,
  Award, Target, BookOpen, RotateCcw, Trophy, Loader,
  BarChart2, ArrowRight
} from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine
} from 'recharts';
import { examAPI, progressAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const RADAR_FALLBACK = [
  {subject:'AI',score:0},{subject:'ML',score:0},{subject:'HCI',score:0},
  {subject:'CV',score:0},{subject:'DBMS',score:0},{subject:'OS',score:0},
];

export default function Progress() {
  const navigate  = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      examAPI.stats().then(r=>setStats(r.data)).catch(()=>{}),
      examAPI.results().then(r=>setResults(r.data)).catch(()=>{}),
    ]).finally(()=>setLoading(false));
  };
  useEffect(load,[]);

  const clearHistory = async () => {
    if(!window.confirm('Clear all exam history?')) return;
    try {
      await examAPI.clear();
      setStats(null); setResults([]);
      toast.success('History cleared');
    } catch { toast.error('Failed'); }
  };

  // Build radar data from course_breakdown
  const radarData = stats?.course_breakdown
    ? Object.entries(stats.course_breakdown).slice(0,8).map(([k,v])=>({subject:k,score:v.avg}))
    : RADAR_FALLBACK;

  // Trend line data
  const trendData = stats?.trend || [];

  const scoreColor = s => s>=80?'text-green-600 dark:text-green-400':s>=60?'text-amber-500':'text-red-500';
  const scoreBadge = s => s>=80?'bg-green-50 dark:bg-green-950/30 text-green-600':s>=60?'bg-amber-50 dark:bg-amber-950/30 text-amber-600':'bg-red-50 dark:bg-red-950/30 text-red-500';

  if(loading) return <div className="flex items-center justify-center h-64"><Loader className="w-6 h-6 animate-spin text-brand-500"/></div>;

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:'Exams Taken',  value:stats?.total_exams??0,                                       icon:Trophy,       color:'text-amber-600 bg-amber-50 dark:bg-amber-950/30'    },
          {label:'Average Score',value:stats?.avg_score?`${stats.avg_score}%`:'N/A',                icon:Target,       color:'text-brand-600 bg-brand-50 dark:bg-brand-950/30'    },
          {label:'Best Score',   value:stats?.best_score?`${stats.best_score}%`:'N/A',              icon:Award,        color:'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'},
          {label:'Accuracy',     value:stats?.accuracy?`${stats.accuracy}%`:'N/A',                  icon:CheckCircle,  color:'text-violet-600 bg-violet-50 dark:bg-violet-950/30'  },
        ].map(({label,value,icon:Icon,color})=>(
          <div key={label} className="card p-5 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-5 h-5"/></div>
            <div><div className="text-xl font-display font-bold text-slate-900 dark:text-white">{value}</div><div className="text-xs text-slate-400">{label}</div></div>
          </div>
        ))}
      </div>

      {stats?.total_exams > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Radar */}
            <div className="card p-5 lg:col-span-2">
              <h3 className="font-display font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-500"/>Subject Mastery
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border)"/>
                  <PolarAngleAxis dataKey="subject" tick={{fontSize:10,fill:'var(--text-secondary)'}}/>
                  <Radar dataKey="score" stroke="#14b896" fill="#14b896" fillOpacity={0.2} strokeWidth={2}/>
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Score Trend */}
            <div className="card p-5 lg:col-span-3">
              <h3 className="font-display font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-brand-500"/>Score Trend
              </h3>
              {trendData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                    <XAxis dataKey="date" tick={{fontSize:10,fill:'var(--text-secondary)'}} axisLine={false} tickLine={false}/>
                    <YAxis domain={[0,100]} tick={{fontSize:10,fill:'var(--text-secondary)'}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:'8px',fontSize:'12px'}}/>
                    <ReferenceLine y={90} stroke="#14b896" strokeDasharray="4 4" label={{value:'90% target',fill:'#14b896',fontSize:10}}/>
                    <Line type="monotone" dataKey="score" stroke="#14b896" strokeWidth={2.5} dot={{r:4,fill:'#14b896'}} activeDot={{r:6}}/>
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-44 text-slate-400 text-sm">
                  Take at least 2 exams to see trend
                </div>
              )}
            </div>
          </div>

          {/* Weak topics */}
          {stats?.weak_topics?.length>0 && (
            <div className="card p-5">
              <h3 className="font-display font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500"/>Weak Areas — Needs Revision
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {stats.weak_topics.map(({topic,count})=>(
                  <div key={topic} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium">
                    <AlertTriangle className="w-3 h-3"/>{topic.slice(0,35)} <span className="text-amber-400">×{count}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-400">💡 Use the <strong>Notes Generator</strong> or <strong>AI Chatbot</strong> to review these topics.</p>
            </div>
          )}

          {/* Recent Results Table */}
          <div className="card">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#21262d]">
              <h3 className="font-display font-bold text-slate-900 dark:text-white">Recent Exams</h3>
              <button onClick={clearHistory} className="text-xs text-red-400 hover:text-red-500 font-medium flex items-center gap-1">
                <RotateCcw className="w-3 h-3"/>Clear
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-[#21262d] max-h-72 overflow-y-auto">
              {results.slice(0,15).map(r=>(
                <div key={r.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-[#161b22] transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${scoreBadge(r.score_pct)}`}>
                    {Math.round(r.score_pct)}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-slate-900 dark:text-white">{r.course_label}</div>
                    <div className="text-xs text-slate-400">{r.correct}/{r.total_q} correct · {new Date(r.taken_at).toLocaleDateString()}</div>
                  </div>
                  <div className={`text-sm font-bold ${scoreColor(r.score_pct)}`}>{Math.round(r.score_pct)}%</div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="card p-12 text-center">
          <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4"/>
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-2">No exam data yet</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto mb-5">Take your first timed exam to start tracking your performance, accuracy, and weak areas.</p>
          <button onClick={()=>navigate('/exam')} className="btn-primary inline-flex">
            <Trophy className="w-4 h-4"/>Start First Exam <ArrowRight className="w-4 h-4"/>
          </button>
        </div>
      )}
    </div>
  );
}
