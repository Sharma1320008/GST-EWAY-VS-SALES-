import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MetricCard } from './components/MetricCard';
import { DataTable } from './components/DataTable';
import { ColumnMappingModal } from './components/ColumnMappingModal';
import { ColumnMapping, DateToleranceOption, ReconciliationItem, ReconciliationStatus } from './types/reconciliation';
import { parseUploadedFile } from './utils/fileParser';
import { reconcile, standardize } from './utils/reconciliation';
import { SAMPLE_GSTR1_DATA, SAMPLE_EWB_DATA } from './utils/sampleData';
import { AlertCircle, FileCheck2, ArrowRight, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

export function App() {
  const [gstrFile, setGstrFile] = useState<File | null>(null);
  const [ewbFile, setEwbFile] = useState<File | null>(null);
  const [tolerance, setTolerance] = useState<number>(1.0);
  const [dateTolerance, setDateTolerance] = useState<DateToleranceOption>(1); // Default ±1 day
  const [ewbThreshold, setEwbThreshold] = useState<number>(50000); // Default ₹50k threshold
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Parsed raw data
  const [gstrColumns, setGstrColumns] = useState<string[]>([]);
  const [ewbColumns, setEwbColumns] = useState<string[]>([]);
  const [gstrRows, setGstrRows] = useState<any[]>([]);
  const [ewbRows, setEwbRows] = useState<any[]>([]);

  // Mappings
  const [gstrMapping, setGstrMapping] = useState<ColumnMapping | null>(null);
  const [ewbMapping, setEwbMapping] = useState<ColumnMapping | null>(null);

  // Reconciliation Results
  const [result, setResult] = useState<ReconciliationItem[] | null>(null);
  const [filterStatus, setFilterStatus] = useState<ReconciliationStatus>('All');
  const [isSampleActive, setIsSampleActive] = useState<boolean>(false);
  const [showMappingModal, setShowMappingModal] = useState<boolean>(false);

  // Metric computations
  const metrics = useMemo(() => {
    if (!result) return null;

    let matched = 0;
    let unmatched = 0;
    let ewbNotFound = 0;
    let ewbNotRequired = 0;
    let extraEwb = 0;
    let reviewDuplicate = 0;

    for (const r of result) {
      if (r.Status === 'Matched') matched++;
      else if (r.Status === 'Unmatched') unmatched++;
      else if (r.Status === 'E-Way Bill Not Found') ewbNotFound++;
      else if (r.Status === 'E-Way Bill Not Required (< ₹50k)') ewbNotRequired++;
      else if (r.Status === 'Extra E-Way Bill') extraEwb++;
      else if (r.Status === 'Review - Duplicate') reviewDuplicate++;
    }

    const totalGstr = matched + unmatched + ewbNotFound + ewbNotRequired + reviewDuplicate;
    const totalEwb = matched + unmatched + extraEwb + reviewDuplicate;

    return {
      totalGstr,
      totalEwb,
      matched,
      unmatched,
      ewbNotFound,
      ewbNotRequired,
      extraEwb,
      reviewDuplicate
    };
  }, [result]);

  const runReconciliationProcess = async (
    gRows: any[],
    gCols: string[],
    eRows: any[],
    eCols: string[],
    customGstrMap?: Partial<ColumnMapping>,
    customEwbMap?: Partial<ColumnMapping>
  ) => {
    setIsProcessing(true);
    setError(null);

    try {
      const { standardized: gs, mapping: gm } = standardize(gRows, gCols, 'GSTR-1', customGstrMap);
      const { standardized: es, mapping: em } = standardize(eRows, eCols, 'E-Way Bill', customEwbMap);

      setGstrMapping(gm);
      setEwbMapping(em);

      // Check if invoice_no was found
      const missingG = !gm.invoice_no;
      const missingE = !em.invoice_no;

      if (missingG || missingE) {
        setShowMappingModal(true);
        setError('Invoice number column could not be automatically detected. Please select the correct columns in the mapping window.');
        setIsProcessing(false);
        return;
      }

      const recResult = reconcile(gs, es, tolerance, dateTolerance, ewbThreshold);
      setResult(recResult);
    } catch (err: any) {
      console.error('Reconciliation error:', err);
      setError(err?.message || 'Error occurred while processing files.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRun = async () => {
    if (isSampleActive) {
      runReconciliationProcess(
        SAMPLE_GSTR1_DATA.rows,
        SAMPLE_GSTR1_DATA.columns,
        SAMPLE_EWB_DATA.rows,
        SAMPLE_EWB_DATA.columns
      );
      return;
    }

    if (!gstrFile || !ewbFile) {
      setError('Please upload both GSTR-1 and E-Way Bill files to proceed.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const [parsedGstr, parsedEwb] = await Promise.all([
        parseUploadedFile(gstrFile),
        parseUploadedFile(ewbFile)
      ]);

      setGstrColumns(parsedGstr.columns);
      setGstrRows(parsedGstr.rows);
      setEwbColumns(parsedEwb.columns);
      setEwbRows(parsedEwb.rows);

      await runReconciliationProcess(
        parsedGstr.rows,
        parsedGstr.columns,
        parsedEwb.rows,
        parsedEwb.columns
      );
    } catch (err: any) {
      console.error('File parsing error:', err);
      setError(err?.message || 'Error occurred while parsing the uploaded reports.');
      setIsProcessing(false);
    }
  };

  const handleLoadSample = () => {
    setIsSampleActive(true);
    setGstrFile(null);
    setEwbFile(null);
    setGstrColumns(SAMPLE_GSTR1_DATA.columns);
    setGstrRows(SAMPLE_GSTR1_DATA.rows);
    setEwbColumns(SAMPLE_EWB_DATA.columns);
    setEwbRows(SAMPLE_EWB_DATA.rows);

    runReconciliationProcess(
      SAMPLE_GSTR1_DATA.rows,
      SAMPLE_GSTR1_DATA.columns,
      SAMPLE_EWB_DATA.rows,
      SAMPLE_EWB_DATA.columns
    );
  };

  const handleReset = () => {
    setGstrFile(null);
    setEwbFile(null);
    setResult(null);
    setGstrColumns([]);
    setGstrRows([]);
    setEwbColumns([]);
    setEwbRows([]);
    setGstrMapping(null);
    setEwbMapping(null);
    setFilterStatus('All');
    setIsSampleActive(false);
    setError(null);
  };

  const handleCustomMappingApply = (
    customG: Partial<ColumnMapping>,
    customE: Partial<ColumnMapping>
  ) => {
    const gRows = isSampleActive ? SAMPLE_GSTR1_DATA.rows : gstrRows;
    const gCols = isSampleActive ? SAMPLE_GSTR1_DATA.columns : gstrColumns;
    const eRows = isSampleActive ? SAMPLE_EWB_DATA.rows : ewbRows;
    const eCols = isSampleActive ? SAMPLE_EWB_DATA.columns : ewbColumns;

    runReconciliationProcess(gRows, gCols, eRows, eCols, customG, customE);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
            ₹
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-base leading-tight">GST Reconciliation Pro</h1>
            <p className="text-[11px] text-slate-500">Automated E-Way Bill vs GSTR-1 Sales Audit</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={handleLoadSample}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Load Demo Data
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar */}
        <Sidebar
          gstrFile={gstrFile}
          ewbFile={ewbFile}
          onGstrFileChange={(file) => {
            setIsSampleActive(false);
            setGstrFile(file);
          }}
          onEwbFileChange={(file) => {
            setIsSampleActive(false);
            setEwbFile(file);
          }}
          tolerance={tolerance}
          onToleranceChange={setTolerance}
          dateTolerance={dateTolerance}
          onDateToleranceChange={setDateTolerance}
          ewbThreshold={ewbThreshold}
          onEwbThresholdChange={setEwbThreshold}
          onRun={handleRun}
          isProcessing={isProcessing}
          onLoadSample={handleLoadSample}
          onReset={handleReset}
          hasResult={!!result}
          isSampleActive={isSampleActive}
        />

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Header />

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{error}</p>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMappingModal(true)}
                    className="text-xs bg-red-600 text-white font-medium px-3 py-1.5 rounded-lg hover:bg-red-700"
                  >
                    Open Column Mapper
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results View */}
          {result && metrics ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Reconciliation Dashboard</h2>
                <p className="text-xs text-slate-500">
                  Click any card below to filter the invoice table automatically.
                </p>
              </div>

              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
                <MetricCard
                  label="GSTR-1 Bills"
                  value={metrics.totalGstr}
                  isSelected={filterStatus === 'All'}
                  onClick={() => setFilterStatus('All')}
                  variant="blue"
                />
                <MetricCard
                  label="E-Way Bills"
                  value={metrics.totalEwb}
                  isSelected={filterStatus === 'All'}
                  onClick={() => setFilterStatus('All')}
                  variant="slate"
                />
                <MetricCard
                  label="Matched"
                  value={metrics.matched}
                  isSelected={filterStatus === 'Matched'}
                  onClick={() => setFilterStatus('Matched')}
                  variant="green"
                />
                <MetricCard
                  label="Unmatched"
                  value={metrics.unmatched}
                  isSelected={filterStatus === 'Unmatched'}
                  onClick={() => setFilterStatus('Unmatched')}
                  variant="amber"
                />
                <MetricCard
                  label="E-Way Bill Not Found"
                  value={metrics.ewbNotFound}
                  isSelected={filterStatus === 'E-Way Bill Not Found'}
                  onClick={() => setFilterStatus('E-Way Bill Not Found')}
                  variant="orange"
                />
                <MetricCard
                  label="EWB Not Required (< ₹50k)"
                  value={metrics.ewbNotRequired}
                  isSelected={filterStatus === 'E-Way Bill Not Required (< ₹50k)'}
                  onClick={() => setFilterStatus('E-Way Bill Not Required (< ₹50k)')}
                  variant="teal"
                />
                <MetricCard
                  label="Extra E-Way Bills"
                  value={metrics.extraEwb}
                  isSelected={filterStatus === 'Extra E-Way Bill'}
                  onClick={() => setFilterStatus('Extra E-Way Bill')}
                  variant="purple"
                />
                <MetricCard
                  label="Review / Duplicate"
                  value={metrics.reviewDuplicate}
                  isSelected={filterStatus === 'Review - Duplicate'}
                  onClick={() => setFilterStatus('Review - Duplicate')}
                  variant="rose"
                />
              </div>

              {/* Data Table */}
              <DataTable
                items={result}
                currentFilter={filterStatus}
                onFilterChange={setFilterStatus}
                gstrMapping={gstrMapping}
                ewbMapping={ewbMapping}
                onOpenMapping={() => setShowMappingModal(true)}
              />
            </div>
          ) : (
            /* Empty State / Welcome Screen */
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200/90 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Start a Reconciliation</h3>
                <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                  Compare GSTR-1 outward supply data against your official E-Way Bill register to highlight discrepancies, missing documents, below-₹50k exemptions, and potential audit risks in seconds.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Supported Uploads */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-blue-600" />
                      Supported Uploads
                    </h4>
                    <ul className="space-y-2 text-xs text-slate-600">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <div>
                          <strong>GSTR-1</strong>: JSON (Direct portal download), Excel (.xlsx, .xls), or CSV
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <div>
                          <strong>E-Way Bill</strong>: Excel (.xlsx, .xls) or CSV from the NIC E-Way Bill Portal
                        </div>
                      </li>
                    </ul>
                  </div>

                  {/* Key Reconciliation Checks */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Smart Reconciliation Rules
                    </h4>
                    <ul className="space-y-2 text-xs text-slate-600">
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div>
                          <strong>Robust Invoice Matching</strong>: Matches across invoice formats, trailing zeros, and portal column variations
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                        <div>
                          <strong>Rule 138 Exemption (&lt; ₹50k)</strong>: Invoices below ₹50,000 without E-Way Bill are categorized into a dedicated non-mandatory head
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <div>
                          <strong>Date Difference Tolerance</strong>: Configurable tolerance (±0, ±1, ±2, ±3, ±7 days or Ignore) handles transit dispatch gaps
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                        <div>
                          <strong>Compliance Missing EWB</strong>: Highlights invoices &gt;= ₹50,000 reported in GSTR-1 without an E-Way Bill
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Files are processed locally in your session. Please verify detected column mappings before finalizing compliance reports.</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <span>Load Demo Data to Test</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Manual Column Mapping Modal */}
      <ColumnMappingModal
        isOpen={showMappingModal}
        onClose={() => setShowMappingModal(false)}
        gstrColumns={gstrColumns.length > 0 ? gstrColumns : SAMPLE_GSTR1_DATA.columns}
        ewbColumns={ewbColumns.length > 0 ? ewbColumns : SAMPLE_EWB_DATA.columns}
        initialGstrMapping={
          gstrMapping || {
            invoice_no: null,
            gstin: null,
            date: null,
            taxable: null,
            igst: null,
            cgst: null,
            sgst: null,
            total: null,
          }
        }
        initialEwbMapping={
          ewbMapping || {
            invoice_no: null,
            gstin: null,
            date: null,
            taxable: null,
            igst: null,
            cgst: null,
            sgst: null,
            total: null,
          }
        }
        onApply={handleCustomMappingApply}
      />
    </div>
  );
}

export default App;
