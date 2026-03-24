import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, Eye, EyeOff, LogIn, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../utils/api';
// REMOVED: import toast from 'react-hot-toast';
// NEW: Import the custom notification hook
import { useNotification } from '../../Notifications'; 

const Login = () => {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login }  = useAuth();
  const navigate   = useNavigate();
  
  // NEW: Get the notification functions from the hook
  const { success, error } = useNotification();

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.email || !form.password) { 
      // REMOVED: toast.error('Please fill all fields');
      // NEW: Use the custom error notification
      error('Please fill all fields'); 
      return; 
    }
    setLoading(true);
    try {
      const res = await authAPI.login(form);
      login(res.data.user, res.data.token);
      // REMOVED: toast.success(`Welcome back, ${res.data.user.name}!`);
      // NEW: Use the custom success notification
      success(`Welcome back, ${res.data.user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      // REMOVED: toast.error(err.response?.data?.error || 'Login failed. Please try again.');
      // NEW: Use the custom error notification
      error(err.response?.data?.error || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  };

  const demoLogin = async () => {
    setLoading(true);
    try {
      const res = await authAPI.login({ email: 'demo@nptel.ai', password: 'demo1234' });
      login(res.data.user, res.data.token);
      // REMOVED: toast.success('Logged in as Demo User!');
      // NEW: Use the custom success notification
      success('Logged in as Demo User!');
      navigate('/dashboard');
    } catch {
      login({ id: 1, name: 'Demo User', email: 'demo@nptel.ai' }, 'demo-token');
      // REMOVED: toast.success('Demo mode activated!');
      // NEW: Use the custom success notification
      success('Demo mode activated!');
      navigate('/dashboard');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d1117] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-md animate-slide-up relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-500 rounded-2xl shadow-glow mb-4">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">NPTEL Smart Prep AI</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Your intelligent NPTEL study companion</p>
        </div>
        <div className="card p-8">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mb-6">Sign in to your account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="you@example.com" className="input" autoComplete="email" />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} name="password" value={form.password}
                  onChange={handleChange} placeholder="••••••••" className="input pr-12" />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <LogIn className="w-4 h-4" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs text-slate-400">or</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>
          <button onClick={demoLogin} disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-brand-300 dark:border-brand-800 text-brand-600 dark:text-brand-400 font-semibold text-sm hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-all">
            <Sparkles className="w-4 h-4" /> Try Demo Account
          </button>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-5">
            Don't have an account?{' '}
            <Link to="/signup" className="text-brand-600 dark:text-brand-400 font-semibold hover:underline">Create one</Link>
          </p>
        </div>
        <div className="disclaimer mt-4 text-center">
          ⚠️ For educational purposes only. Content belongs to NPTEL / IITs.
        </div>
      </div>
    </div>
  );
};

export default Login;