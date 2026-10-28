import React, { useState, useMemo } from 'react';
import { Search, Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, SlidersHorizontal, Layers, Calendar, X } from 'lucide-react';
import { ColumnMapping, ReconciliationItem, ReconciliationStatus } from '../types/reconciliation';
import { exportReconciliationToExcel } from '../utils/reconciliation';

interface DataTableProps {
  items: ReconciliationItem[];
  currentFilter: ReconciliationStatus;
  onFilterChange: (status: ReconciliationStatus) => void;
  gstrMapping?: ColumnMapping | null;
  ewbMapping?: ColumnMapping | null;
  onOpenMapping?: () => void;
}

// Convert "DD-MM-YYYY" string into "YYYY-MM-DD" for comparison
function toIsoDate(dStr: string | null): string | null {
  if (!dStr) return null;
  const m = dStr.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (m) {
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return null;
}

export const DataTable: React.FC<DataTableProps> = ({
  items,
  currentFilter,
  onFilterChange,
  gstrMapping,
  ewbMapping,
  onOpenMapping
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showMapping, setShowMapping] = useState(false);

  // Filter and search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Category Status Filter
      const matchesStatus = currentFilter === 'All' || item.Status === currentFilter;
      if (!matchesStatus) return false;

      // 2. Date Range Filter
      if (startDate || endDate) {
        const itemDate = toIsoDate(item['GSTR-1 Date']) || toIsoDate(item['E-Way Bill Date']);
        if (itemDate) {
          if (startDate && itemDate < startDate) return false;
          if (endDate && itemDate > endDate) return false;
        } else {
          // If filtering by date and item has no dates, exclude
          return false;
        }
      }

      // 3. Search query
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      const inv = String(item['Invoice No.'] || '').toLowerCase();
      const gstin = String(item.GSTIN || '').toLowerCase();
      const reason = String(item.Reason || '').toLowerCase();
      return inv.includes(q) || gstin.includes(q) || reason.includes(q);
    });
  }, [items, currentFilter, searchTerm, startDate, endDate]);

  // Reset page when filter or search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [currentFilter, searchTerm, startDate, endDate, pageSize]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const formatCurrency = (val: number | null | undefined) => {
    if (val == null) return '-';
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: ReconciliationStatus) => {
    switch (status) {
      case 'Matched':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Matched
          </span>
        );
      case 'Unmatched':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            Unmatched
          </span>
        );
      case 'E-Way Bill Not Found':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200">
            E-Way Bill Not Found
          </span>
        );
      case 'E-Way Bill Not Required (< ₹50k)':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200" title="Exempted from mandatory E-Way Bill under Rule 138">
            EWB Not Required (&lt; ₹50k)
          </span>
        );
      case 'Extra E-Way Bill':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            Extra E-Way Bill
          </span>
        );
      case 'Review - Duplicate':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            Review - Duplicate
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  const statusOptions: ReconciliationStatus[] = [
    'All',
    'Matched',
    'Unmatched',
    'E-Way Bill Not Found',
    'E-Way Bill Not Required (< ₹50k)',
    'Extra E-Way Bill',
    'Review - Duplicate',
  ];

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* Top Filter & Search Bar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Filter Category:</label>
              <select
                value={currentFilter}
                onChange={(e) => onFilterChange(e.target.value as ReconciliationStatus)}
                className="text-xs py-2 px-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 font-medium"
              >
                {statusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Box */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Invoice No. or GSTIN"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Action Buttons: Export & Custom Mapping */}
          <div className="flex items-center gap-2">
            {onOpenMapping && (
              <button
                type="button"
                onClick={onOpenMapping}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-sm transition-colors cursor-pointer"
                title="Adjust column mapping manually"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                Adjust Mapping
              </button>
            )}

            <button
              type="button"
              onClick={() => exportReconciliationToExcel(items)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download Excel Report
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Date Filter:</span>
          </div>

          {/* Quick Date Presets Dropdown */}
          <select
            value={startDate || endDate ? 'custom' : 'all'}
            onChange={(e) => {
              const preset = e.target.value;
              const now = new Date();
              const year = now.getFullYear();
              const month = now.getMonth();

              if (preset === 'all') {
                setStartDate('');
                setEndDate('');
              } else if (preset === 'this-month') {
                const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
                const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
                setStartDate(firstDay);
                setEndDate(lastDay);
              } else if (preset === 'last-month') {
                const firstDay = new Date(year, month - 1, 1).toISOString().split('T')[0];
                const lastDay = new Date(year, month, 0).toISOString().split('T')[0];
                setStartDate(firstDay);
                setEndDate(lastDay);
              } else if (preset === 'last-30') {
                const past = new Date();
                past.setDate(past.getDate() - 30);
                setStartDate(past.toISOString().split('T')[0]);
                setEndDate(now.toISOString().split('T')[0]);
              } else if (preset === 'fy-2425') {
                setStartDate('2024-04-01');
                setEndDate('2025-03-31');
              } else if (preset === 'fy-2324') {
                setStartDate('2023-04-01');
                setEndDate('2024-03-31');
              }
            }}
            className="py-1 px-2.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">All Dates</option>
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="last-30">Last 30 Days</option>
            <option value="fy-2425">FY 2024-25</option>
            <option value="fy-2324">FY 2023-24</option>
            <option value="custom">Custom Date Range...</option>
          </select>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
                Clear Dates
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row counter info */}
      <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
        <div>
          Showing <span className="font-bold text-slate-900">{filteredItems.length.toLocaleString('en-IN')}</span> invoices
          {currentFilter !== 'All' && <span> in <strong className="text-slate-800">{currentFilter}</strong></span>}
          {searchTerm && <span> matching &ldquo;{searchTerm}&rdquo;</span>}
          {(startDate || endDate) && (
            <span> between {startDate || 'start'} and {endDate || 'end'}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5"
          >
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100/80 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <th className="py-3 px-3.5 whitespace-nowrap">Status</th>
              <th className="py-3 px-3.5 min-w-[220px]">Reason</th>
              <th className="py-3 px-3.5 whitespace-nowrap font-bold">Invoice No.</th>
              <th className="py-3 px-3.5 whitespace-nowrap">GSTIN</th>
              <th className="py-3 px-3.5 whitespace-nowrap">GSTR-1 Date</th>
              <th className="py-3 px-3.5 whitespace-nowrap">E-Way Bill Date</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap">GSTR-1 Taxable</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap">EWB Taxable</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap">GSTR-1 IGST</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap">EWB IGST</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap">GSTR-1 CGST</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap">EWB CGST</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap">GSTR-1 SGST</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap">EWB SGST</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap font-bold">GSTR-1 Inv Val</th>
              <th className="py-3 px-3.5 text-right whitespace-nowrap font-bold">EWB Inv Val</th>
              <th className="py-3 px-3 text-center whitespace-nowrap text-slate-400">GSTR Row</th>
              <th className="py-3 px-3 text-center whitespace-nowrap text-slate-400">EWB Row</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={18} className="py-12 text-center text-slate-400">
                  No invoice records found matching the current criteria.
                </td>
              </tr>
            ) : (
              paginatedItems.map((item, idx) => (
                <tr
                  key={`${item['Invoice No.']}-${idx}`}
                  className="hover:bg-blue-50/40 transition-colors odd:bg-white even:bg-slate-50/40"
                >
                  <td className="py-2.5 px-3.5 whitespace-nowrap">{getStatusBadge(item.Status)}</td>
                  <td className="py-2.5 px-3.5 text-slate-600 max-w-xs truncate" title={item.Reason}>
                    {item.Reason}
                  </td>
                  <td className="py-2.5 px-3.5 font-semibold text-slate-900 whitespace-nowrap">
                    {item['Invoice No.'] || '-'}
                  </td>
                  <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-800 whitespace-nowrap">
                    {item.GSTIN || '-'}
                  </td>
                  <td className="py-2.5 px-3.5 whitespace-nowrap">{item['GSTR-1 Date'] || '-'}</td>
                  <td className="py-2.5 px-3.5 whitespace-nowrap">{item['E-Way Bill Date'] || '-'}</td>
                  <td className="py-2.5 px-3.5 text-right tabular-nums whitespace-nowrap">
                    {formatCurrency(item['GSTR-1 Taxable'])}
                  </td>
                  <td className="py-2.5 px-3.5 text-right tabular-nums whitespace-nowrap">
                    {formatCurrency(item['EWB Taxable'])}
                  </td>
                  <td className="py-2.5 px-3.5 text-right tabular-nums whitespace-nowrap">
                    {formatCurrency(item['GSTR-1 IGST'])}
                  </td>
                  <td className="py-2.5 px-3.5 text-right tabular-nums whitespace-nowrap">
                    {formatCurrency(item['EWB IGST'])}
                  </td>
                  <td className="py-2.5 px-3.5 text-right tabular-nums whitespace-nowrap">
                    {formatCurrency(item['GSTR-1 CGST'])}
                  </td>
                  <td className="py-2.5 px-3.5 text-right tabular-nums whitespace-nowrap">
                    {formatCurrency(item['EWB CGST'])}
                  </td>
                  <td className="py-2.5 px-3.5 text-right tabular-nums whitespace-nowrap">
                    {formatCurrency(item['GSTR-1 SGST'])}
                  </td>
                  <td className="py-2.5 px-3.5 text-right tabular-nums whitespace-nowrap">
                    {formatCurrency(item['EWB SGST'])}
                  </td>
                  <td className="py-2.5 px-3.5 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                    {formatCurrency(item['GSTR-1 Invoice Value'])}
                  </td>
                  <td className="py-2.5 px-3.5 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                    {formatCurrency(item['EWB Invoice Value'])}
                  </td>
                  <td className="py-2.5 px-3.5 text-center text-slate-500 whitespace-nowrap">
                    {item['GSTR-1 Source Row'] ?? '-'}
                  </td>
                  <td className="py-2.5 px-3.5 text-center text-slate-500 whitespace-nowrap">
                    {item['EWB Source Row'] ?? '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-600">
          <div>
            Page <span className="font-semibold text-slate-900">{currentPage}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalPages}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Detected Column Mapping */}
      <div className="border-t border-slate-200 bg-slate-50/60">
        <button
          type="button"
          onClick={() => setShowMapping(!showMapping)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-100/60 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            Detected Column Mapping (Verified)
          </span>
          {showMapping ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showMapping && (
          <div className="p-4 pt-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs border-t border-slate-200/60 bg-white">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="font-semibold text-slate-800 mb-2">GSTR-1 Mapping:</h4>
              <div className="space-y-1 font-mono text-[11px] text-slate-700">
                {gstrMapping ? (
                  Object.entries(gstrMapping)
                    .filter(([, v]) => v !== null)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-slate-200/60 py-0.5">
                        <span className="text-slate-500">{k}:</span>
                        <span className="font-semibold text-blue-700">{v}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-slate-400">Default auto-mapped</p>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="font-semibold text-slate-800 mb-2">E-Way Bill Mapping:</h4>
              <div className="space-y-1 font-mono text-[11px] text-slate-700">
                {ewbMapping ? (
                  Object.entries(ewbMapping)
                    .filter(([, v]) => v !== null)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-slate-200/60 py-0.5">
                        <span className="text-slate-500">{k}:</span>
                        <span className="font-semibold text-purple-700">{v}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-slate-400">Default auto-mapped</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
