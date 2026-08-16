import React from 'react';
import { NavLink } from 'react-router-dom';
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

const Sidebar = ({ collapsed, mobileOpen = false, onNavigate }) => {
  const { user, logout } = useAuth();

  const getMenuLinks = () => {
    const role = user?.role;

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
        { path: '/deliveries', label: 'Track Delivery', icon: FiTruck },
        { path: '/site-stock', label: 'Site Stock', icon: FiBox }
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
        { path: '/purchase-orders', label: 'Invoices & POs', icon: FiDollarSign },
        { path: '/reports', label: 'My Reports', icon: FiActivity }
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

    links.push({ path: '/profile', label: 'Profile Settings', icon: FiSettings });

    return links;
  };

  const menuItems = getMenuLinks();
  const showLabels = mobileOpen || !collapsed;

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-800 bg-brand-navy text-slate-400 transition-transform duration-300 md:transition-all ${
        showLabels ? 'w-64' : 'w-20'
      } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
    >
      <div className="flex h-16 items-center justify-center border-b border-slate-800/80 px-6">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary text-white shadow-bf-sm">
            <FiBox className="h-5 w-5" />
          </div>
          {showLabels && (
            <h1 className="whitespace-nowrap text-lg font-bold tracking-wider text-white">
              BUILD<span className="text-brand-primaryHover">FLOW</span>
            </h1>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={`${item.path}-${item.label}`}
              to={item.path}
              end={item.path === '/'}
              onClick={() => onNavigate?.()}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-brand-primary text-white shadow-bf-sm'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {showLabels && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-800/80 p-4">
        {showLabels && (
          <div className="mb-3 flex items-center gap-3 overflow-hidden rounded-xl bg-white/5 p-3">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-9 w-9 shrink-0 rounded-full border border-brand-primary/40 object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-primary/40 bg-brand-primary/20 text-sm font-semibold text-brand-primaryHover">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-rose-400 transition-colors hover:bg-rose-500/10"
        >
          <FiLogOut className="h-5 w-5 shrink-0" />
          {showLabels && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
