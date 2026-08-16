import React, { useState, useLayoutEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Table from '../components/UI/Table';
import Modal from '../components/UI/Modal';
import { FiBox, FiMapPin, FiMinusCircle } from 'react-icons/fi';
import { pageCache } from '../utils/pageCache';

const SiteStock = () => {
  const [stocks, setStocks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [usageRow, setUsageRow] = useState(null);
  const [usageQty, setUsageQty] = useState('');
  const [usageNotes, setUsageNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchStock = async ({ soft = false } = {}) => {
    const key = `site-stock:${projectFilter || 'all'}`;
    const cached = pageCache.get(key);
    if (cached && !soft) {
      setStocks(cached.stocks || []);
      setProjects(cached.projects || []);
      setLoading(false);
    } else if (!cached?.stocks?.length) {
      setLoading(true);
    }

    try {
      const res = await axios.get('/api/inventory/project-stock', {
        params: projectFilter ? { projectId: projectFilter } : {}
      });
      if (res.data.success) {
        setStocks(res.data.stocks || []);
        setProjects(res.data.projects || []);
        pageCache.set(key, {
          stocks: res.data.stocks || [],
          projects: res.data.projects || []
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load site stock');
    } finally {
      setLoading(false);
    }
  };

  useLayoutEffect(() => {
    fetchStock();
  }, [projectFilter]);

  const openUsage = (row) => {
    setUsageRow(row);
    setUsageQty('');
    setUsageNotes('');
  };

  const closeUsage = () => {
    if (submitting) return;
    setUsageRow(null);
    setUsageQty('');
    setUsageNotes('');
  };

  const submitUsage = async (e) => {
    e.preventDefault();
    if (!usageRow || submitting) return;

    const qty = Number(usageQty);
    const onSite = Number(usageRow.quantity) || 0;
    if (!Number.isInteger(qty) || qty < 1) {
      toast.error('Enter a whole number of at least 1');
      return;
    }
    if (qty > onSite) {
      toast.error(`Only ${onSite} on site`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/inventory/site-usage', {
        project: usageRow.project?._id || usageRow.project,
        material: usageRow.material?._id || usageRow.material,
        quantity: qty,
        notes: usageNotes.trim() || undefined
      });
      if (res.data.success) {
        toast.success(
          res.data.message ||
            `Recorded ${qty} ${usageRow.material?.unit || ''} used`
        );
        setUsageRow(null);
        setUsageQty('');
        setUsageNotes('');
        pageCache.invalidate('site-stock:');
        fetchStock({ soft: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record usage');
    } finally {
      setSubmitting(false);
    }
  };

  const headers = [
    {
      key: 'project',
      label: 'Project / Site',
      render: (row) => (
        <div className="flex items-center gap-2">
          <FiMapPin className="h-4 w-4 text-brand-primary shrink-0" />
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {row.project?.name || '—'}
            </p>
            <p className="text-[11px] text-slate-400">{row.project?.location}</p>
          </div>
        </div>
      )
    },
    {
      key: 'material',
      label: 'Material',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            <FiBox className="h-4 w-4" />
          </div>
          <span className="font-semibold">{row.material?.name || '—'}</span>
        </div>
      )
    },
    {
      key: 'quantity',
      label: 'Quantity on site',
      render: (row) => (
        <span className="text-lg font-extrabold text-brand-primary">
          {row.quantity}{' '}
          <span className="text-sm font-semibold text-slate-500">
            {row.material?.unit || ''}
          </span>
        </span>
      )
    },
    {
      key: 'updated',
      label: 'Last updated',
      render: (row) =>
        row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) =>
        Number(row.quantity) > 0 ? (
          <button
            type="button"
            onClick={() => openUsage(row)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30 transition-colors"
            title="Record material used on site"
          >
            <FiMinusCircle className="h-4 w-4" />
            Record usage
          </button>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )
    }
  ];

  const unit = usageRow?.material?.unit || '';
  const onSite = Number(usageRow?.quantity) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Site Stock
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            See how much material is on each project site. Record usage when materials are used on site.
          </p>
        </div>
        {projects.length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">All my projects</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <Table
        headers={headers}
        data={stocks}
        loading={loading}
        emptyMessage="No site stock yet. Stock appears here when deliveries arrive at your project."
      />

      <Modal isOpen={!!usageRow} onClose={closeUsage} title="Record site usage">
        {usageRow && (
          <form onSubmit={submitUsage} className="space-y-4 py-1">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {usageRow.material?.name}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {usageRow.project?.name}
                {usageRow.project?.location ? ` · ${usageRow.project.location}` : ''}
              </p>
              <p className="mt-2 text-sm">
                On site:{' '}
                <span className="font-extrabold text-brand-primary">
                  {onSite} {unit}
                </span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">
                Quantity used
              </label>
              <input
                type="number"
                min={1}
                max={onSite}
                step={1}
                value={usageQty}
                onChange={(e) => setUsageQty(e.target.value)}
                placeholder={`e.g. 2 (of ${onSite})`}
                className="w-full mt-1.5 px-4 py-2 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
                required
                autoFocus
              />
              {usageQty && Number(usageQty) >= 1 && Number(usageQty) <= onSite && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Remaining after use:{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {onSite - Number(usageQty)} {unit}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase">
                Note (optional)
              </label>
              <input
                type="text"
                value={usageNotes}
                onChange={(e) => setUsageNotes(e.target.value)}
                maxLength={500}
                placeholder="e.g. Used on foundation pour"
                className="w-full mt-1.5 px-4 py-2 border border-brand-border dark:border-brand-darkBorder bg-slate-50 dark:bg-slate-950 rounded-xl text-sm outline-none focus:border-brand-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeUsage}
                disabled={submitting}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Confirm usage'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default SiteStock;
