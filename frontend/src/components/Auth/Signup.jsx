import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, Eye, EyeOff, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const Signup = () => {
  const [form, setForm]       = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { toast.error('Please fill all fields'); return; }
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await authAPI.signup({ name: form.name, email: form.email, password: form.password });
      login(res.data.user, res.data.token);
      toast.success('Account created! Welcome 🎉');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Signup failed. Please try again.');
    } finally { setLoading(false); }
  };

  const strength = () => {
    const l = form.password.length;
    if (!l) return null;
    if (l < 4) return { label: 'Too weak', color: 'bg-red-400', w: '25%' };
    if (l < 6) return { label: 'Weak',     color: 'bg-orange-400', w: '50%' };
    if (l < 8) return { label: 'Fair',     color: 'bg-yellow-400', w: '75%' };
    return { label: 'Strong', color: 'bg-green-400', w: '100%' };
  };
  const s = strength();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d1117] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-brand-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="w-full max-w-md animate-slide-up relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-500 rounded-2xl shadow-glow mb-4">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">NPTEL Smart Prep AI</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Start your learning journey</p>
        </div>
        <div className="card p-8">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mb-6">Create your account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="John Doe" className="input" />
            </div>
            <div>
              <label className="label">Email address</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" className="input" />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} name="password" value={form.password}
                  onChange={handleChange} placeholder="Min. 6 characters" className="input pr-12" />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {s && (
                <div className="mt-1.5 space-y-1">
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${s.color}`} style={{ width: s.w }} />
                  </div>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              )}
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input type="password" name="confirm" value={form.confirm} onChange={handleChange} placeholder="Re-enter password" className="input" />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 dark:text-brand-400 font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
export default Signup;
