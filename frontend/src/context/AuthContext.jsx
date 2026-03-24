import React, { createContext, useContext, useState, useEffect } from 'react';

// ─── Auth Context ─────────────────────────────────────
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]   = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on startup
  useEffect(() => {
    const saved = localStorage.getItem('nptel_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); }
      catch { localStorage.removeItem('nptel_user'); }
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    const u = { ...userData, token };
    setUser(u);
    localStorage.setItem('nptel_user', JSON.stringify(u));
    localStorage.setItem('nptel_token', token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('nptel_user');
    localStorage.removeItem('nptel_token');
  };

  const getToken = () => localStorage.getItem('nptel_token');

  return (
    <AuthContext.Provider value={{ user, login, logout, getToken, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
