import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, Eye, EyeOff, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../utils/api';
import toast from 'react-hot-toast';

const Signup = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: ''
  });

  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ Validation
    if (!form.name || !form.email || !form.password) {
      toast.error('Please fill all fields');
      return;
    }

    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }

    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      console.log("Sending signup request:", form); // 🔥 DEBUG

      const res = await authAPI.signup({
        name: form.name,
        email: form.email,
        password: form.password
      });

      console.log("Signup response:", res.data); // 🔥 DEBUG

      // ✅ Save user + token
      login(res.data.user, res.data.token);

      toast.success('Account created! 🎉');

      // 🔥 IMPORTANT: GitHub Pages fix
      navigate('/#/dashboard');

    } catch (err) {
      console.error("Signup error:", err); // 🔥 DEBUG

      toast.error(
        err.response?.data?.error ||
        err.message ||
        'Signup failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const strength = () => {
    const l = form.password.length;
    if (!l) return null;
    if (l < 4) return { label: 'Too weak', color: 'bg-red-400', w: '25%' };
    if (l < 6) return { label: 'Weak', color: 'bg-orange-400', w: '50%' };
    if (l < 8) return { label: 'Fair', color: 'bg-yellow-400', w: '75%' };
    return { label: 'Strong', color: 'bg-green-400', w: '100%' };
  };

  const s = strength();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d1117] flex items-center justify-center p-4">
      
      <div className="w-full max-w-md">

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-500 rounded-2xl mb-3">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold">NPTEL Smart Prep AI</h1>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4">Create Account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">

            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Full Name"
              className="input"
            />

            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Email"
              className="input"
            />

            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Password"
                className="input pr-10"
              />

              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <input
              type="password"
              name="confirm"
              value={form.confirm}
              onChange={handleChange}
              placeholder="Confirm Password"
              className="input"
            />

            {s && (
              <div className="text-xs text-gray-500">{s.label}</div>
            )}

            <button type="submit" className="btn-primary w-full">
              {loading ? "Creating..." : "Create Account"}
            </button>

          </form>

          <p className="text-center mt-4">
            Already have account? <Link to="/login">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;