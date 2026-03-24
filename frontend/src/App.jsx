import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './Notifications';

import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Login from './components/Auth/Login';
import Signup from './components/Auth/Signup';
import Dashboard from './components/Dashboard/Dashboard';
import CourseManager from './components/Courses/CourseManager';
import CourseDetail from './components/Courses/CourseDetail';
import WeekView from './components/Weeks/WeekView';
import Notes from './components/Notes/Notes';
import Questions from './components/Questions/Questions';
import Exam from './components/Exam/Exam';
import Upload from './components/Upload/Upload';
import Chatbot from './components/Chatbot/Chatbot';
import Progress from './components/Progress/Progress';


// ✅ PROTECTED
const Protected = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return user ? children : <Navigate to="/login" replace />;
};


// ✅ LAYOUT
const Shell = ({ children }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col">
        <Header onMenuClick={() => setOpen(true)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};


// ✅ WRAPPER
const P = ({ el }) => (
  <Protected>
    <Shell>{el}</Shell>
  </Protected>
);


// ✅ ROUTES
const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />

    <Route path="/dashboard" element={<P el={<Dashboard />} />} />
    <Route path="/courses" element={<P el={<CourseManager />} />} />
    <Route path="/courses/:courseId" element={<P el={<CourseDetail />} />} />
    <Route path="/courses/:courseId/week/:weekNum" element={<P el={<WeekView />} />} />
    <Route path="/notes" element={<P el={<Notes />} />} />
    <Route path="/questions" element={<P el={<Questions />} />} />
    <Route path="/exam" element={<P el={<Exam />} />} />
    <Route path="/upload" element={<P el={<Upload />} />} />
    <Route path="/chatbot" element={<P el={<Chatbot />} />} />
    <Route path="/progress" element={<P el={<Progress />} />} />

    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);


// ✅ MAIN APP
const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <AppRoutes />
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;