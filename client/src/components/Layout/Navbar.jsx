import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiMenu, FiSun, FiMoon, FiBell, FiSearch, FiUser, FiLogOut, FiSettings } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { mediaUrl } from '../../utils/mediaUrl';

const Navbar = ({ toggleSidebar, sidebarCollapsed }) => {
  const { user, logout, theme, toggleTheme } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const profileRef = useRef(null);
  const bellRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState(null);

  const updateDropdownPos = () => {
    if (!bellRef.current) return;
    const rect = bellRef.current.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 20);
    const left = Math.max(10, Math.min(rect.right - width, window.innerWidth - width - 10));
    setDropdownPos({
      top: rect.bottom + 8,
      left,
      width
    });
  };

  useLayoutEffect(() => {
    if (!notificationsOpen) {
      setDropdownPos(null);
      return undefined;
    }
    updateDropdownPos();
    window.addEventListener('resize', updateDropdownPos);
    window.addEventListener('scroll', updateDropdownPos, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPos);
      window.removeEventListener('scroll', updateDropdownPos, true);
    };
  }, [notificationsOpen]);

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
      const inBell = bellRef.current?.contains(event.target);
      const inDropdown = dropdownRef.current?.contains(event.target);
      if (!inBell && !inDropdown) {
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
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-brand-border bg-brand-card/90 px-3 shadow-bf-sm backdrop-blur-md transition-colors duration-200 dark:border-brand-darkBorder dark:bg-brand-darkCard/90 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <button
          onClick={toggleSidebar}
          className="shrink-0 rounded-xl p-2 text-brand-muted transition-colors hover:bg-brand-bg dark:text-brand-darkMuted dark:hover:bg-white/5"
          aria-label="Toggle sidebar"
        >
          <FiMenu className="h-5 w-5" />
        </button>

        <div className="relative hidden sm:block">
          <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input
            type="text"
            placeholder="Search documents, materials..."
            className="w-64 rounded-xl border border-brand-border bg-brand-bg py-2 pl-10 pr-4 text-sm text-brand-text outline-none transition-all focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30 dark:border-brand-darkBorder dark:bg-brand-darkSecondary dark:text-slate-100 dark:focus:border-brand-primary"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="rounded-xl p-2 text-brand-muted transition-colors hover:bg-brand-bg dark:text-brand-darkMuted dark:hover:bg-white/5"
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {theme === 'dark' ? <FiSun className="h-5 w-5" /> : <FiMoon className="h-5 w-5" />}
        </button>

        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative rounded-xl p-2 text-brand-muted transition-colors hover:bg-brand-bg dark:text-brand-darkMuted dark:hover:bg-white/5"
            aria-expanded={notificationsOpen}
            aria-haspopup="true"
          >
            <FiBell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-danger text-[10px] font-bold text-white ring-2 ring-brand-card dark:ring-brand-darkCard">
                {unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen &&
            dropdownPos &&
            createPortal(
              <div
                ref={dropdownRef}
                style={{
                  position: 'fixed',
                  top: dropdownPos.top,
                  left: dropdownPos.left,
                  width: dropdownPos.width,
                  zIndex: 9999
                }}
                className="rounded-card border border-brand-border bg-brand-card py-2 shadow-bf-lg dark:border-brand-darkBorder dark:bg-brand-darkCard"
              >
                <div className="flex items-center justify-between border-b border-brand-border px-4 pb-2 dark:border-brand-darkBorder">
                  <span className="font-semibold text-brand-text dark:text-slate-200">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs font-semibold text-brand-primary hover:text-brand-primaryHover"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="py-8 text-center text-sm text-brand-muted">No notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n._id}
                        onClick={() => !n.read && handleMarkOneRead(n._id)}
                        className={`flex cursor-pointer flex-col gap-1 border-b border-brand-border/60 px-4 py-3 hover:bg-brand-bg dark:border-brand-darkBorder/60 dark:hover:bg-white/5 ${
                          !n.read ? 'bg-brand-primary/5 dark:bg-brand-primary/10' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-brand-primary">
                            {n.type}
                          </span>
                          <span className="text-[10px] text-brand-muted">{getFormatTime(n.createdAt)}</span>
                        </div>
                        <h4 className="text-sm font-bold leading-snug text-brand-text dark:text-slate-200">{n.title}</h4>
                        <p className="text-xs leading-relaxed text-brand-muted dark:text-brand-darkMuted">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>,
              document.body
            )}
        </div>

        <div className="h-6 w-px bg-brand-border dark:bg-brand-darkBorder" />

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-brand-bg dark:hover:bg-white/5"
          >
            {user?.avatar ? (
              <img
                src={mediaUrl(user.avatar)}
                alt={user.name}
                className="h-8 w-8 rounded-full border border-brand-primary/40 object-cover shadow-bf-sm"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-primary/40 bg-brand-primary text-sm font-semibold text-white shadow-bf-sm">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <span className="hidden pr-1 text-sm font-semibold text-brand-text dark:text-slate-200 md:block">
              {user?.name}
            </span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-card border border-brand-border bg-brand-card py-2 shadow-bf dark:border-brand-darkBorder dark:bg-brand-darkCard">
              <div className="border-b border-brand-border px-4 py-2 dark:border-brand-darkBorder">
                <p className="text-xs text-brand-muted">Signed in as</p>
                <p className="truncate text-sm font-bold text-brand-text dark:text-slate-200">{user?.email}</p>
              </div>
              <Link
                to="/profile"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-brand-text hover:bg-brand-bg dark:text-slate-300 dark:hover:bg-white/5"
              >
                <FiSettings className="h-4 w-4" />
                Profile Settings
              </Link>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-brand-danger hover:bg-rose-50 dark:hover:bg-rose-950/20"
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
