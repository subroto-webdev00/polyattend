'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    // Admin / Department Admin / Semester Admin: no token yet — an OTP was
    // just emailed and the caller (login page) must show the OTP step and
    // call verifyLoginOtp() to actually get a token.
    if (res.data.requiresOtp) {
      return { requiresOtp: true, email: res.data.email };
    }
    setUser(res.data.user);
    return res.data.user;
  };

  const verifyLoginOtp = async (email, otp) => {
    const res = await api.post('/auth/verify-login-otp', { email, otp });
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => { });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyLoginOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
