import React, { useState, useRef, useEffect } from 'react';
import { FiMenu, FiSun, FiMoon, FiBell, FiSearch, FiUser, FiLogOut, FiSettings } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';

const Navbar = ({ toggleSidebar, sidebarCollapsed }) => {
  const { user, logout, theme, toggleTheme } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const profileRef = useRef(null);
  const notifyRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get('/api/notifications');
      if (res.data.success) {
        setNotifications(res.data.notifications);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (notifyRef.current && !notifyRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = async () => {
    try {
      const res = await axios.put('/api/notifications/read-all');
      if (res.data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkOneRead = async (id) => {
    try {
      const res = await axios.put(`/api/notifications/${id}/read`);
      if (res.data.success) {
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getFormatTime = (isoString) => {
    const date = new Date(isoString);
    const diff = Math.floor((new Date() - date) / 1000); // in seconds
    if (diff < 60) return 'just now';
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/80 px-3 sm:px-6 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80 transition-colors duration-200">
      
      {/* Search & Collapse Trigger */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors shrink-0"
          aria-label="Toggle sidebar"
        >
          <FiMenu className="h-5 w-5" />
        </button>

        <div className="relative hidden sm:block">
          <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents, materials..."
            className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-teal-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:focus:border-teal-500 transition-all"
          />
        </div>
      </div>

      {/* User Actions Panel */}
      <div className="flex items-center gap-3">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {theme === 'dark' ? <FiSun className="h-5 w-5" /> : <FiMoon className="h-5 w-5" />}
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifyRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            <FiBell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                {unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.25rem))] max-w-[calc(100vw-1.25rem)] rounded-xl border border-slate-200 bg-white py-2 shadow-xl dark:border-slate-800 dark:bg-slate-950 animate-in fade-in slide-in-from-top-3 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 pb-2 dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-500 dark:text-teal-400"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">No notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n._id}
                      onClick={() => !n.read && handleMarkOneRead(n._id)}
                      className={`flex flex-col gap-1 border-b border-slate-100/50 px-4 py-3 hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-900/50 cursor-pointer ${
                        !n.read ? 'bg-teal-50/20 dark:bg-teal-500/5' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide">
                          {n.type}
                        </span>
                        <span className="text-[10px] text-slate-400">{getFormatTime(n.createdAt)}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug">{n.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Vertical divider */}
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>

        {/* User Profile Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-8 w-8 rounded-full object-cover border border-teal-500 shadow-sm"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-teal-600 border border-teal-500 flex items-center justify-center text-white font-semibold shadow-sm">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <span className="hidden text-sm font-semibold text-slate-700 dark:text-slate-200 md:block pr-1">
              {user?.name}
            </span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-2 shadow-xl dark:border-slate-800 dark:bg-slate-950 animate-in fade-in slide-in-from-top-3 duration-150">
              <div className="border-b border-slate-100 px-4 py-2 dark:border-slate-800">
                <p className="text-xs text-slate-400">Signed in as</p>
                <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-200">{user?.email}</p>
              </div>
              <Link
                to="/profile"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiSettings className="h-4 w-4" />
                Profile Settings
              </Link>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <FiLogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
