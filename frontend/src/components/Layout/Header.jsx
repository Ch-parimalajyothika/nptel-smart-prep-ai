import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
// NEW: Import the NotificationBell component
import { NotificationBell } from '../../Notifications'; 

const TITLES = {
  '/dashboard':'My Dashboard',
  '/courses':  'My Courses',
  '/notes':    'Notes Generator',
  '/questions':'Question Generator',
  '/exam':     'Exam Mode',
  '/upload':   'Upload & Transcribe',
  '/chatbot':  'AI Chatbot',
  '/progress': 'Progress Tracker',
};

const Header = ({ onMenuClick }) => {
  const { dark, toggle } = useTheme();
  const location         = useLocation();
  const path = location.pathname;
  const title = path.includes('/week/') ? 'Week View'
              : path.match(/^\/courses\/\d+$/) ? 'Course Detail'
              : TITLES[path] || 'NPTEL Smart Prep AI';

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6
                       border-b border-slate-100 dark:border-[#21262d]
                       bg-white/80 dark:bg-[#0d1117]/80 backdrop-blur-md sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden btn-ghost p-2"><Menu className="w-5 h-5" /></button>
        <h1 className="font-display font-bold text-lg text-slate-900 dark:text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {/* 
          REPLACED: The old static bell button is now the functional NotificationBell component.
          It will automatically show the unread indicator and handle the dropdown.
        */}
        <NotificationBell />
        
        <button onClick={toggle} className="btn-ghost p-2" title={dark ? 'Light mode' : 'Dark mode'}>
          {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};

// THE FIX: Add this line to the end of the file
export default Header;