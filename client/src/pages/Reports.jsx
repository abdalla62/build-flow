import React, { useState, useEffect, useMemo, useLayoutEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  FiDownload,
  FiFileText,
  FiDollarSign,
  FiTruck,
  FiAlertCircle,
  FiPackage,
  FiCalendar,
  FiLayers,
  FiClipboard,
  FiBox,
  FiBriefcase,
  FiBook,
  FiXCircle,
  FiBarChart2
} from 'react-icons/fi';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { downloadExcel, downloadExcelWorkbook } from '../utils/exportExcel';
import { downloadPdf, downloadPdfBundle } from '../utils/exportPdf';
import { pageCache } from '../utils/pageCache';

const ADMIN_REPORT_META = [
  {
    id: 'monthlyProcurement',
    label: 'Monthly Procurement',
    icon: FiFileText,
    hintKey: 'procurementValue',
    hintPrefix: 'Value: $'
  },
  {
    id: 'materialRequests',
    label: 'Material Requests',
    icon: FiClipboard,
    hintKey: 'requestCount',
    hintPrefix: 'Requests: '
  },
  {
    id: 'projectBudget',
    label: 'Project Budget',
    icon: FiBriefcase,
    hintKey: 'totalRemaining',
    hintPrefix: 'Remaining: $'
  },
  {
    id: 'siteStock',
    label: 'Site Stock',
    icon: FiBox,
    hintKey: 'lineCount',
    hintPrefix: 'Lines: '
  },
  {
    id: 'supplierPayments',
    label: 'Supplier Payments',
    icon: FiDollarSign,
    hintKey: 'totalPaid',
    hintPrefix: 'Paid: $'
  },
  {
    id: 'deliverySchedule',
    label: 'Delivery Schedule',
    icon: FiTruck,
    hintKey: 'deliveryCount',
    hintPrefix: 'Shipments: '
  },
  {
    id: 'outstandingBalance',
    label: 'Outstanding Balance',
    icon: FiAlertCircle,
    hintKey: 'totalOutstanding',
    hintPrefix: 'Outstanding: $'
  },
  {
    id: 'materialUsage',
    label: 'Material Usage',
    icon: FiPackage,
    hintKey: 'totalQtyOut',
    hintPrefix: 'Qty out: '
  },
  {
    id: 'quotationBidding',
    label: 'Quotation & Bidding',
    icon: FiLayers,
    hintKey: 'bidCount',
    hintPrefix: 'Bids: '
  },
  {
    id: 'damagedMissing',
    label: 'Damaged & Missing',
    icon: FiAlertCircle,
    hintKey: 'issueCount',
    hintPrefix: 'Issues: '
  },
  {
    id: 'supplierPerformance',
    label: 'Supplier Performance',
    icon: FiLayers,
    hintKey: 'supplierCount',
    hintPrefix: 'Suppliers: '
  },
  {
    id: 'inventoryLedger',
    label: 'Inventory Ledger',
    icon: FiBook,
    hintKey: 'movementCount',
    hintPrefix: 'Movements: '
  },
  {
    id: 'taxSummary',
    label: 'Tax Summary',
    icon: FiFileText,
    hintKey: 'totalTax',
    hintPrefix: 'Tax: $'
  },
  {
    id: 'supplierDecline',
    label: 'Supplier Declines',
    icon: FiXCircle,
    hintKey: 'declineCount',
    hintPrefix: 'Declines: '
  }
];

const PM_REPORT_META = [
  {
    id: 'myMaterialRequests',
    label: 'My Requests',
    icon: FiClipboard,
    hintKey: 'requestCount',
    hintPrefix: 'Requests: '
  },
  {
    id: 'myProjectBudget',
    label: 'My Budget',
    icon: FiBriefcase,
    hintKey: 'totalRemaining',
    hintPrefix: 'Remaining: $'
  },
  {
    id: 'myDeliveries',
    label: 'My Deliveries',
    icon: FiTruck,
    hintKey: 'deliveryCount',
    hintPrefix: 'Shipments: '
  },
  {
    id: 'myMaterialUsage',
    label: 'Site Usage',
    icon: FiPackage,
    hintKey: 'totalQtyOut',
    hintPrefix: 'Qty out: '
  },
  {
    id: 'damagedMissing',
    label: 'Damaged & Missing',
    icon: FiAlertCircle,
    hintKey: 'issueCount',
    hintPrefix: 'Issues: '
  }
];

const ACCOUNTANT_REPORT_META = [
  {
    id: 'paymentSummary',
    label: 'Payments',
    icon: FiDollarSign,
    hintKey: 'totalPaid',
    hintPrefix: 'Paid: $'
  },
  {
    id: 'outstandingBySupplier',
    label: 'Outstanding by Supplier',
    icon: FiAlertCircle,
    hintKey: 'supplierCount',
    hintPrefix: 'Suppliers: '
  },
  {
    id: 'taxSummary',
    label: 'Tax Summary',
    icon: FiFileText,
    hintKey: 'totalTax',
    hintPrefix: 'Tax: $'
  },
  {
    id: 'poFinancials',
    label: 'PO Financials',
    icon: FiClipboard,
    hintKey: 'poCount',
    hintPrefix: 'POs: '
  }
];

const SUPPLIER_REPORT_META = [
  {
    id: 'myBids',
    label: 'My Bids',
    icon: FiLayers,
    hintKey: 'pending',
    hintPrefix: 'Pending: '
  },
  {
    id: 'myOrders',
    label: 'My Purchase Orders',
    icon: FiClipboard,
    hintKey: 'orderValue',
    hintPrefix: 'Value: $'
  },
  {
    id: 'myPayments',
    label: 'Payments Received',
    icon: FiDollarSign,
    hintKey: 'totalPaid',
    hintPrefix: 'Paid: $'
  },
  {
    id: 'outstandingBalance',
    label: 'Outstanding Balance',
    icon: FiAlertCircle,
    hintKey: 'totalOutstanding',
    hintPrefix: 'Outstanding: $'
  },
  {
    id: 'myPerformance',
    label: 'My Performance',
    icon: FiClipboard,
    hintKey: 'completedOrders',
    hintPrefix: 'Completed: '
  }
];

function formatCell(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? String(v) : Number(v).toFixed(2);
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
  }
  return s;
}

const CHART_COLORS = ['#0d9488', '#0891b2', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6'];

function ReportCharts({ charts, role }) {
  if (!charts || typeof charts !== 'object') return null;

  const stockMovement = charts.stockMovement || [];
  const requestsByStatus = charts.requestsByStatus || [];
  const procurementByProject = charts.procurementByProject || [];
  const paymentsByMethod = charts.paymentsByMethod || [];
  const declinesBySupplier = charts.declinesBySupplier || [];
  const budgetUsage = charts.budgetUsage || [];
  const taxVsTotal = charts.taxVsTotal || [];

  const hasAdminCharts =
    stockMovement.length ||
    requestsByStatus.length ||
    procurementByProject.length ||
    paymentsByMethod.length ||
    declinesBySupplier.length;
  const hasPMCharts = requestsByStatus.length || budgetUsage.length;
  const hasAccountantCharts = paymentsByMethod.length || taxVsTotal.length;

  if (
    (role === 'Administrator' || role === 'Procurement Officer') &&
    !hasAdminCharts
  ) {
    return null;
  }
  if (role === 'Project Manager' && !hasPMCharts) return null;
  if (role === 'Accountant' && !hasAccountantCharts) return null;

  return (
    <div className="bg-brand-card dark:bg-brand-darkCard border border-brand-border dark:border-brand-darkBorder rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">
      <div className="flex items-center gap-2">
        <FiBarChart2 className="text-brand-primary" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Charts</h2>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {(role === 'Administrator' || role === 'Procurement Officer') && (
          <>
            {stockMovement.length > 0 && (
              <ChartCard title="Stock In vs Out (qty)">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stockMovement}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0d9488" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {requestsByStatus.length > 0 && (
              <ChartCard title="Requests by status">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={requestsByStatus}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ label, value }) => `${label}: ${value}`}
                    >
                      {requestsByStatus.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {procurementByProject.length > 0 && (
              <ChartCard title="Procurement by project ($)">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={procurementByProject} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {declinesBySupplier.length > 0 && (
              <ChartCard title="Declines by supplier">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={declinesBySupplier}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </>
        )}
        {role === 'Project Manager' && budgetUsage.length > 0 && (
          <ChartCard title="Budget used vs remaining ($)">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={budgetUsage}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0891b2" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        {(role === 'Administrator' ||
          role === 'Procurement Officer' ||
          role === 'Accountant') &&
          paymentsByMethod.length > 0 && (
            <ChartCard title="Payments by method ($)">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={paymentsByMethod}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        {role === 'Accountant' && taxVsTotal.length > 0 && (
          <ChartCard title="Tax vs grand total ($)">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={taxVsTotal}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl border border-brand-border dark:border-brand-darkBorder p-4 bg-slate-50/50 dark:bg-slate-900/30">
      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">{title}</p>
      {children}
    </div>
  );
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function defaultTabForRole(role) {
  if (role === 'Supplier') return 'myBids';
  if (role === 'Project Manager') return 'myMaterialRequests';
  if (role === 'Accountant') return 'paymentSummary';
  return 'monthlyProcurement';
}

function reportUrlForRole(role) {
  if (role === 'Supplier') return '/api/reports/supplier';
  if (role === 'Project Manager') return '/api/reports/pm';
  if (role === 'Accountant') return '/api/reports/accountant';
  return '/api/reports';
}

function reportMetaForRole(role) {
  if (role === 'Supplier') return SUPPLIER_REPORT_META;
  if (role === 'Project Manager') return PM_REPORT_META;
  if (role === 'Accountant') return ACCOUNTANT_REPORT_META;
  return ADMIN_REPORT_META;
}

const Reports = () => {
  const { user } = useAuth();
  const role = user?.role;
  const isSupplierView = role === 'Supplier';
  const isPMView = role === 'Project Manager';
  const isAccountantView = role === 'Accountant';
  const reportMeta = reportMetaForRole(role);

  const [reports, setReports] = useState({});
  const [charts, setCharts] = useState(null);
  const [company, setCompany] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [dateMode, setDateMode] = useState('month');
  const [month, setMonth] = useState(currentMonthValue);
  const [fromDate, setFromDate] = useState(monthStartValue);
  const [toDate, setToDate] = useState(todayValue);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(defaultTabForRole(role));

  useEffect(() => {
    setActiveTab(defaultTabForRole(role));
  }, [role]);

  const queryParams = useMemo(() => {
    if (dateMode === 'range') {
      return { from: fromDate, to: toDate };
    }
    return { month };
  }, [dateMode, month, fromDate, toDate]);

  const cacheKey = useMemo(() => {
    const base = `reports:${role || 'admin'}:${dateMode === 'range' ? `${fromDate}:${toDate}` : month}`;
    return base;
  }, [role, dateMode, month, fromDate, toDate]);

  const fetchReports = async ({ soft = false } = {}) => {
    const cached = pageCache.get(cacheKey);
    if (cached && !soft) {
      setReports(cached.reports || {});
      setCharts(cached.charts || null);
      setCompany(cached.company || '');
      setPeriodLabel(cached.periodLabel || '');
      setLoading(false);
    } else if (!cached) {
      setLoading(true);
    }

    try {
      const url = reportUrlForRole(role);
      const res = await axios.get(url, { params: queryParams });
      if (res.data.success) {
        const label =
          res.data.period?.label ||
          res.data.month ||
          (dateMode === 'range' ? `${fromDate} → ${toDate}` : month);
        setReports(res.data.reports || {});
        setCharts(res.data.charts || null);
        setCompany(res.data.company || '');
        setPeriodLabel(label);
        pageCache.set(cacheKey, {
          reports: res.data.reports || {},
          charts: res.data.charts || null,
          company: res.data.company || '',
          periodLabel: label
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useLayoutEffect(() => {
    fetchReports();
  }, [cacheKey, role]);

  const active = reports[activeTab];
  const day = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const exportPeriod = periodLabel || (dateMode === 'range' ? `${fromDate}_${toDate}` : month);

  const collectExportSections = () =>
    reportMeta
      .map((t) => {
        const r = reports[t.id];
        if (!r?.headers?.length) return null;
        return {
          id: t.id,
          sheetName: t.label,
          title: r.title || t.label,
          subtitle: r.description || `Period: ${exportPeriod}`,
          headers: r.headers,
          rows: (r.rows || []).map((row) => row.map(formatCell))
        };
      })
      .filter(Boolean);

  const exportExcel = () => {
    if (!active?.headers?.length) {
      toast.error('No report data to export');
      return;
    }
    try {
      downloadExcel(
        `${activeTab}_${exportPeriod}_${day}.xlsx`,
        active.headers,
        (active.rows || []).map((row) => row.map(formatCell)),
        active.title || 'Report',
        {
          title: active.title || 'Report',
          subtitle: active.description || `Period: ${exportPeriod}`
        }
      );
      toast.success('Excel downloaded');
    } catch {
      toast.error('Failed to export Excel');
    }
  };

  const exportPdf = () => {
    if (!active?.headers?.length) {
      toast.error('No report data to export');
      return;
    }
    try {
      downloadPdf(
        `${activeTab}_${exportPeriod}_${day}.pdf`,
        active.title || 'Report',
        active.headers,
        active.rows || [],
        active.description || `Period: ${exportPeriod}`
      );
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to export PDF');
    }
  };

  const exportAllExcel = () => {
    const sheets = collectExportSections();
    if (!sheets.length) {
      toast.error('No report data to export');
      return;
    }
    try {
      downloadExcelWorkbook(`all_reports_${exportPeriod}_${day}.xlsx`, sheets);
      toast.success(`Excel downloaded (${sheets.length} reports)`);
    } catch {
      toast.error('Failed to export all reports');
    }
  };

  const exportAllPdf = () => {
    const sections = collectExportSections();
    if (!sections.length) {
      toast.error('No report data to export');
      return;
    }
    try {
      downloadPdfBundle(
        `all_reports_${exportPeriod}_${day}.pdf`,
        isSupplierView
          ? 'My Activity — All Reports'
          : isPMView
            ? 'My Project Reports — All'
            : isAccountantView
              ? 'Financial Reports — All'
              : 'BuildFlow — All Reports',
        `Period: ${exportPeriod} · ${sections.length} reports`,
        sections
      );
      toast.success(`PDF downloaded (${sections.length} reports)`);
    } catch {
      toast.error('Failed to export all reports');
    }
  };

  const Empty = ({ text }) => (
    <p className="py-16 text-center text-sm font-semibold text-slate-400">{text}</p>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="bf-page-title">
            {isSupplierView
              ? 'My Activity Report'
              : isPMView
                ? 'My Project Reports'
                : isAccountantView
                  ? 'Financial Reports'
                  : 'Export Reports'}
          </h1>
          <p className="bf-page-subtitle">
            {isSupplierView
              ? `Review bids, purchase orders, and payments${company ? ` for ${company}` : ''} (PDF / Excel).`
              : isPMView
                ? 'Requests, budget, deliveries, site usage and receipt issues on your projects (PDF / Excel).'
                : isAccountantView
                  ? 'Payments, outstanding balances, tax and PO financials (PDF / Excel).'
                  : 'Procurement, requests, budget, bidding, site stock, payments & more (PDF / Excel).'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 shrink-0">
          <select
            value={dateMode}
            onChange={(e) => setDateMode(e.target.value)}
            className="rounded-xl border border-brand-border dark:border-brand-darkBorder bg-brand-card dark:bg-brand-darkCard px-3 py-2 text-sm"
          >
            <option value="month">By month</option>
            <option value="range">Custom range</option>
          </select>
          {dateMode === 'month' ? (
            <label className="inline-flex items-center gap-2 rounded-xl border border-brand-border dark:border-brand-darkBorder bg-brand-card dark:bg-brand-darkCard px-3 py-2 text-sm shrink-0">
              <FiCalendar className="text-slate-400" />
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-transparent outline-none text-slate-700 dark:text-slate-200"
              />
            </label>
          ) : (
            <div className="inline-flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-xl border border-brand-border dark:border-brand-darkBorder bg-brand-card dark:bg-brand-darkCard px-3 py-2 text-sm">
                <span className="text-xs text-slate-400">From</span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent outline-none text-slate-700 dark:text-slate-200"
                />
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-brand-border dark:border-brand-darkBorder bg-brand-card dark:bg-brand-darkCard px-3 py-2 text-sm">
                <span className="text-xs text-slate-400">To</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent outline-none text-slate-700 dark:text-slate-200"
                />
              </label>
            </div>
          )}
          <div className="inline-flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={exportExcel}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primaryHover shadow-md whitespace-nowrap"
            >
              <FiDownload /> Excel
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="inline-flex items-center gap-2 rounded-xl border border-teal-700 text-brand-primary dark:text-brand-primaryHover dark:border-teal-600 px-4 py-2.5 text-sm font-semibold hover:bg-teal-50 dark:hover:bg-teal-950/30 whitespace-nowrap"
            >
              <FiDownload /> PDF
            </button>
            <button
              type="button"
              onClick={exportAllExcel}
              title="Download every report in one Excel file (one sheet each)"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 dark:bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 whitespace-nowrap"
            >
              <FiDownload /> All Excel
            </button>
            <button
              type="button"
              onClick={exportAllPdf}
              title="Download every report in one PDF"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-400 dark:border-slate-500 text-slate-700 dark:text-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <FiDownload /> All PDF
            </button>
          </div>
        </div>
      </div>

      {periodLabel && (
        <p className="text-xs font-semibold text-slate-500">
          Period: <span className="text-brand-primary">{periodLabel}</span>
        </p>
      )}

      <ReportCharts charts={charts} role={role} />

      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-3`}
      >
        {reportMeta.map((t) => {
          const Icon = t.icon;
          const report = reports[t.id];
          const activeCard = activeTab === t.id;
          const hintVal = report?.summary?.[t.hintKey];
          const hint =
            hintVal != null
              ? `${t.hintPrefix}${
                  typeof hintVal === 'number' && t.hintPrefix.includes('$')
                    ? Number(hintVal).toLocaleString()
                    : hintVal
                }`
              : report?.description || '—';

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`text-left rounded-2xl border p-5 transition-all ${
                activeCard
                  ? 'border-brand-primary bg-teal-50/80 dark:bg-brand-primary/10 shadow-md'
                  : 'border-brand-border dark:border-brand-darkBorder bg-brand-card dark:bg-brand-darkCard hover:border-teal-400/60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`p-2.5 rounded-xl ${
                    activeCard
                      ? 'bg-brand-primary text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {report?.count ?? '—'}
                </span>
              </div>
              <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">
                {t.label}
              </p>
              <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 min-h-[2rem]">
                {hint}
              </p>
            </button>
          );
        })}
      </div>

      <div className="bg-brand-card dark:bg-brand-darkCard border border-brand-border dark:border-brand-darkBorder rounded-2xl p-4 sm:p-6 shadow-sm">
        {loading ? (
          <p className="py-16 text-center text-sm font-semibold text-slate-400">
            Loading reports…
          </p>
        ) : !active ? (
          <Empty text="Report not available" />
        ) : (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {active.title}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{active.description}</p>
            </div>
            {!active.rows?.length ? (
              <Empty text="No rows for this period" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-brand-border dark:border-brand-darkBorder">
                      {active.headers.map((h) => (
                        <th key={h} className="py-3 px-3 font-bold whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {active.rows.map((row, idx) => (
                      <tr key={idx} className="text-slate-700 dark:text-slate-300">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="py-2.5 px-3 text-xs whitespace-nowrap">
                            {formatCell(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
