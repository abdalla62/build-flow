import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import {
  FiGrid,
  FiUsers,
  FiBriefcase,
  FiLayers,
  FiBox,
  FiTruck,
  FiClipboard,
  FiFileText,
  FiDollarSign,
  FiActivity,
  FiCheckSquare,
  FiSettings,
  FiLogOut
} from 'react-icons/fi';

const Sidebar = ({ collapsed }) => {
  const { user, logout } = useAuth();

  const getMenuLinks = () => {
    const role = user?.role;
    
    // Core routes present in dashboard
    const links = [{ path: '/', label: 'Dashboard', icon: FiGrid }];

    if (role === 'Administrator') {
      links.push(
        { path: '/users', label: 'Users', icon: FiUsers },
        { path: '/projects', label: 'Projects', icon: FiBriefcase },
        { path: '/materials', label: 'Materials', icon: FiBox },
        { path: '/categories', label: 'Categories', icon: FiLayers },
        { path: '/suppliers', label: 'Suppliers', icon: FiTruck },
        { path: '/material-requests', label: 'Material Requests', icon: FiClipboard },
        { path: '/quotations', label: 'Supplier Quotes', icon: FiLayers },
        { path: '/purchase-orders', label: 'Purchase Orders', icon: FiFileText },
        { path: '/deliveries', label: 'Deliveries', icon: FiTruck },
        { path: '/inventory', label: 'Inventory', icon: FiBox },
        { path: '/payments', label: 'Payments', icon: FiDollarSign },
        { path: '/reports', label: 'Reports', icon: FiFileText },
        { path: '/audit-logs', label: 'Audit Logs', icon: FiActivity }
      );
    } else if (role === 'Site Engineer') {
      links.push(
        { path: '/material-requests', label: 'Material Requests', icon: FiClipboard },
        { path: '/deliveries', label: 'Track Delivery', icon: FiTruck }
      );
    } else if (role === 'Project Manager') {
      links.push(
        { path: '/projects', label: 'Projects', icon: FiBriefcase },
        { path: '/material-requests', label: 'Review Requests', icon: FiCheckSquare }
      );
    } else if (role === 'Procurement Officer') {
      links.push(
        { path: '/material-requests', label: 'Material Requests', icon: FiClipboard },
        { path: '/quotations', label: 'Supplier Quotes', icon: FiLayers },
        { path: '/purchase-orders', label: 'Purchase Orders', icon: FiFileText },
        { path: '/deliveries', label: 'Schedule Delivery', icon: FiTruck },
        { path: '/reports', label: 'Reports', icon: FiFileText }
      );
    } else if (role === 'Supplier') {
      links.push(
        { path: '/purchase-orders', label: 'Purchase Orders', icon: FiFileText },
        { path: '/quotations', label: 'Quotes & Bids', icon: FiLayers },
        { path: '/purchase-orders', label: 'Invoices & POs', icon: FiDollarSign }
      );
    } else if (role === 'Accountant') {
      links.push(
        { path: '/purchase-orders', label: 'Purchase Orders', icon: FiFileText },
        { path: '/payments', label: 'Record Payments', icon: FiDollarSign }
      );
    } else if (role === 'Delivery Staff') {
      links.push(
        { path: '/deliveries', label: 'My Deliveries', icon: FiTruck }
      );
    }
    
    // Global profile
    links.push({ path: '/profile', label: 'Profile Settings', icon: FiSettings });

    return links;
  };

  const menuItems = getMenuLinks();

  return (
    <aside
      className={`fixed left-0 top-0 z-20 h-screen bg-[#0F172A] text-slate-400 transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      } flex flex-col border-r border-slate-800`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-center border-b border-slate-800 px-6">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white">
            <FiBox className="h-6 w-6 animate-pulse" />
          </div>
          {!collapsed && (
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-bold text-white tracking-wider whitespace-nowrap"
            >
              BUILD<span className="text-teal-400">FLOW</span>
            </motion.h1>
          )}
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-md shadow-teal-900/30'
                    : 'hover:bg-slate-800/60 hover:text-white'
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="border-t border-slate-800 p-4">
        {!collapsed && (
          <div className="mb-4 rounded-lg bg-slate-800/40 p-3 flex items-center gap-3 overflow-hidden">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-9 w-9 rounded-full object-cover border border-teal-500/40 shrink-0"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-teal-600/30 border border-teal-500/40 flex items-center justify-center text-teal-400 font-semibold shrink-0">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors duration-200"
        >
          <FiLogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
