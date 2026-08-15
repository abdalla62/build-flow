import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import Table from '../components/UI/Table';
import Modal from '../components/UI/Modal';
import {
  FiBox,
  FiAlertTriangle,
  FiTrendingUp,
  FiTrendingDown,
  FiSettings
} from 'react-icons/fi';

const Inventory = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrator';

  const [materials, setMaterials] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loadingStock, setLoadingStock] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm();

  const fetchAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const res = await axios.get('/api/inventory/alerts');
      if (res.data.success) setAlerts(res.data.alerts);
    } catch (err) {
      console.error('Failed to load stock alerts:', err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  const fetchStockLevels = async () => {
    setLoadingStock(true);
    try {
      const res = await axios.get('/api/materials', { params: { limit: 100 } });
      if (res.data.success) setMaterials(res.data.materials);
    } catch (err) {
      toast.error('Failed to load stock levels');
    } finally {
      setLoadingStock(false);
    }
  };

  const fetchHistoryLedger = async () => {
    setLoadingHistory(true);
    try {
      const res = await axios.get('/api/inventory', { params: { page: currentPage } });
      if (res.data.success) {
        setHistoryLogs(res.data.logs);
        setTotalPages(res.data.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchProjectsList = async () => {
    try {
      const res = await axios.get('/api/projects', { params: { limit: 100 } });
      if (res.data.success) setProjects(res.data.projects);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchStockLevels();
  }, []);

  useEffect(() => {
    fetchHistoryLedger();
  }, [currentPage]);

  const handleOpenAdjust = () => {
    fetchProjectsList();
    reset({
      material: '',
      project: '',
      quantity: 1,
      type: 'Stock In',
      comments: ''
    });
    setIsAdjustOpen(true);
  };

  const onAdjustSubmit = async (data) => {
    if (formSubmitting) return;
    setFormSubmitting(true);
    try {
      const res = await axios.post('/api/inventory/adjust', data);
      if (res.data.success) {
        toast.success('Stock adjustment logged successfully!');
        setIsAdjustOpen(false);
        fetchAlerts();
        fetchStockLevels();
        fetchHistoryLedger();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to post adjustment');
    } finally {
      setFormSubmitting(false);
    }
  };

  const stockHeaders = [
    {
      key: 'name',
      label: 'Stock Name',
      render: (m) => (
        <div className="flex items-center gap-3">
          {m.image ? (
            <img
              src={m.image}
              alt={m.name}
              className="h-10 w-10 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <FiBox className="h-5 w-5" />
            </div>
          )}
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-200 leading-snug">{m.name}</p>
            <span className="inline-block px-2 py-0.5 mt-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 rounded">
              {m.category?.name}
            </span>
          </div>
        </div>
      )
    },
    {
      key: 'currentStock',
      label: 'In Stock Balance',
      render: (m) => {
        const isLow = m.currentStock <= m.minimumStock;
        return (
          <span className={`font-bold ${isLow ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
            {m.currentStock} {m.unit}
          </span>
        );
      }
    },
    {
      key: 'minimumStock',
      label: 'Replenishment Threshold',
      render: (m) => `${m.minimumStock} ${m.unit}`
    },
    {
      key: 'status',
      label: 'Alert Flag',
      render: (m) => {
        const isLow = m.currentStock <= m.minimumStock;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg ${
              isLow
                ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                : 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
            }`}
          >
            {isLow ? <FiAlertTriangle className="h-3.5 w-3.5" /> : null}
            {isLow ? 'Low Stock Warning' : 'Adequate'}
          </span>
        );
      }
    }
  ];

  const ledgerHeaders = [
    {
      key: 'type',
      label: 'Adjustment Type',
      render: (l) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg ${
            l.type === 'Stock In'
              ? 'bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/10 dark:text-brand-primaryHover'
              : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
          }`}
        >
          {l.type === 'Stock In' ? <FiTrendingUp /> : <FiTrendingDown />}
          {l.type}
        </span>
      )
    },
    {
      key: 'material',
      label: 'Material Details',
      render: (l) => (
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-200">{l.material?.name}</p>
          <p className="text-xs text-slate-400">
            Qty: {l.quantity} {l.material?.unit}
          </p>
        </div>
      )
    },
    {
      key: 'project',
      label: 'Project Site',
      render: (l) => (
        <span className="text-xs font-semibold">{l.project?.name || 'Central Depot'}</span>
      )
    },
    {
      key: 'referenceType',
      label: 'Ref Source',
      render: (l) => (
        <span className="text-xs text-slate-500 font-semibold uppercase">{l.referenceType}</span>
      )
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (l) => new Date(l.createdAt).toLocaleString()
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="bf-page-title">Inventory Controls</h1>
          <p className="bf-page-subtitle">
            View stock balances and post manual stock adjustments only. Add/edit products under Materials.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenAdjust}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primaryHover shadow-md transition-all self-start sm:self-auto"
          >
            <FiSettings className="h-5 w-5" />
            Stock Adjustment
          </button>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-red-500 flex items-center gap-1.5">
            <FiAlertTriangle className="animate-bounce" /> Low Stock Alerts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {alerts.map((alt) => (
              <div
                key={alt._id}
                className="p-4 border border-red-200 dark:border-red-950 bg-red-50/10 dark:bg-red-950/10 rounded-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {alt.image ? (
                    <img src={alt.image} alt={alt.name} className="h-10 w-10 rounded-lg object-cover" />
                  ) : null}
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100">{alt.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Supplier: {alt.supplier?.company}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-red-500">
                    {alt.currentStock} {alt.unit}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Limit: {alt.minimumStock} {alt.unit}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Catalog Stock Balances</h3>
        <Table headers={stockHeaders} data={materials} loading={loadingStock} />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Ledger Activity Log</h3>
        <Table
          headers={ledgerHeaders}
          data={historyLogs}
          loading={loadingHistory}
          pagination={{
            currentPage,
            totalPages,
            onPageChange: (p) => setCurrentPage(p)
          }}
        />
      </div>

      <Modal isOpen={isAdjustOpen} onClose={() => setIsAdjustOpen(false)} title="Post Stock Adjustment Log">
        <form onSubmit={handleSubmit(onAdjustSubmit)} className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Select Material Item</label>
            <select
              className={`w-full mt-1.5 px-4 py-2.5 border ${
                errors.material ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
              {...register('material', { required: 'Please select material' })}
            >
              <option value="">Select Material</option>
              {materials.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name} (Current: {m.currentStock} {m.unit})
                </option>
              ))}
            </select>
            {errors.material && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.material.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Adjustment Type</label>
              <select
                className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                {...register('type')}
              >
                <option value="Stock In">Stock In (+)</option>
                <option value="Stock Out">Stock Out (-)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">Project Site (Optional)</label>
              <select
                className="w-full mt-1.5 px-4 py-2.5 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                {...register('project')}
              >
                <option value="">Central Depot</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Adjustment Quantity</label>
            <input
              type="number"
              placeholder="1"
              className={`w-full mt-1.5 px-4 py-2.5 border ${
                errors.quantity ? 'border-red-500' : 'border-brand-border dark:border-brand-darkBorder'
              } bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary`}
              {...register('quantity', { required: 'Required', min: { value: 1, message: 'Must be at least 1' } })}
            />
            {errors.quantity && (
              <p className="mt-1 text-xs text-red-500 font-semibold">{errors.quantity.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase">Remarks / Reason</label>
            <textarea
              rows="3"
              placeholder="e.g. Audit correction, damages..."
              className="w-full mt-1.5 px-4 py-2 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
              {...register('comments')}
            />
          </div>

          <button
            type="submit"
            disabled={formSubmitting}
            className="w-full mt-4 bg-brand-primary hover:bg-brand-primaryHover text-white font-bold py-2.5 rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiSettings /> {formSubmitting ? 'Saving…' : 'Log Stock Adjustment'}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Inventory;
