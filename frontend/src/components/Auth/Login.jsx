import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, Eye, EyeOff, LogIn, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../utils/api';
import { useNotification } from '../../Notifications'; 

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const { success, error } = useNotification();

  const handleChange = e =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();

    if (!form.email || !form.password) {
      error('Please fill all fields');
      return;
    }

    setLoading(true);

    try {
      console.log("Login request:", form); // DEBUG

      const res = await authAPI.login(form);

      console.log("Login response:", res.data); // DEBUG

      login(res.data.user, res.data.token);

      success(`Welcome back, ${res.data.user.name}!`);

      // 🔥 FIX FOR GITHUB PAGES
      navigate('/#/dashboard');

    } catch (err) {
      console.error("Login error:", err); // DEBUG

      error(
        err.response?.data?.error ||
        err.message ||
        'Login failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async () => {
    setLoading(true);
    try {
      const res = await authAPI.login({
        email: 'demo@nptel.ai',
        password: 'demo1234'
      });

      login(res.data.user, res.data.token);
      success('Logged in as Demo User!');
      navigate('/#/dashboard');

    } catch {
      login(
        { id: 1, name: 'Demo User', email: 'demo@nptel.ai' },
        'demo-token'
      );
      success('Demo mode activated!');
      navigate('/#/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-6">
          <BookOpen className="mx-auto mb-2" />
          <h1 className="text-xl font-bold">NPTEL Smart Prep AI</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

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

          <button type="submit" className="btn-primary w-full">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <button onClick={demoLogin} className="w-full mt-3">
          Try Demo
        </button>

        <p className="text-center mt-3">
          <Link to="/signup">Create account</Link>
        </p>

      </div>
    </div>
  );
};

export default Login;