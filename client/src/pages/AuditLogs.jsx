import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Table from '../components/UI/Table';
import {
  FiActivity,
  FiSearch,
  FiUser,
  FiDownload,
  FiClock,
  FiLayers
} from 'react-icons/fi';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/audit', {
        params: {
          page: currentPage,
          search,
          action: actionFilter,
          role: roleFilter
        }
      });
      if (res.data.success) {
        setLogs(res.data.logs);
        setTotalPages(res.data.totalPages);
      }
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentPage, actionFilter, roleFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLogs();
  };

  // CSV Exporter logic
  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error('No audit records to export');
      return;
    }

    const headers = ['Timestamp', 'UserName', 'UserEmail', 'Role', 'Action', 'Details', 'IP Address', 'User Agent'];
    const rows = logs.map(log => [
      new Date(log.createdAt).toLocaleString(),
      log.userName,
      log.userEmail,
      log.role,
      `"${log.action.replace(/"/g, '""')}"`,
      `"${log.details.replace(/"/g, '""')}"`,
      log.ipAddress || 'Unknown',
      `"${(log.userAgent || 'Unknown').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audit logs spreadsheet downloaded!');
  };

  const headers = [
    { key: 'user', label: 'Operator details', render: (l) => (
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
          <FiUser className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-200 leading-snug">{l.userName}</p>
          <p className="text-xs text-slate-400">{l.userEmail}</p>
        </div>
      </div>
    )},
    { key: 'role', label: 'Account Role', render: (l) => (
      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-600 dark:bg-slate-850 dark:text-slate-400">
        {l.role}
      </span>
    )},
    { key: 'action', label: 'Operation Action', render: (l) => (
      <span className="font-bold text-slate-900 dark:text-white text-xs">
        {l.action}
      </span>
    )},
    { key: 'details', label: 'Audit Details', render: (l) => (
      <p className="text-xs text-slate-500 max-w-sm truncate" title={l.details}>
        {l.details}
      </p>
    )},
    { key: 'ipAddress', label: 'IP Address', render: (l) => (
      <span className="font-mono text-xs text-slate-400">{l.ipAddress || '127.0.0.1'}</span>
    )},
    { key: 'createdAt', label: 'Timestamp', render: (l) => (
      <span className="text-xs text-slate-500 flex items-center gap-1">
        <FiClock className="h-3.5 w-3.5" />
        {new Date(l.createdAt).toLocaleString()}
      </span>
    )}
  ];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Audit Security Logs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor system actions logs, trace staff adjustments, and audit authorization transaction events.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all shadow-sm self-start sm:self-auto"
        >
          <FiDownload /> Export CSV
        </button>
      </div>

      {/* Filter panel */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search email, details, or userName..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 outline-none focus:border-teal-500 focus:bg-white dark:bg-slate-950 text-sm transition-all"
          />
        </form>

        <div className="flex gap-3">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 outline-none text-sm focus:border-teal-500 focus:bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400"
          >
            <option value="">All Roles</option>
            <option value="Administrator">Administrator</option>
            <option value="Procurement Officer">Procurement Officer</option>
            <option value="Project Manager">Project Manager</option>
            <option value="Site Engineer">Site Engineer</option>
            <option value="Supplier">Supplier</option>
            <option value="Accountant">Accountant</option>
            <option value="Delivery Staff">Delivery Staff</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <Table
        headers={headers}
        data={logs}
        loading={loading}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: (p) => setCurrentPage(p)
        }}
      />

    </div>
  );
};

export default AuditLogs;
