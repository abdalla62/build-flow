import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
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
  FiBriefcase
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

  useEffect(() => {
    const role = user?.role;
    if (role === 'Administrator') {
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
        { label: 'Total Users', value: v(adminStats?.totalUsers), icon: FiUsers, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
        { label: 'Total Projects', value: v(adminStats?.totalProjects), icon: FiBriefcase, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40' },
        { label: 'Total Materials', value: v(adminStats?.totalMaterials), icon: FiBox, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' },
        { label: 'Total Suppliers', value: v(adminStats?.totalSuppliers), icon: FiTruck, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
        { label: 'Total Purchase Orders', value: v(adminStats?.totalPurchaseOrders), icon: FiFileText, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' },
        { label: 'Total Deliveries', value: v(adminStats?.totalDeliveries), icon: FiCheckCircle, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
        { label: 'Total Payments', value: v(adminStats?.totalPayments), icon: FiDollarSign, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40' }
      ];
    } else if (role === 'Site Engineer') {
      const v = (n) => (siteLoading ? '…' : siteStats ? String(n ?? 0) : '—');
      return [
        { label: 'My Requests', value: v(siteStats?.myRequests), icon: FiFileText, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
        { label: 'Pending Requests', value: v(siteStats?.pendingRequests), icon: FiClock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
        { label: 'Approved Requests', value: v(siteStats?.approvedRequests), icon: FiCheckCircle, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40' },
        { label: 'Delivered Materials', value: v(siteStats?.deliveredMaterials), icon: FiTruck, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' }
      ];
    } else if (role === 'Project Manager') {
      const v = (n) => (pmLoading ? '…' : pmStats ? String(n ?? 0) : '—');
      const money = (n) =>
        pmLoading ? '…' : pmStats ? `$${Number(n ?? 0).toLocaleString()}` : '—';
      return [
        { label: 'Pending Requests', value: v(pmStats?.pendingRequests), icon: FiClock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
        { label: 'Approved Requests', value: v(pmStats?.approvedRequests), icon: FiCheckCircle, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40' },
        { label: 'Rejected Requests', value: v(pmStats?.rejectedRequests), icon: FiAlertTriangle, color: 'text-red-600 bg-red-50 dark:bg-red-950/40' },
        { label: 'Budget Requests', value: money(pmStats?.budgetRequests), icon: FiDollarSign, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' }
      ];
    } else if (role === 'Procurement Officer') {
      const v = (n) => (procLoading ? '…' : procStats ? String(n ?? 0) : '—');
      return [
        { label: 'Approved Requests', value: v(procStats?.approvedRequests), icon: FiCheckCircle, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40' },
        { label: 'Active Quotations', value: v(procStats?.activeQuotations), icon: FiFileText, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
        { label: 'Draft POs', value: v(procStats?.draftPOs), icon: FiClock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
        { label: 'Deliveries Scheduled', value: v(procStats?.deliveriesScheduled), icon: FiTruck, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' }
      ];
    } else if (role === 'Supplier') {
      return [
        { label: 'Open Unpaid POs', value: paySummary ? `${paySummary.unpaidCount}` : '—', icon: FiFileText, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40' },
        { label: 'Payment Outstanding', value: paySummary ? `$${Number(paySummary.outstandingTotal).toLocaleString()}` : '—', icon: FiDollarSign, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' },
        { label: 'Paid This Month', value: paySummary ? `$${Number(paySummary.paidThisMonth).toLocaleString()}` : '—', icon: FiCheckCircle, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
        { label: 'Overdue', value: paySummary ? `${paySummary.overdueCount}` : '—', icon: FiAlertTriangle, color: 'text-red-600 bg-red-50 dark:bg-red-950/40' }
      ];
    } else if (role === 'Accountant') {
      return [
        { label: 'Unpaid Invoices', value: paySummary ? `${paySummary.unpaidCount} items` : '—', icon: FiClock, color: 'text-red-600 bg-red-50 dark:bg-red-950/40' },
        { label: 'Total Outstanding', value: paySummary ? `$${Number(paySummary.outstandingTotal).toLocaleString()}` : '—', icon: FiDollarSign, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
        { label: 'Total Paid (Month)', value: paySummary ? `$${Number(paySummary.paidThisMonth).toLocaleString()}` : '—', icon: FiCheckCircle, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
        { label: 'Overdue Payments', value: paySummary ? `${paySummary.overdueCount} invoices` : '—', icon: FiAlertTriangle, color: 'text-red-600 bg-red-50 dark:bg-red-950/40' }
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
          color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40'
        },
        {
          label: 'Completed Deliveries',
          value: deliveryLoading
            ? '…'
            : deliveryStats
              ? `${completed} successfully`
              : '—',
          icon: FiCheckCircle,
          color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
        },
        {
          label: 'Delayed Shipments',
          value: deliveryLoading
            ? '…'
            : deliveryStats
              ? `${delayed} alert${delayed === 1 ? '' : 's'}`
              : '—',
          icon: FiAlertTriangle,
          color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40'
        },
        {
          label: 'Active Route',
          value: deliveryLoading
            ? '…'
            : deliveryStats?.activeRoute || 'No active route',
          icon: FiActivity,
          color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40'
        }
      ];
    } else {
      return [
        { label: 'Welcome', value: '—', icon: FiActivity, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40' }
      ];
    }
  };

  const stats = getRoleStats();

  return (
    <div className="relative -m-6 md:-m-8 min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Atmospheric construction background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/dashboard-bg.png')" }}
          initial={{ scale: 1.05 }}
          animate={{ scale: 1.12 }}
          transition={{ duration: 28, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/55 via-slate-900/45 to-amber-950/40 dark:from-slate-950/75 dark:via-slate-950/70 dark:to-slate-900/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-100/90 via-slate-50/55 to-transparent dark:from-slate-950/90 dark:via-slate-950/50 dark:to-transparent" />
        <motion.div
          className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-500/10"
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 left-10 h-56 w-56 rounded-full bg-amber-300/15 blur-3xl dark:bg-amber-500/10"
          animate={{ x: [0, -20, 0], y: [0, -15, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        className="relative z-10 space-y-8 p-6 md:p-8"
        variants={pageVariants}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <motion.h1
              className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              Dashboard
            </motion.h1>
            <motion.p
              className="mt-1 text-sm text-slate-100/90 drop-shadow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              Overview of procurement metrics and activities for{' '}
              <strong className="font-semibold text-teal-300">{user?.role}</strong>.
            </motion.p>
          </div>
          <motion.span
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/20 px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-md"
            whileHover={{ scale: 1.04, y: -2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          >
            <motion.span
              animate={{ rotate: [0, 12, -12, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
            >
              <FiClock />
            </motion.span>
            Local Time: {new Date().toLocaleDateString()}
          </motion.span>
        </motion.div>

        {/* Metric cards */}
        <motion.div
          className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${
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
                  y: -6,
                  scale: 1.02,
                  boxShadow: '0 18px 40px -12px rgba(15, 23, 42, 0.18)'
                }}
                whileTap={{ scale: 0.98 }}
                className="rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/75"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {stat.label}
                  </span>
                  <motion.div
                    className={`rounded-xl p-2.5 ${stat.color}`}
                    whileHover={{ rotate: [0, -8, 8, 0], scale: 1.1 }}
                    transition={{ duration: 0.45 }}
                  >
                    <Icon className="h-5 w-5" />
                  </motion.div>
                </div>
                <motion.p
                  className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white"
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

        {/* Charts */}
        {isAdmin && (
          <motion.div className="grid grid-cols-1 gap-6 lg:grid-cols-3" variants={pageVariants}>
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -4 }}
              className="rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/75 lg:col-span-2"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Procurement expenditure</h3>
                  <p className="text-xs text-slate-400">Real monthly PO totals from the system</p>
                </div>
              </div>
              <motion.div
                className="h-72"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25, duration: 0.5 }}
              >
                {monthlyExpenditure.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">
                    No purchase order spend data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyExpenditure} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorExpenditure" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0F766E" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-slate-800" />
                      <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1E293B',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                        formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Spent']}
                      />
                      <Area
                        type="monotone"
                        dataKey="expenditure"
                        stroke="#0F766E"
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
              whileHover={{ y: -4 }}
              className="flex flex-col justify-between rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/75"
            >
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Spend by Category</h3>
                <p className="text-xs text-slate-400">PO line totals grouped by stock category</p>
              </div>
              <motion.div
                className="relative my-4 flex h-44 items-center justify-center"
                initial={{ opacity: 0, rotate: -6 }}
                animate={{ opacity: 1, rotate: 0 }}
                transition={{ delay: 0.35, type: 'spring', stiffness: 200, damping: 20 }}
              >
                {categoryData.length === 0 ? (
                  <p className="text-sm font-semibold text-slate-400">No category spend yet</p>
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
                      <span className="text-xl font-black text-slate-900 dark:text-white">
                        ${Number(adminCharts.totalCategorySpend || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-slate-400">Total spent</span>
                    </div>
                  </>
                )}
              </motion.div>
              <div className="space-y-1.5">
                {categoryData.map((item, i) => (
                  <motion.div
                    key={item.name}
                    className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400"
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
    </div>
  );
};

export default Dashboard;
