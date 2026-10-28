export type ReconciliationStatus =
  | 'All'
  | 'Matched'
  | 'Unmatched'
  | 'E-Way Bill Not Found'
  | 'E-Way Bill Not Required (< ₹50k)'
  | 'Extra E-Way Bill'
  | 'Review - Duplicate';

export type DateToleranceOption = number; // -1 means ignore date difference, >= 0 means allowed days gap

export interface StandardInvoiceRow {
  invoice_no: string;
  clean_inv_no?: string;
  gstin: string;
  date: string | null;
  parsed_date?: Date | null;
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
  total: number;
  source_row: string | number;
  source: 'GSTR-1' | 'E-Way Bill';
  section?: string;
  pos?: string;
  inv_typ?: string;
  key?: string;
}

export interface ReconciliationItem {
  'Status': ReconciliationStatus;
  'Reason': string;
  'Invoice No.': string;
  'GSTIN': string;
  'GSTR-1 Date': string | null;
  'E-Way Bill Date': string | null;
  'GSTR-1 Taxable': number | null;
  'EWB Taxable': number | null;
  'GSTR-1 IGST': number | null;
  'EWB IGST': number | null;
  'GSTR-1 CGST': number | null;
  'EWB CGST': number | null;
  'GSTR-1 SGST': number | null;
  'EWB SGST': number | null;
  'GSTR-1 Invoice Value': number | null;
  'EWB Invoice Value': number | null;
  'GSTR-1 Source Row': string | number | null;
  'EWB Source Row': string | number | null;
}

export interface ColumnMapping {
  invoice_no: string | null;
  gstin: string | null;
  date: string | null;
  taxable: string | null;
  igst: string | null;
  cgst: string | null;
  sgst: string | null;
  total: string | null;
}

export interface ReconciliationSummary {
  totalGstr: number;
  totalEwb: number;
  matched: number;
  unmatched: number;
  ewbNotFound: number;
  ewbNotRequired: number;
  extraEwb: number;
  reviewDuplicate: number;
}
