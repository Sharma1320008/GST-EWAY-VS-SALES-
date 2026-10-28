import React from 'react';
import { FileSpreadsheet, Info } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <div className="mb-6">
      <div className="flex items-center space-x-3 mb-1">
        <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
          <FileSpreadsheet className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">GST Reconciliation Pro</h1>
          <p className="text-sm text-slate-500">E-Way Bill vs GSTR-1 • Invoice-wise reconciliation dashboard</p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2.5 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-900 text-sm">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          Upload your <strong>GSTR-1 (JSON / Excel)</strong> and <strong>E-Way Bill (Excel / CSV)</strong> reports below to run automated invoice-level reconciliation.
        </div>
      </div>
    </div>
  );
};
