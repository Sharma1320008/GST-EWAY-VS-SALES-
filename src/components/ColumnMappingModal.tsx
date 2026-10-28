import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { ColumnMapping } from '../types/reconciliation';

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  gstrColumns: string[];
  ewbColumns: string[];
  initialGstrMapping: ColumnMapping;
  initialEwbMapping: ColumnMapping;
  onApply: (gstr: Partial<ColumnMapping>, ewb: Partial<ColumnMapping>) => void;
}

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  isOpen,
  onClose,
  gstrColumns,
  ewbColumns,
  initialGstrMapping,
  initialEwbMapping,
  onApply
}) => {
  const [gstrMap, setGstrMap] = useState<ColumnMapping>({ ...initialGstrMapping });
  const [ewbMap, setEwbMap] = useState<ColumnMapping>({ ...initialEwbMapping });

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(gstrMap, ewbMap);
    onClose();
  };

  const fields: Array<{ key: keyof ColumnMapping; label: string; required?: boolean }> = [
    { key: 'invoice_no', label: 'Invoice / Doc Number', required: true },
    { key: 'gstin', label: 'GSTIN / UIN' },
    { key: 'date', label: 'Document Date' },
    { key: 'taxable', label: 'Taxable Value' },
    { key: 'igst', label: 'IGST Amount' },
    { key: 'cgst', label: 'CGST Amount' },
    { key: 'sgst', label: 'SGST / UTGST Amount' },
    { key: 'total', label: 'Invoice / Total Value' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Manual Column Mapping</h3>
            <p className="text-xs text-slate-500">
              Select which columns in your uploaded files correspond to the required reconciliation fields.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* GSTR-1 Mapping */}
            <div className="space-y-3 bg-blue-50/40 p-4 rounded-xl border border-blue-100">
              <h4 className="font-bold text-blue-900 uppercase tracking-wider text-[11px] pb-1 border-b border-blue-200">
                GSTR-1 Columns
              </h4>
              {fields.map(({ key, label, required }) => (
                <div key={`gstr-${key}`}>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={gstrMap[key] || 'None'}
                    onChange={(e) =>
                      setGstrMap((prev) => ({
                        ...prev,
                        [key]: e.target.value === 'None' ? null : e.target.value
                      }))
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="None">-- Not Selected --</option>
                    {gstrColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* E-Way Bill Mapping */}
            <div className="space-y-3 bg-purple-50/40 p-4 rounded-xl border border-purple-100">
              <h4 className="font-bold text-purple-900 uppercase tracking-wider text-[11px] pb-1 border-b border-purple-200">
                E-Way Bill Columns
              </h4>
              {fields.map(({ key, label, required }) => (
                <div key={`ewb-${key}`}>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={ewbMap[key] || 'None'}
                    onChange={(e) =>
                      setEwbMap((prev) => ({
                        ...prev,
                        [key]: e.target.value === 'None' ? null : e.target.value
                      }))
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  >
                    <option value="None">-- Not Selected --</option>
                    {ewbColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Apply Mapping & Run Reconciliation
          </button>
        </div>
      </div>
    </div>
  );
};
