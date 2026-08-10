import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import Modal from '../components/UI/Modal';
import {
  FiFileText,
  FiActivity,
  FiBox,
  FiTruck,
  FiDollarSign,
  FiCheckCircle,
  FiAlertTriangle,
  FiClock,
  FiUsers,
  FiBriefcase,
  FiTrash2
} from 'react-icons/fi';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const pageVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 280, damping: 24 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 22 }
  }
};

const Dashboard = () => {
  const { user } = useAuth();
  const [paySummary, setPaySummary] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [adminCharts, setAdminCharts] = useState({
    spendTrends: [],
    categoryData: [],
    totalCategorySpend: 0
  });
  const [adminLoading, setAdminLoading] = useState(false);
  const [siteStats, setSiteStats] = useState(null);
  const [siteLoading, setSiteLoading] = useState(false);
  const [pmStats, setPmStats] = useState(null);
  const [pmLoading, setPmLoading] = useState(false);
  const [procStats, setProcStats] = useState(null);
  const [procLoading, setProcLoading] = useState(false);
  const [deliveryStats, setDeliveryStats] = useState(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState('');
  const [clearBusy, setClearBusy] = useState(false);

  const reloadAdminDashboard = () => {
    setAdminLoading(true);
    axios
      .get('/api/dashboard/admin')
      .then((res) => {
        if (res.data.success) {
          setAdminStats(res.data.stats);
          setAdminCharts({
            spendTrends: res.data.spendTrends || [],
            categoryData: res.data.categoryData || [],
            totalCategorySpend: res.data.totalCategorySpend || 0
          });
        }
      })
      .catch(() => {
        setAdminStats(null);
        setAdminCharts({ spendTrends: [], categoryData: [], totalCategorySpend: 0 });
      })
      .finally(() => setAdminLoading(false));
  };

  const handleClearPracticeData = async () => {
    if (clearConfirm.trim().toUpperCase() !== 'CLEAR') {
      toast.error('Type CLEAR to confirm');
      return;
    }
    setClearBusy(true);
    try {
      const res = await axios.post('/api/system/clear-demo-data', { confirm: 'CLEAR' });
      if (res.data.success) {
        toast.success(res.data.message || 'Practice data cleared');
        setClearOpen(false);
        setClearConfirm('');
        reloadAdminDashboard();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to clear practice data');
    } finally {
      setClearBusy(false);
    }
  };

  useEffect(() => {
    const role = user?.role;
    if (role === 'Administrator') {
      reloadAdminDashboard();
      return;
    }
    if (role === 'Site Engineer') {
      setSiteLoading(true);
      axios
        .get('/api/dashboard/site-engineer')
        .then((res) => {
          if (res.data.success) setSiteStats(res.data.stats);
        })
        .catch(() => setSiteStats(null))
        .finally(() => setSiteLoading(false));
      return;
    }
    if (role === 'Project Manager') {
      setPmLoading(true);
      axios
        .get('/api/dashboard/project-manager')
        .then((res) => {
          if (res.data.success) setPmStats(res.data.stats);
        })
        .catch(() => setPmStats(null))
        .finally(() => setPmLoading(false));
      return;
    }
    if (role === 'Procurement Officer') {
      setProcLoading(true);
      axios
        .get('/api/dashboard/procurement')
        .then((res) => {
          if (res.data.success) setProcStats(res.data.stats);
        })
        .catch(() => setProcStats(null))
        .finally(() => setProcLoading(false));
      return;
    }
    if (role === 'Delivery Staff') {
      setDeliveryLoading(true);
      axios
        .get('/api/dashboard/delivery-staff')
        .then((res) => {
          if (res.data.success) setDeliveryStats(res.data.stats);
        })
        .catch(() => setDeliveryStats(null))
        .finally(() => setDeliveryLoading(false));
      return;
    }
    if (!['Accountant', 'Supplier'].includes(role)) return;
    axios
      .get('/api/payments/summary')
      .then((res) => {
        if (res.data.success) setPaySummary(res.data.summary);
      })
      .catch(() => {});
  }, [user?.role]);

  const monthlyExpenditure = adminCharts.spendTrends;
  const categoryData = adminCharts.categoryData;
  const isAdmin = user?.role === 'Administrator';

  const getRoleStats = () => {
    const role = user?.role;
    if (role === 'Administrator') {
      const v = (n) => (adminLoading ? '…' : adminStats ? String(n ?? 0) : '—');
      return [
        { label: 'Total Users', value: v(adminStats?.totalUsers), icon: FiUsers, iconClass: 'bf-icon-users' },
        { label: 'Total Projects', value: v(adminStats?.totalProjects), icon: FiBriefcase, iconClass: 'bf-icon-projects' },
        { label: 'Total Materials', value: v(adminStats?.totalMaterials), icon: FiBox, iconClass: 'bf-icon-materials' },
        { label: 'Total Suppliers', value: v(adminStats?.totalSuppliers), icon: FiTruck, iconClass: 'bf-icon-suppliers' },
        { label: 'Total Purchase Orders', value: v(adminStats?.totalPurchaseOrders), icon: FiFileText, iconClass: 'bf-icon-orders' },
        { label: 'Total Deliveries', value: v(adminStats?.totalDeliveries), icon: FiCheckCircle, iconClass: 'bf-icon-deliveries' },
        { label: 'Total Payments', value: v(adminStats?.totalPayments), icon: FiDollarSign, iconClass: 'bf-icon-payments' }
      ];
    } else if (role === 'Site Engineer') {
      const v = (n) => (siteLoading ? '…' : siteStats ? String(n ?? 0) : '—');
      return [
        { label: 'My Requests', value: v(siteStats?.myRequests), icon: FiFileText, iconClass: 'bf-icon-users' },
        { label: 'Pending Requests', value: v(siteStats?.pendingRequests), icon: FiClock, iconClass: 'bf-icon-suppliers' },
        { label: 'Approved Requests', value: v(siteStats?.approvedRequests), icon: FiCheckCircle, iconClass: 'bf-icon-projects' },
        { label: 'Delivered Materials', value: v(siteStats?.deliveredMaterials), icon: FiTruck, iconClass: 'bf-icon-deliveries' }
      ];
    } else if (role === 'Project Manager') {
      const v = (n) => (pmLoading ? '…' : pmStats ? String(n ?? 0) : '—');
      const money = (n) =>
        pmLoading ? '…' : pmStats ? `$${Number(n ?? 0).toLocaleString()}` : '—';
      return [
        { label: 'Pending Requests', value: v(pmStats?.pendingRequests), icon: FiClock, iconClass: 'bf-icon-suppliers' },
        { label: 'Approved Requests', value: v(pmStats?.approvedRequests), icon: FiCheckCircle, iconClass: 'bf-icon-projects' },
        { label: 'Rejected Requests', value: v(pmStats?.rejectedRequests), icon: FiAlertTriangle, iconClass: 'bf-icon-payments' },
        { label: 'Budget Requests', value: money(pmStats?.budgetRequests), icon: FiDollarSign, iconClass: 'bf-icon-deliveries' }
      ];
    } else if (role === 'Procurement Officer') {
      const v = (n) => (procLoading ? '…' : procStats ? String(n ?? 0) : '—');
      return [
        { label: 'Approved Requests', value: v(procStats?.approvedRequests), icon: FiCheckCircle, iconClass: 'bf-icon-projects' },
        { label: 'Active Quotations', value: v(procStats?.activeQuotations), icon: FiFileText, iconClass: 'bf-icon-users' },
        { label: 'Draft POs', value: v(procStats?.draftPOs), icon: FiClock, iconClass: 'bf-icon-suppliers' },
        { label: 'Deliveries Scheduled', value: v(procStats?.deliveriesScheduled), icon: FiTruck, iconClass: 'bf-icon-materials' }
      ];
    } else if (role === 'Supplier') {
      return [
        { label: 'Open Unpaid POs', value: paySummary ? `${paySummary.unpaidCount}` : '—', icon: FiFileText, iconClass: 'bf-icon-projects' },
        { label: 'Payment Outstanding', value: paySummary ? `$${Number(paySummary.outstandingTotal).toLocaleString()}` : '—', icon: FiDollarSign, iconClass: 'bf-icon-materials' },
        { label: 'Paid This Month', value: paySummary ? `$${Number(paySummary.paidThisMonth).toLocaleString()}` : '—', icon: FiCheckCircle, iconClass: 'bf-icon-deliveries' },
        { label: 'Overdue', value: paySummary ? `${paySummary.overdueCount}` : '—', icon: FiAlertTriangle, iconClass: 'bf-icon-payments' }
      ];
    } else if (role === 'Accountant') {
      return [
        { label: 'Unpaid Invoices', value: paySummary ? `${paySummary.unpaidCount} items` : '—', icon: FiClock, iconClass: 'bf-icon-payments' },
        { label: 'Total Outstanding', value: paySummary ? `$${Number(paySummary.outstandingTotal).toLocaleString()}` : '—', icon: FiDollarSign, iconClass: 'bf-icon-suppliers' },
        { label: 'Total Paid (Month)', value: paySummary ? `$${Number(paySummary.paidThisMonth).toLocaleString()}` : '—', icon: FiCheckCircle, iconClass: 'bf-icon-deliveries' },
        { label: 'Overdue Payments', value: paySummary ? `${paySummary.overdueCount} invoices` : '—', icon: FiAlertTriangle, iconClass: 'bf-icon-payments' }
      ];
    } else if (role === 'Delivery Staff') {
      const assigned = deliveryStats?.assignedShipments ?? 0;
      const completed = deliveryStats?.completedDeliveries ?? 0;
      const delayed = deliveryStats?.delayedShipments ?? 0;
      return [
        {
          label: 'Assigned Shipments',
          value: deliveryLoading ? '…' : deliveryStats ? `${assigned} Pending` : '—',
          icon: FiTruck,
          iconClass: 'bf-icon-users'
        },
        {
          label: 'Completed Deliveries',
          value: deliveryLoading
            ? '…'
            : deliveryStats
              ? `${completed} successfully`
              : '—',
          icon: FiCheckCircle,
          iconClass: 'bf-icon-deliveries'
        },
        {
          label: 'Delayed Shipments',
          value: deliveryLoading
            ? '…'
            : deliveryStats
              ? `${delayed} alert${delayed === 1 ? '' : 's'}`
              : '—',
          icon: FiAlertTriangle,
          iconClass: 'bf-icon-suppliers'
        },
        {
          label: 'Active Route',
          value: deliveryLoading
            ? '…'
            : deliveryStats?.activeRoute || 'No active route',
          icon: FiActivity,
          iconClass: 'bf-icon-projects'
        }
      ];
    } else {
      return [
        { label: 'Welcome', value: '—', icon: FiActivity, iconClass: 'bf-icon-projects' }
      ];
    }
  };

  const stats = getRoleStats();
  const dashboardBg =
    user?.role === 'Project Manager'
      ? '/images/pm-dashboard-bg.png'
      : user?.role === 'Accountant'
        ? '/images/accountant-dashboard-bg.png'
        : user?.role === 'Supplier'
          ? '/images/supplier-dashboard-bg.png'
          : user?.role === 'Procurement Officer'
            ? '/images/procurement-dashboard-bg.png'
            : user?.role === 'Delivery Staff'
              ? '/images/delivery-dashboard-bg.png'
              : user?.role === 'Site Engineer'
                ? '/images/site-engineer-dashboard-bg.png'
                : '/images/dashboard-bg.png';

  return (
    <div className="relative -m-4 min-h-[calc(100vh-4rem)] overflow-hidden sm:-m-6 md:-m-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-cover bg-center brightness-[1.02] contrast-[1.04] saturate-[1.08] dark:brightness-[0.92] dark:contrast-[1.1] dark:saturate-[1.15]"
          style={{ backgroundImage: `url('${dashboardBg}')` }}
          initial={{ scale: 1.03 }}
          animate={{ scale: 1.08 }}
          transition={{ duration: 36, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }}
        />
        {/* Light: soft slate/teal wash — photo visible, not milky */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100/80 via-slate-200/55 to-teal-100/45 dark:hidden" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-bg/90 via-transparent to-slate-100/40 dark:hidden" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(15,157,148,0.14),_transparent_55%)] dark:hidden" />
        {/* Dark: keep cinematic depth */}
        <div className="absolute inset-0 hidden bg-gradient-to-br from-slate-950/80 via-teal-950/45 to-slate-950/55 dark:block" />
        <div className="absolute inset-0 hidden bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-slate-900/50 dark:block" />
        <div className="absolute inset-0 hidden bg-[radial-gradient(ellipse_at_top_right,_rgba(15,157,148,0.22),_transparent_50%)] dark:block" />
        <motion.div
          className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-brand-primary/20 blur-3xl dark:bg-brand-primary/25"
          animate={{ x: [0, 20, 0], y: [0, 14, 0], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-8 left-0 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-400/15"
          animate={{ x: [0, -14, 0], y: [0, -10, 0], opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        className="relative z-10 space-y-8 p-4 sm:p-6 md:p-8"
        variants={pageVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div
          variants={itemVariants}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <motion.h1
              className="text-3xl font-extrabold tracking-tight text-brand-text drop-shadow-sm dark:text-white"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              Dashboard
            </motion.h1>
            <motion.p
              className="mt-1 text-sm text-brand-muted dark:text-slate-300"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              Overview of procurement metrics and activities for{' '}
              <strong className="font-semibold text-brand-primary dark:text-teal-300">{user?.role}</strong>.
            </motion.p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <motion.button
                type="button"
                onClick={() => {
                  setClearConfirm('');
                  setClearOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-brand-danger shadow-bf-sm transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                <FiTrash2 />
                Clear practice data
              </motion.button>
            )}
            <motion.span
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-card/90 px-3 py-1.5 text-xs font-semibold text-brand-text shadow-bf-sm dark:border-brand-primary/30 dark:bg-brand-darkCard/80 dark:text-slate-100"
              whileHover={{ scale: 1.03, y: -1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            >
              <FiClock className="text-brand-primary" />
              Local Time: {new Date().toLocaleDateString()}
            </motion.span>
          </div>
        </motion.div>

        <motion.div
          className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${
            user?.role === 'Administrator' ? 'lg:grid-cols-4 xl:grid-cols-4' : 'lg:grid-cols-4'
          }`}
          variants={pageVariants}
        >
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                variants={cardVariants}
                whileHover={{
                  y: -4,
                  scale: 1.015,
                  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.1)'
                }}
                whileTap={{ scale: 0.99 }}
                className="bf-card p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-muted dark:text-brand-darkMuted">
                    {stat.label}
                  </span>
                  <motion.div
                    className={stat.iconClass}
                    whileHover={{ rotate: [0, -6, 6, 0], scale: 1.08 }}
                    transition={{ duration: 0.4 }}
                  >
                    <Icon className="h-5 w-5" />
                  </motion.div>
                </div>
                <motion.p
                  className="mt-4 text-2xl font-extrabold text-brand-text dark:text-white"
                  key={`${stat.label}-${stat.value}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  {stat.value}
                </motion.p>
              </motion.div>
            );
          })}
        </motion.div>

        {isAdmin && (
          <motion.div className="grid grid-cols-1 gap-6 lg:grid-cols-3" variants={pageVariants}>
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -3 }}
              className="bf-card p-6 lg:col-span-2"
            >
              <div className="mb-6">
                <h3 className="font-bold text-brand-text dark:text-white">Procurement expenditure</h3>
                <p className="text-xs text-brand-muted dark:text-brand-darkMuted">Real monthly PO totals from the system</p>
              </div>
              <motion.div
                className="h-72"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25, duration: 0.5 }}
              >
                {monthlyExpenditure.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm font-semibold text-brand-muted">
                    No purchase order spend data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyExpenditure} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorExpenditure" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0F9D94" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#0F9D94" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                      <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          border: 'none',
                          borderRadius: '12px',
                          color: '#fff'
                        }}
                        formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Spent']}
                      />
                      <Area
                        type="monotone"
                        dataKey="expenditure"
                        stroke="#0F9D94"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorExpenditure)"
                        name="Spent ($)"
                        isAnimationActive
                        animationDuration={1200}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </motion.div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              whileHover={{ y: -3 }}
              className="bf-card flex flex-col justify-between p-6"
            >
              <div>
                <h3 className="font-bold text-brand-text dark:text-white">Spend by Category</h3>
                <p className="text-xs text-brand-muted dark:text-brand-darkMuted">PO line totals grouped by stock category</p>
              </div>
              <motion.div
                className="relative my-4 flex h-44 items-center justify-center"
                initial={{ opacity: 0, rotate: -6 }}
                animate={{ opacity: 1, rotate: 0 }}
                transition={{ delay: 0.35, type: 'spring', stiffness: 200, damping: 20 }}
              >
                {categoryData.length === 0 ? (
                  <p className="text-sm font-semibold text-brand-muted">No category spend yet</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                          isAnimationActive
                          animationDuration={1100}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute flex flex-col items-center justify-center">
                      <span className="text-xl font-black text-brand-text dark:text-white">
                        ${Number(adminCharts.totalCategorySpend || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-brand-muted">Total spent</span>
                    </div>
                  </>
                )}
              </motion.div>
              <div className="space-y-1.5">
                {categoryData.map((item, i) => (
                  <motion.div
                    key={item.name}
                    className="flex items-center justify-between text-xs font-semibold text-brand-muted dark:text-brand-darkMuted"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 + i * 0.06 }}
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <span>${Number(item.value).toLocaleString()}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </motion.div>

      {isAdmin && (
        <Modal
          isOpen={clearOpen}
          onClose={() => {
            if (!clearBusy) {
              setClearOpen(false);
              setClearConfirm('');
            }
          }}
          title="Clear practice data"
        >
          <div className="space-y-4">
            <p className="text-sm text-brand-muted dark:text-brand-darkMuted">
              This deletes projects, materials, suppliers, requests, quotes, orders,
              deliveries, payments, inventory logs, notifications, and audit logs
              from the shared database (web + mobile).
            </p>
            <p className="text-sm font-semibold text-brand-text dark:text-slate-100">
              Users and roles will not be deleted.
            </p>
            <div>
              <label className="bf-label mb-1.5">Type CLEAR to confirm</label>
              <input
                type="text"
                value={clearConfirm}
                onChange={(e) => setClearConfirm(e.target.value)}
                className="bf-input"
                placeholder="CLEAR"
                disabled={clearBusy}
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={clearBusy}
                onClick={() => {
                  setClearOpen(false);
                  setClearConfirm('');
                }}
                className="rounded-xl border border-brand-border px-4 py-2.5 text-sm font-semibold text-brand-text hover:bg-brand-bg dark:border-brand-darkBorder dark:text-slate-200 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearBusy || clearConfirm.trim().toUpperCase() !== 'CLEAR'}
                onClick={handleClearPracticeData}
                className="bf-btn-danger disabled:opacity-50"
              >
                {clearBusy ? 'Clearing…' : 'Delete practice data'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Dashboard;
