# GST Reconciliation Pro

A modern, high-performance React application for automated invoice-level reconciliation between **GSTR-1** (JSON, Excel, CSV) and **E-Way Bill** (Excel, CSV) reports.

## Features

- **Multi-Format Ingestion**:
  - GSTR-1 direct portal JSON downloads (with automatic item rate aggregation across B2B, B2BA, B2CL, B2CLA, EXP, CDNR, and CDNUR sections).
  - Excel reports (`.xlsx`, `.xls`) with intelligent sheet prioritization and automatic header row detection.
  - CSV exports from official GST & NIC portals.
- **Automated Column Detection**:
  - Fuzzy and alias matching across all standard Indian GST and E-Way Bill field variations.
  - Manual Column Mapping fallback modal when custom spreadsheet layouts are used.
- **Discrepancy & Matching Engine**:
  - **Matched**: Invoices where document number, recipient GSTIN, dates, taxable amounts, and tax values align within a user-customizable tolerance (₹).
  - **Unmatched**: Exact breakdown of date variances and tax component differences (Taxable, IGST, CGST, SGST, Total).
  - **E-Way Bill Not Found**: Sales reported in GSTR-1 with no matching movement documentation.
  - **Extra E-Way Bill**: E-Way bills generated on the portal that are omitted from sales returns.
  - **Review - Duplicate**: Automated flag for duplicate invoices within source files.
- **Interactive Dashboard**:
  - Summary metric cards with 1-click drilldown filtering.
  - Fast client-side search across invoice numbers and GSTINs.
  - Formatted currency and date views with pagination support.
- **Multi-Sheet Excel Export**:
  - Download comprehensive reconciliation reports formatted into categorized tabs (`All Reconciliation`, `Matched`, `Unmatched`, `EWB Missing`, `Extra EWB`, `Review`).
- **Privacy First**:
  - 100% client-side computation. Tax data never leaves your browser session.
- **Built-in Demo Dataset**:
  - 1-click demo dataset to test all matching scenarios instantly.

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Spreadsheet Engine**: SheetJS (`xlsx`)

## Development

```bash
# Install dependencies
npm install

# Start local dev server (port 3000)
npm run dev

# Production build
npm run build
```
