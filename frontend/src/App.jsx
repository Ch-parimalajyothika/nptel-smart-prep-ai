import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// REMOVED: import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider }         from './context/ThemeContext';
// NEW: Import the NotificationProvider
import { NotificationProvider } from './Notifications'; 

import Sidebar       from './components/Layout/Sidebar';
import Header        from './components/Layout/Header';
import Login         from './components/Auth/Login';
import Signup        from './components/Auth/Signup';
import Dashboard     from './components/Dashboard/Dashboard';
import CourseManager from './components/Courses/CourseManager';
import CourseDetail  from './components/Courses/CourseDetail';
import WeekView      from './components/Weeks/WeekView';
import Notes         from './components/Notes/Notes';
import Questions     from './components/Questions/Questions';
import Exam          from './components/Exam/Exam';
import Upload        from './components/Upload/Upload';
import Chatbot       from './components/Chatbot/Chatbot';
import Progress      from './components/Progress/Progress';

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0d1117]">
      <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin"/>
    </div>
  );
  return user ? children : <Navigate to="/login" replace/>;
};

const Shell = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-secondary)]">
      <Sidebar open={open} onClose={()=>setOpen(false)}/>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={()=>setOpen(true)}/>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

const P = ({ el }) => <Protected><Shell>{el}</Shell></Protected>;

const AppRoutes = () => (
  <Routes>
    <Route path="/login"  element={<Login/>}/>
    <Route path="/signup" element={<Signup/>}/>
    <Route path="/dashboard"                       element={<P el={<Dashboard/>}/>}/>
    <Route path="/courses"                         element={<P el={<CourseManager/>}/>}/>
    <Route path="/courses/:courseId"               element={<P el={<CourseDetail/>}/>}/>
    <Route path="/courses/:courseId/week/:weekNum" element={<P el={<WeekView/>}/>}/>
    <Route path="/notes"                           element={<P el={<Notes/>}/>}/>
    <Route path="/questions"                       element={<P el={<Questions/>}/>}/>
    <Route path="/exam"                            element={<P el={<Exam/>}/>}/>
    <Route path="/upload"                          element={<P el={<Upload/>}/>}/>
    <Route path="/chatbot"                         element={<P el={<Chatbot/>}/>}/>
    <Route path="/progress"                        element={<P el={<Progress/>}/>}/>
    <Route path="/"  element={<Navigate to="/dashboard" replace/>}/>
    <Route path="*"  element={<Navigate to="/dashboard" replace/>}/>
  </Routes>
);

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      {/* NEW: Wrap the app with NotificationProvider */}
      <NotificationProvider>
        <BrowserRouter>
          <AppRoutes/>
          {/* REMOVED: The old Toaster component is no longer needed */}
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;