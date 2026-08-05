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
    <div className="w-full overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm transition-colors duration-200">
      
      {/* Scrollable Container */}
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-slate-600 dark:text-slate-400">
          
          {/* Table Header */}
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-850">
            <tr>
              {headers.map((h) => (
                <th
                  key={h.key}
                  onClick={() => handleSort(h.key, h.sortable)}
                  className={`px-6 py-4 font-semibold select-none ${
                    h.sortable ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800' : ''
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

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {loading ? (
              // Loading skeletons
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  {headers.map((h, i) => (
                    <td key={i} className="px-6 py-4">
                      <div className="h-4 rounded bg-slate-200 dark:bg-slate-800 w-2/3"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-6 py-12 text-center text-slate-400 font-medium">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={row.id || row._id || idx}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                >
                  {headers.map((h) => (
                    <td key={h.key} className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                      {h.render ? h.render(row) : row[h.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/30 dark:bg-slate-900/50 text-slate-500">
          <span className="text-xs">
            Page <strong>{pagination.currentPage}</strong> of <strong>{pagination.totalPages}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <FiChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              className="rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
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
