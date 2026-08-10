import React from 'react';
import { FiChevronUp, FiChevronDown, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const Table = ({
  headers = [],
  data = [],
  loading = false,
  pagination = null,
  sorting = null,
  emptyMessage = 'No records found.'
}) => {
  const handleSort = (field, sortable) => {
    if (!sortable || !sorting) return;
    const isAsc = sorting.sortField === field && sorting.sortOrder === 'asc';
    sorting.onSort(field, isAsc ? 'desc' : 'asc');
  };

  return (
    <div className="w-full overflow-hidden rounded-card border border-brand-border bg-brand-card shadow-bf transition-colors duration-200 dark:border-brand-darkBorder dark:bg-brand-darkCard">
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-brand-muted dark:text-brand-darkMuted">
          <thead className="border-b border-brand-border bg-brand-bg text-xs font-bold uppercase tracking-wider text-brand-muted dark:border-brand-darkBorder dark:bg-brand-darkSecondary dark:text-brand-darkMuted">
            <tr>
              {headers.map((h) => (
                <th
                  key={h.key}
                  onClick={() => handleSort(h.key, h.sortable)}
                  className={`select-none px-6 py-4 font-semibold ${
                    h.sortable ? 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-white/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {h.label}
                    {h.sortable && sorting && sorting.sortField === h.key && (
                      sorting.sortOrder === 'asc' ? <FiChevronUp /> : <FiChevronDown />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-brand-border/70 dark:divide-brand-darkBorder/70">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  {headers.map((h, i) => (
                    <td key={i} className="px-6 py-4">
                      <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-6 py-12 text-center font-medium text-brand-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={row.id || row._id || idx}
                  className="transition-colors hover:bg-brand-bg/70 dark:hover:bg-white/[0.03]"
                >
                  {headers.map((h) => (
                    <td key={h.key} className="px-6 py-4 font-medium text-brand-text dark:text-slate-100">
                      {h.render ? h.render(row) : row[h.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-brand-border bg-brand-bg/50 px-6 py-4 text-brand-muted dark:border-brand-darkBorder dark:bg-brand-darkSecondary/60">
          <span className="text-xs">
            Page <strong>{pagination.currentPage}</strong> of <strong>{pagination.totalPages}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="rounded-xl border border-brand-border p-1.5 transition-colors hover:bg-brand-card disabled:opacity-40 dark:border-brand-darkBorder dark:hover:bg-white/5"
            >
              <FiChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              className="rounded-xl border border-brand-border p-1.5 transition-colors hover:bg-brand-card disabled:opacity-40 dark:border-brand-darkBorder dark:hover:bg-white/5"
            >
              <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;
