import * as XLSX from 'xlsx';
import { ColumnMapping, StandardInvoiceRow } from '../types/reconciliation';

export const ALIASES: Record<string, string[]> = {
  invoice_no: [
    'invoiceno', 'invoicenumber', 'documentnumber', 'docno', 'docnumber',
    'documentno', 'billno', 'billnumber', 'invno', 'inum', 'invnum',
    'docnum', 'challanno', 'ebillno', 'document', 'invoicedocumentno'
  ],
  gstin: [
    // In sales reconciliation, recipient/buyer GSTIN is the key counterpart to GSTR-1 ctin
    'togstin', 'recipientgstin', 'receivergstin', 'consigneegstin', 'buyergstin',
    'gstinofrecipient', 'ctin', 'gstinuinofrecipient', 'gstin', 'gstinuin',
    'gstinnumber', 'fromgstin', 'suppliergstin', 'gstinofsupplier'
  ],
  date: [
    'invoicedate', 'documentdate', 'docdate', 'date', 'billdate', 'invdate',
    'idt', 'docdt', 'invdt', 'documentdt', 'ewbdate'
  ],
  taxable: [
    'taxablevalue', 'taxableamount', 'assessablevalue', 'taxable', 'txval',
    'taxableamt', 'totaltaxablevalue', 'assessableamt', 'totaltaxableamount'
  ],
  igst: [
    'igst', 'igstamount', 'iamt', 'integratedtax', 'integratedtaxamount',
    'igstamt', 'integratedtaxamt'
  ],
  cgst: [
    'cgst', 'cgstamount', 'camt', 'centraltax', 'centraltaxamount',
    'cgstamt', 'centraltaxamt'
  ],
  sgst: [
    'sgst', 'sgstamount', 'samt', 'statetax', 'statetaxamount',
    'sgstamt', 'statetaxamt', 'utgst', 'utgstamount', 'utamt'
  ],
  total: [
    'invoicevalue', 'invoiceamount', 'totalinvoicevalue', 'totalvalue',
    'billamount', 'totalamount', 'val', 'totinvval', 'totinvvalue',
    'totaldocvalue', 'documentvalue', 'totalinvamount', 'grandtotal'
  ],
};

export function normCol(c: any): string {
  return String(c ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findCol(columns: string[], key: string, label?: 'GSTR-1' | 'E-Way Bill'): string | null {
  const normMap = new Map<string, string>();
  for (const c of columns) {
    normMap.set(normCol(c), c);
  }

  // If searching for GSTIN in E-Way Bill report, specifically prioritize recipient/consignee columns
  let aliases = ALIASES[key] || [];
  if (key === 'gstin' && label === 'E-Way Bill') {
    aliases = [
      'togstin', 'recipientgstin', 'consigneegstin', 'receivergstin', 'buyergstin',
      'gstinofrecipient', 'ctin', 'gstinuinofrecipient', 'gstin', 'gstinnumber',
      'fromgstin', 'suppliergstin'
    ];
  }

  // 1. Exact alias match
  for (const alias of aliases) {
    if (normMap.has(alias)) {
      return normMap.get(alias)!;
    }
  }

  // 2. Substring match
  for (const [norm, orig] of normMap.entries()) {
    for (const alias of aliases) {
      if (alias.length > 3 && norm.includes(alias)) {
        return orig;
      }
    }
  }

  return null;
}

export function parseGstr1Json(obj: any): any[] | null {
  const rows: any[] = [];
  if (!obj || typeof obj !== 'object') return null;

  // 1. B2B & B2BA
  for (const sectionKey of ['b2b', 'b2ba']) {
    const section = obj[sectionKey];
    if (Array.isArray(section)) {
      for (const group of section) {
        const ctin = group?.ctin || '';
        for (const inv of group?.inv || []) {
          const inum = String(inv?.inum || '').trim();
          const idt = inv?.idt || '';
          const val = inv?.val != null ? Number(inv.val) : null;
          const invTyp = inv?.inv_typ || '';
          const pos = inv?.pos || '';

          let txval = 0.0;
          let iamt = 0.0;
          let camt = 0.0;
          let samt = 0.0;
          let hasItems = false;

          for (const itm of inv?.itms || []) {
            const det = itm?.itm_det || itm;
            txval += Number(det?.txval || 0);
            iamt += Number(det?.iamt || 0);
            camt += Number(det?.camt || 0);
            samt += Number(det?.samt || 0);
            hasItems = true;
          }

          rows.push({
            invoice_no: inum,
            gstin: ctin,
            date: idt,
            taxable: hasItems ? txval : null,
            igst: hasItems ? iamt : null,
            cgst: hasItems ? camt : null,
            sgst: hasItems ? samt : null,
            total: val,
            section: sectionKey.toUpperCase(),
            pos,
            inv_typ: invTyp
          });
        }
      }
    }
  }

  // 2. B2CL & B2CLA
  for (const sectionKey of ['b2cl', 'b2cla']) {
    const section = obj[sectionKey];
    if (Array.isArray(section)) {
      for (const group of section) {
        const pos = group?.pos || '';
        for (const inv of group?.inv || []) {
          const inum = String(inv?.inum || '').trim();
          const idt = inv?.idt || '';
          const val = inv?.val != null ? Number(inv.val) : null;

          let txval = 0.0;
          let iamt = 0.0;
          let hasItems = false;

          for (const itm of inv?.itms || []) {
            const det = itm?.itm_det || itm;
            txval += Number(det?.txval || 0);
            iamt += Number(det?.iamt || 0);
            hasItems = true;
          }

          rows.push({
            invoice_no: inum,
            gstin: 'URP',
            date: idt,
            taxable: hasItems ? txval : null,
            igst: hasItems ? iamt : null,
            cgst: 0.0,
            sgst: 0.0,
            total: val,
            section: sectionKey.toUpperCase(),
            pos,
            inv_typ: 'B2CL'
          });
        }
      }
    }
  }

  // 3. EXP & EXPA
  for (const sectionKey of ['exp', 'expa']) {
    const section = obj[sectionKey];
    if (Array.isArray(section)) {
      for (const group of section) {
        const expTyp = group?.exp_typ || '';
        for (const inv of group?.inv || []) {
          const inum = String(inv?.inum || '').trim();
          const idt = inv?.idt || '';
          const val = inv?.val != null ? Number(inv.val) : null;

          let txval = 0.0;
          let iamt = 0.0;
          let hasItems = false;

          for (const itm of inv?.itms || []) {
            const det = itm?.itm_det || itm;
            txval += Number(det?.txval || 0);
            iamt += Number(det?.iamt || 0);
            hasItems = true;
          }

          rows.push({
            invoice_no: inum,
            gstin: 'EXP',
            date: idt,
            taxable: hasItems ? txval : null,
            igst: hasItems ? iamt : null,
            cgst: 0.0,
            sgst: 0.0,
            total: val,
            section: sectionKey.toUpperCase(),
            pos: '',
            inv_typ: expTyp
          });
        }
      }
    }
  }

  // 4. CDNR & CDNRA
  for (const sectionKey of ['cdnr', 'cdnra']) {
    const section = obj[sectionKey];
    if (Array.isArray(section)) {
      for (const group of section) {
        const ctin = group?.ctin || '';
        for (const nt of group?.nt || []) {
          const ntNum = String(nt?.nt_num || '').trim();
          const ntDt = nt?.nt_dt || '';
          const val = nt?.val != null ? Number(nt.val) : null;
          const ntty = nt?.ntty || '';

          let txval = 0.0;
          let iamt = 0.0;
          let camt = 0.0;
          let samt = 0.0;
          let hasItems = false;

          for (const itm of nt?.itms || []) {
            const det = itm?.itm_det || itm;
            txval += Number(det?.txval || 0);
            iamt += Number(det?.iamt || 0);
            camt += Number(det?.camt || 0);
            samt += Number(det?.samt || 0);
            hasItems = true;
          }

          rows.push({
            invoice_no: ntNum,
            gstin: ctin,
            date: ntDt,
            taxable: hasItems ? txval : null,
            igst: hasItems ? iamt : null,
            cgst: hasItems ? camt : null,
            sgst: hasItems ? samt : null,
            total: val,
            section: `${sectionKey.toUpperCase()} (${ntty})`,
            pos: '',
            inv_typ: ntty
          });
        }
      }
    }
  }

  // 5. CDNUR & CDNURA
  for (const sectionKey of ['cdnur', 'cdnura']) {
    const section = obj[sectionKey];
    if (Array.isArray(section)) {
      for (const group of section) {
        const typ = group?.typ || 'URP';
        for (const nt of group?.nt || []) {
          const ntNum = String(nt?.nt_num || '').trim();
          const ntDt = nt?.nt_dt || '';
          const val = nt?.val != null ? Number(nt.val) : null;

          let txval = 0.0;
          let iamt = 0.0;
          let camt = 0.0;
          let samt = 0.0;
          let hasItems = false;

          for (const itm of nt?.itms || []) {
            const det = itm?.itm_det || itm;
            txval += Number(det?.txval || 0);
            iamt += Number(det?.iamt || 0);
            camt += Number(det?.camt || 0);
            samt += Number(det?.samt || 0);
            hasItems = true;
          }

          rows.push({
            invoice_no: ntNum,
            gstin: typ,
            date: ntDt,
            taxable: hasItems ? txval : null,
            igst: hasItems ? iamt : null,
            cgst: hasItems ? camt : null,
            sgst: hasItems ? samt : null,
            total: val,
            section: sectionKey.toUpperCase(),
            pos: '',
            inv_typ: typ
          });
        }
      }
    }
  }

  return rows.length > 0 ? rows : null;
}

export function genericJsonToFrames(obj: any): any[] {
  const found: { path: string; rows: any[] }[] = [];

  function walk(x: any, path = '') {
    if (x && typeof x === 'object' && !Array.isArray(x)) {
      for (const [k, v] of Object.entries(x)) {
        if (Array.isArray(v) && v.length > 0 && v.every(z => z && typeof z === 'object')) {
          const hasNested = v.some(item => Object.values(item).some(val => Array.isArray(val)));
          if (hasNested) {
            v.forEach((item, idx) => walk(item, `${path}/${k}[${idx}]`));
          } else {
            const simpleRows = v.map(item => {
              const row: Record<string, any> = {};
              for (const [kk, vv] of Object.entries(item as object)) {
                if (typeof vv !== 'object') {
                  row[kk] = vv;
                }
              }
              return row;
            });
            if (simpleRows.length > 0) {
              found.push({ path: `${path}/${k}`, rows: simpleRows });
            }
          }
        } else {
          walk(v, `${path}/${k}`);
        }
      }
    } else if (Array.isArray(x)) {
      x.forEach((v, i) => walk(v, `${path}/${i}`));
    }
  }

  walk(obj);

  if (found.length === 0) {
    throw new Error('No tabular invoice data found in JSON file. Please check file format.');
  }

  // Score candidate arrays based on invoice keywords and length
  function score(item: { rows: any[] }) {
    if (item.rows.length === 0) return 0;
    const cols = Object.keys(item.rows[0]).map(normCol).join(' ');
    const hasInv = ['inum', 'invoiceno', 'documentnumber', 'docno', 'billno'].some(a => cols.includes(a)) ? 1000 : 0;
    return hasInv + item.rows.length;
  }

  found.sort((a, b) => score(b) - score(a));
  return found[0].rows;
}

export function findHeaderRow(matrix: any[][]): { headers: string[]; rows: any[] } {
  const keywords = ['invoice', 'doc', 'bill', 'gstin', 'date', 'taxable', 'value', 'amount', 'total', 'rate', 'cgst', 'sgst', 'igst', 'eway', 'inum', 'ctin', 'txval'];

  let bestScore = 0;
  let bestIdx = 0;
  const maxCheck = Math.min(15, matrix.length);

  for (let idx = 0; idx < maxCheck; idx++) {
    const row = matrix[idx];
    if (!row || !Array.isArray(row)) continue;
    const rowStr = row.map(normCol).join(' ');
    const score = keywords.reduce((acc, kw) => acc + (rowStr.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx + 1; // 1-based index where headers are at bestIdx-1
    }
  }

  if (bestIdx > 0 && bestScore >= 2) {
    const headerRow = matrix[bestIdx - 1];
    const headers = headerRow.map((c, j) => {
      const s = String(c ?? '').trim();
      return s ? s : `col_${j}`;
    });

    const dataRows = matrix.slice(bestIdx).map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((h, j) => {
        obj[h] = row[j] !== undefined ? row[j] : null;
      });
      return obj;
    });

    return { headers, rows: dataRows };
  }

  // If no good header row detected, use first row or generate col_0...
  if (matrix.length > 0) {
    const firstRow = matrix[0];
    const headers = firstRow.map((c, j) => String(c ?? `col_${j}`).trim() || `col_${j}`);
    const dataRows = matrix.slice(1).map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((h, j) => {
        obj[h] = row[j] !== undefined ? row[j] : null;
      });
      return obj;
    });
    return { headers, rows: dataRows };
  }

  return { headers: [], rows: [] };
}

export async function parseUploadedFile(file: File): Promise<{ columns: string[]; rows: any[] }> {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (name.endsWith('.json')) {
    const text = new TextDecoder('utf-8').decode(buffer);
    const obj = JSON.parse(text);
    const parsedGstr = parseGstr1Json(obj);
    if (parsedGstr && parsedGstr.length > 0) {
      return {
        columns: Object.keys(parsedGstr[0]),
        rows: parsedGstr
      };
    }
    const genericRows = genericJsonToFrames(obj);
    return {
      columns: genericRows.length > 0 ? Object.keys(genericRows[0]) : [],
      rows: genericRows
    };
  }

  // For CSV or Excel (.xlsx, .xls)
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheetCandidates: { priority: number; rowCount: number; sheetName: string; rows: any[]; columns: string[] }[] = [];

  for (const sheetName of workbook.SheetNames) {
    try {
      const worksheet = workbook.Sheets[sheetName];
      const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (matrix.length === 0) continue;

      const { headers, rows } = findHeaderRow(matrix);
      if (headers.length === 0 || rows.length === 0) continue;

      const colsNorm = headers.map(normCol).join(' ');
      const hasInv = ['inum', 'invoiceno', 'documentnumber', 'docno', 'billno', 'invno'].some(a => colsNorm.includes(a));
      const sLower = sheetName.toLowerCase();
      const isInvSheet = ['b2b', 'b2ba', 'b2cl', 'cdnr', 'exp', 'invoice', 'outward', 'sheet1'].some(target => sLower.includes(target));
      const isSummary = ['b2cs', 'hsn', 'doc_issue', 'instructions', 'summary', 'master'].some(skip => sLower.includes(skip));

      let priority = 0;
      if (hasInv) priority += 10;
      if (isInvSheet) priority += 5;
      if (isSummary) priority -= 15;

      sheetCandidates.push({
        priority,
        rowCount: rows.length,
        sheetName,
        rows,
        columns: headers
      });
    } catch {
      // Continue to next sheet
    }
  }

  if (sheetCandidates.length === 0) {
    throw new Error('No usable data sheet found in the uploaded file.');
  }

  sheetCandidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.rowCount - a.rowCount;
  });

  const bestSheet = sheetCandidates[0];
  return {
    columns: bestSheet.columns,
    rows: bestSheet.rows
  };
}

export function parseDateObj(val: any): { formatted: string | null; dateObj: Date | null } {
  if (val == null || val === '') return { formatted: null, dateObj: null };

  let d: Date | null = null;

  if (val instanceof Date && !isNaN(val.getTime())) {
    d = val;
  } else if (typeof val === 'number' && val > 30000 && val < 60000) {
    // Excel serial number
    d = new Date(Math.round((val - 25569) * 86400 * 1000));
  } else {
    const str = String(val).trim();
    // Check if string is numeric Excel serial
    if (/^\d{5}(\.\d+)?$/.test(str)) {
      const num = parseFloat(str);
      if (num > 30000 && num < 60000) {
        d = new Date(Math.round((num - 25569) * 86400 * 1000));
      }
    }

    if (!d) {
      // DD-MM-YYYY or DD/MM/YYYY (may have timestamp like 15-05-2024 14:30:00)
      const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (dmy) {
        d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
      } else {
        // YYYY-MM-DD
        const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (ymd) {
          d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
        } else {
          const direct = new Date(str);
          if (!isNaN(direct.getTime())) {
            d = direct;
          }
        }
      }
    }
  }

  if (d && !isNaN(d.getTime())) {
    const normalized = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return {
      formatted: `${dd}-${mm}-${yyyy}`,
      dateObj: normalized
    };
  }

  return { formatted: String(val).trim() || null, dateObj: null };
}

export function parseDate(val: any): string | null {
  return parseDateObj(val).formatted;
}

export function simplifyInvoiceNo(val: any): string {
  if (val == null) return '';
  return String(val)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^0+/, '');
}

export function parseNumber(val: any): number {
  if (val == null) return 0.0;
  if (typeof val === 'number') return isNaN(val) ? 0.0 : val;
  const cleaned = String(val)
    .replace(/[₹, \s]/g, '')
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0.0 : num;
}

