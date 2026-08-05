import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  FiDownload,
  FiFileText,
  FiDollarSign,
  FiTruck,
  FiAlertCircle,
  FiPackage,
  FiCalendar
} from 'react-icons/fi';
import { downloadExcel } from '../utils/exportExcel';
import { downloadPdf } from '../utils/exportPdf';

const REPORT_META = [
  {
    id: 'monthlyProcurement',
    label: 'Monthly Procurement',
    icon: FiFileText,
    hintKey: 'procurementValue',
    hintPrefix: 'Value: $'
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

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const Reports = () => {
  const [reports, setReports] = useState({});
  const [month, setMonth] = useState(currentMonthValue);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('monthlyProcurement');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/reports', { params: { month } });
      if (res.data.success) {
        setReports(res.data.reports || {});
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [month]);

  const active = reports[activeTab];
  const day = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const exportExcel = () => {
    if (!active?.headers?.length) {
      toast.error('No report data to export');
      return;
    }
    try {
      downloadExcel(
        `${activeTab}_${month}_${day}.xlsx`,
        active.headers,
        (active.rows || []).map((row) => row.map(formatCell)),
        active.title || 'Report',
        {
          title: active.title || 'Report',
          subtitle: active.description || `Period: ${month}`
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
        `${activeTab}_${month}_${day}.pdf`,
        active.title || 'Report',
        active.headers,
        active.rows || [],
        active.description || `Period: ${month}`
      );
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to export PDF');
    }
  };

  const Empty = ({ text }) => (
    <p className="py-16 text-center text-sm font-semibold text-slate-400">{text}</p>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            Export Reports
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Monthly procurement, supplier payments, delivery schedule,
            outstanding balances, and material usage (PDF / Excel).
          </p>
        </div>
        <div className="flex flex-nowrap items-center gap-2 shrink-0">
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm shrink-0">
            <FiCalendar className="text-slate-400" />
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-transparent outline-none text-slate-700 dark:text-slate-200"
            />
          </label>
          <div className="inline-flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={exportExcel}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 shadow-md whitespace-nowrap"
            >
              <FiDownload /> Excel
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="inline-flex items-center gap-2 rounded-xl border border-teal-700 text-teal-700 dark:text-teal-400 dark:border-teal-600 px-4 py-2.5 text-sm font-semibold hover:bg-teal-50 dark:hover:bg-teal-950/30 whitespace-nowrap"
            >
              <FiDownload /> PDF
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {REPORT_META.map((t) => {
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
                  ? 'border-teal-500 bg-teal-50/80 dark:bg-teal-950/30 shadow-md'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-400/60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`p-2.5 rounded-xl ${
                    activeCard
                      ? 'bg-teal-600 text-white'
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

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm">
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
                    <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
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
