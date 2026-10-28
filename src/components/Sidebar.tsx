import React, { useRef, useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, RefreshCw, Sparkles, X, Calendar, ShieldCheck } from 'lucide-react';
import { DateToleranceOption } from '../types/reconciliation';

interface SidebarProps {
  gstrFile: File | null;
  ewbFile: File | null;
  onGstrFileChange: (file: File | null) => void;
  onEwbFileChange: (file: File | null) => void;
  tolerance: number;
  onToleranceChange: (val: number) => void;
  dateTolerance: DateToleranceOption;
  onDateToleranceChange: (val: DateToleranceOption) => void;
  ewbThreshold: number;
  onEwbThresholdChange: (val: number) => void;
  onRun: () => void;
  isProcessing: boolean;
  onLoadSample: () => void;
  onReset: () => void;
  hasResult: boolean;
  isSampleActive: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  gstrFile,
  ewbFile,
  onGstrFileChange,
  onEwbFileChange,
  tolerance,
  onToleranceChange,
  dateTolerance,
  onDateToleranceChange,
  ewbThreshold,
  onEwbThresholdChange,
  onRun,
  isProcessing,
  onLoadSample,
  onReset,
  hasResult,
  isSampleActive
}) => {
  const gstrInputRef = useRef<HTMLInputElement>(null);
  const ewbInputRef = useRef<HTMLInputElement>(null);

  const presetValues = [0, 1, 2, 3, 7, 15, 30, -1];
  const [selectedDropdownVal, setSelectedDropdownVal] = useState<string>(
    presetValues.includes(dateTolerance) ? String(dateTolerance) : 'custom'
  );
  const [customDays, setCustomDays] = useState<number>(
    dateTolerance >= 0 ? dateTolerance : 5
  );

  useEffect(() => {
    if (presetValues.includes(dateTolerance)) {
      setSelectedDropdownVal(String(dateTolerance));
    } else {
      setSelectedDropdownVal('custom');
      setCustomDays(dateTolerance);
    }
  }, [dateTolerance]);

  return (
    <aside className="w-full lg:w-80 bg-white border-r border-slate-200/90 p-5 flex flex-col gap-6 shrink-0 shadow-sm">
      {/* 1. Upload Reports */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">1</span>
            Upload Reports
          </h2>
          <button
            type="button"
            onClick={onLoadSample}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 hover:underline cursor-pointer"
            title="Load built-in demonstration dataset"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isSampleActive ? 'Sample Loaded' : 'Try Sample'}
          </button>
        </div>

        {/* GSTR-1 File Uploader */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            GSTR-1 Report <span className="font-normal text-slate-500">(Excel, JSON, CSV)</span>
          </label>
          <input
            type="file"
            ref={gstrInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onGstrFileChange(e.target.files[0]);
              }
            }}
            accept=".xlsx,.xls,.json,.csv"
            className="hidden"
          />

          {gstrFile ? (
            <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900">
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate font-medium">{gstrFile.name}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onGstrFileChange(null);
                  if (gstrInputRef.current) gstrInputRef.current.value = '';
                }}
                className="text-slate-400 hover:text-red-500 ml-2 shrink-0 p-1 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : isSampleActive ? (
            <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-900">
              <div className="flex items-center gap-2 truncate">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate font-medium">Demo GSTR-1 (8 records)</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => gstrInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-slate-50/70 transition-colors rounded-lg p-3 text-center flex flex-col items-center justify-center gap-1 cursor-pointer"
            >
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-xs font-medium text-slate-600">Choose GSTR-1 file</span>
              <span className="text-[10px] text-slate-400">.xlsx, .xls, .json, .csv</span>
            </button>
          )}
        </div>

        {/* E-Way Bill File Uploader */}
        <div className="mb-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            E-Way Bill Report <span className="font-normal text-slate-500">(Excel, CSV)</span>
          </label>
          <input
            type="file"
            ref={ewbInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onEwbFileChange(e.target.files[0]);
              }
            }}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />

          {ewbFile ? (
            <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900">
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate font-medium">{ewbFile.name}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onEwbFileChange(null);
                  if (ewbInputRef.current) ewbInputRef.current.value = '';
                }}
                className="text-slate-400 hover:text-red-500 ml-2 shrink-0 p-1 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : isSampleActive ? (
            <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-900">
              <div className="flex items-center gap-2 truncate">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate font-medium">Demo E-Way Bill (7 records)</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => ewbInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-slate-50/70 transition-colors rounded-lg p-3 text-center flex flex-col items-center justify-center gap-1 cursor-pointer"
            >
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-xs font-medium text-slate-600">Choose E-Way Bill file</span>
              <span className="text-[10px] text-slate-400">.xlsx, .xls, .csv</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Settings */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-1">
          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">2</span>
          Reconciliation Settings
        </h2>

        {/* Amount Difference Tolerance */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Amount difference tolerance (₹)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={tolerance}
              onChange={(e) => onToleranceChange(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Value diffs up to ₹{tolerance} are treated as matched.</p>
        </div>

        {/* Date Difference Tolerance Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            Date difference tolerance
          </label>
          <select
            value={selectedDropdownVal}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedDropdownVal(val);
              if (val === 'custom') {
                onDateToleranceChange(customDays);
              } else {
                onDateToleranceChange(Number(val));
              }
            }}
            className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
          >
            <option value="0">±0 Days (Exact Date Match)</option>
            <option value="1">±1 Day Gap</option>
            <option value="2">±2 Days Gap</option>
            <option value="3">±3 Days Gap (Recommended for transit)</option>
            <option value="7">±7 Days Gap (1 Week)</option>
            <option value="15">±15 Days Gap (Fortnight)</option>
            <option value="30">±30 Days Gap (1 Month)</option>
            <option value="custom">Custom Date Tolerance (Enter Days)...</option>
            <option value="-1">Ignore Date Mismatch (Value Only)</option>
          </select>

          {/* Custom Date Days Input */}
          {selectedDropdownVal === 'custom' && (
            <div className="mt-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg">
              <label className="block text-[11px] font-semibold text-blue-900 mb-1">
                Enter Custom Days Tolerance:
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-700 font-bold">±</span>
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={customDays}
                  onChange={(e) => {
                    const v = Math.max(0, parseInt(e.target.value) || 0);
                    setCustomDays(v);
                    onDateToleranceChange(v);
                  }}
                  className="w-full px-2.5 py-1 text-xs bg-white border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-800"
                  placeholder="e.g. 5"
                />
                <span className="text-xs text-blue-900 font-medium whitespace-nowrap">Days</span>
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-500 mt-1">
            {dateTolerance === -1
              ? 'Date differences will not mark invoices as Unmatched.'
              : `Dates within ${dateTolerance} day(s) will be treated as matched.`}
          </p>
        </div>

        {/* E-Way Bill Exemption Limit (Rule 138) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            E-Way Bill Exemption Limit (₹)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
            <input
              type="number"
              min="0"
              step="5000"
              value={ewbThreshold}
              onChange={(e) => onEwbThresholdChange(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Invoices below ₹{ewbThreshold.toLocaleString('en-IN')} without EWB will be put in <strong>E-Way Bill Not Required</strong> head.
          </p>
        </div>

        <button
          type="button"
          onClick={onRun}
          disabled={isProcessing || (!isSampleActive && (!gstrFile || !ewbFile))}
          className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
            isProcessing || (!isSampleActive && (!gstrFile || !ewbFile))
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
          }`}
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Reconciling...
            </>
          ) : (
            'Run Reconciliation'
          )}
        </button>

        {hasResult && (
          <button
            type="button"
            onClick={onReset}
            className="w-full py-2 px-3 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Clear / Start New Reconciliation
          </button>
        )}
      </div>

      {/* Helpful info callout */}
      <div className="mt-auto pt-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
        <p className="font-semibold text-slate-600">Local Privacy First</p>
        <p>All parsing and reconciliation is executed securely in your local browser runtime. No tax data leaves your device.</p>
      </div>
    </aside>
  );
};
