import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, FileText, HelpCircle, Trophy,
  Upload, MessageCircle, TrendingUp, LogOut, X, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const NAV = [
  { path:'/dashboard', icon:LayoutDashboard, label:'Dashboard'  },
  { path:'/courses',   icon:BookOpen,         label:'Courses'    },
  { path:'/notes',     icon:FileText,         label:'Notes'      },
  { path:'/questions', icon:HelpCircle,       label:'Questions'  },
  { path:'/exam',      icon:Trophy,           label:'Exam Mode'  },
  { path:'/upload',    icon:Upload,           label:'Upload'     },
  { path:'/chatbot',   icon:MessageCircle,    label:'AI Chatbot' },
  { path:'/progress',  icon:TrendingUp,       label:'Progress'   },
];

export default function Sidebar({ open, onClose }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuth();

  const go = path => { navigate(path); onClose?.(); };

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  // Active match — also highlight /courses for nested course/week routes
  const isActive = path => {
    if (path === '/courses') return location.pathname.startsWith('/courses');
    return location.pathname === path;
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={onClose}/>}
      <aside className={`
        fixed top-0 left-0 h-full z-50 w-64
        bg-white dark:bg-[#0d1117] border-r border-slate-100 dark:border-[#21262d]
        flex flex-col transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:z-auto
        ${open?'translate-x-0':'-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#21262d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shadow-glow">
              <BookOpen className="w-4 h-4 text-white"/>
            </div>
            <div>
              <div className="font-display font-bold text-sm text-slate-900 dark:text-white leading-tight">NPTEL Smart</div>
              <div className="font-display font-bold text-sm leading-tight" style={{background:'linear-gradient(135deg,#14b896,#5eeac8)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Prep AI v2</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden btn-ghost p-1.5"><X className="w-4 h-4"/></button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-wider px-3 mb-3">Menu</p>
          {NAV.map(({path,icon:Icon,label})=>(
            <button key={path} onClick={()=>go(path)} className={`sidebar-link ${isActive(path)?'active':''}`}>
              <Icon className="w-4 h-4 flex-shrink-0"/>
              <span className="flex-1 text-left">{label}</span>
              {isActive(path) && <ChevronRight className="w-3 h-3 opacity-60"/>}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-slate-100 dark:border-[#21262d]">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#161b22] mb-2">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase()||'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.name||'Student'}</div>
              <div className="text-xs text-slate-400 truncate">{user?.email||''}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
            <LogOut className="w-4 h-4"/>Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
