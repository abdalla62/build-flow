import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const DashboardLayout = () => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    localStorage.getItem('sidebarCollapsed') === 'true'
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const toggleSidebar = () => {
    // Phone / small tablet: open/close overlay drawer
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setMobileOpen((prev) => !prev);
      return;
    }
    // Desktop / large tablet: collapse rail
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-brand-bg transition-colors duration-200 dark:bg-brand-darkBg">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-brand-navy/50 md:hidden"
          onClick={closeMobile}
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileOpen}
        onNavigate={closeMobile}
      />

      <div
        className={`flex min-h-screen flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
        }`}
      >
        <Navbar toggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
