import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  // Dark Mode switching handler
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Check login status on mount
  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const res = await axios.get('/api/auth/me');
        if (res.data.success) {
          setUser(res.data.user);
        }
      } catch (err) {
        // Not logged in or expired token, clear state
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkLoggedIn();
  }, []);

  // Login handler — returns user on success (for role-based redirect)
  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      if (res.data.success) {
        setUser(res.data.user);
        toast.success(`Welcome back, ${res.data.user.name}!`);
        return res.data.user;
      }
      return null;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Email or password is incorrect. Please check and try again.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Register handler
  const register = async (name, email, password, role) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/register', { name, email, password, role });
      if (res.data.success) {
        setUser(res.data.user);
        toast.success(`Account created successfully! Welcome, ${res.data.user.name}`);
        return true;
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await axios.get('/api/auth/logout');
      setUser(null);
      toast.success('Logged out successfully');
    } catch (err) {
      toast.error('Logout failed');
    }
  };

  // Forgot password
  const forgotPassword = async (email) => {
    try {
      const res = await axios.post('/api/auth/forgot-password', { email });
      if (res.data.success) {
        toast.success('Password reset link sent to your email.');
        return true;
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Request failed');
      return false;
    }
  };

  // Reset password
  const resetPassword = async (token, password) => {
    try {
      const res = await axios.put(`/api/auth/reset-password/${token}`, { password });
      if (res.data.success) {
        setUser(res.data.user);
        toast.success('Password reset completed successfully!');
        return true;
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed');
      return false;
    }
  };

  // Update profile details
  const updateProfile = async (name, email, avatarFile = null, removeAvatar = false) => {
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim();
    if (!cleanName || cleanName.length < 2) {
      toast.error('Full name is required');
      return false;
    }
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      toast.error('A valid email is required');
      return false;
    }
    try {
      const formData = new FormData();
      formData.append('name', cleanName);
      formData.append('email', cleanEmail);
      if (avatarFile) formData.append('avatar', avatarFile);
      if (removeAvatar) formData.append('removeAvatar', 'true');

      const res = await axios.put('/api/auth/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setUser(res.data.user);
        toast.success('Profile updated successfully!');
        return true;
      }
      toast.error('Update failed');
      return false;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
      return false;
    }
  };

  // Change password
  const changePassword = async (currentPassword, newPassword) => {
    try {
      const res = await axios.put('/api/auth/change-password', { currentPassword, newPassword });
      if (res.data.success) {
        toast.success('Password updated successfully!');
        return true;
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Password update failed');
      return false;
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    theme,
    toggleTheme,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    changePassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
