import * as XLSX from 'xlsx';
import { ColumnMapping, DateToleranceOption, ReconciliationItem, StandardInvoiceRow } from '../types/reconciliation';
import { findCol, parseDateObj, parseNumber, simplifyInvoiceNo } from './fileParser';

export function standardize(
  rows: any[],
  columns: string[],
  label: 'GSTR-1' | 'E-Way Bill',
  customMapping?: Partial<ColumnMapping>
): { standardized: StandardInvoiceRow[]; mapping: ColumnMapping } {
  const mapping: ColumnMapping = {
    invoice_no: customMapping?.invoice_no ?? findCol(columns, 'invoice_no', label),
    gstin: customMapping?.gstin ?? findCol(columns, 'gstin', label),
    date: customMapping?.date ?? findCol(columns, 'date', label),
    taxable: customMapping?.taxable ?? findCol(columns, 'taxable', label),
    igst: customMapping?.igst ?? findCol(columns, 'igst', label),
    cgst: customMapping?.cgst ?? findCol(columns, 'cgst', label),
    sgst: customMapping?.sgst ?? findCol(columns, 'sgst', label),
    total: customMapping?.total ?? findCol(columns, 'total', label),
  };

  const stdRows: StandardInvoiceRow[] = rows.map((row, idx) => {
    const rawInv = mapping.invoice_no && row[mapping.invoice_no] != null ? String(row[mapping.invoice_no]) : '';
    const cleanInv = rawInv.trim().toUpperCase().replace(/\s+/g, '');
    const cleanInvSimplified = simplifyInvoiceNo(cleanInv);

    const rawGstin = mapping.gstin && row[mapping.gstin] != null ? String(row[mapping.gstin]) : '';
    const cleanGstin = rawGstin.trim().toUpperCase();

    const rawDate = mapping.date ? row[mapping.date] : null;
    const { formatted: formattedDate, dateObj: parsedDate } = parseDateObj(rawDate);

    const taxable = mapping.taxable ? parseNumber(row[mapping.taxable]) : 0.0;
    const igst = mapping.igst ? parseNumber(row[mapping.igst]) : 0.0;
    const cgst = mapping.cgst ? parseNumber(row[mapping.cgst]) : 0.0;
    const sgst = mapping.sgst ? parseNumber(row[mapping.sgst]) : 0.0;
    const total = mapping.total ? parseNumber(row[mapping.total]) : 0.0;

    return {
      invoice_no: cleanInv,
      clean_inv_no: cleanInvSimplified,
      gstin: cleanGstin,
      date: formattedDate,
      parsed_date: parsedDate,
      taxable,
      igst,
      cgst,
      sgst,
      total,
      source_row: idx + 2,
      source: label,
      section: row.section,
      pos: row.pos,
      inv_typ: row.inv_typ
    };
  });

  // If GSTR-1, aggregate multi-item rows for the same invoice
  if (label === 'GSTR-1' && stdRows.length > 0) {
    const validRows = stdRows.filter(r => r.invoice_no !== '' && r.invoice_no !== 'NAN');
    const invalidRows = stdRows.filter(r => r.invoice_no === '' || r.invoice_no === 'NAN');

    const groupedMap = new Map<string, StandardInvoiceRow[]>();
    for (const r of validRows) {
      const gKey = `${r.gstin}|${r.invoice_no}`;
      if (!groupedMap.has(gKey)) {
        groupedMap.set(gKey, []);
      }
      groupedMap.get(gKey)!.push(r);
    }

    const aggregated: StandardInvoiceRow[] = [];
    for (const [, list] of groupedMap.entries()) {
      const first = list[0];
      const sumTaxable = list.reduce((acc, x) => acc + x.taxable, 0);
      const sumIgst = list.reduce((acc, x) => acc + x.igst, 0);
      const sumCgst = list.reduce((acc, x) => acc + x.cgst, 0);
      const sumSgst = list.reduce((acc, x) => acc + x.sgst, 0);

      const uniqueTotals = Array.from(new Set(list.map(x => x.total)));
      let computedTotal = (uniqueTotals.length === 1 && uniqueTotals[0] > 0)
        ? uniqueTotals[0]
        : Math.max(...list.map(x => x.total));

      if (computedTotal <= 0) {
        computedTotal = sumTaxable + sumIgst + sumCgst + sumSgst;
      }

      const rowNums = list.map(x => x.source_row).join(', ');

      aggregated.push({
        invoice_no: first.invoice_no,
        clean_inv_no: first.clean_inv_no,
        gstin: first.gstin,
        date: first.date,
        parsed_date: first.parsed_date,
        taxable: sumTaxable,
        igst: sumIgst,
        cgst: sumCgst,
        sgst: sumSgst,
        total: computedTotal,
        source_row: rowNums,
        source: 'GSTR-1',
        section: first.section,
        pos: first.pos,
        inv_typ: first.inv_typ
      });
    }

    return { standardized: [...aggregated, ...invalidRows], mapping };
  }

  return { standardized: stdRows, mapping };
}

export function makeKey(row: StandardInvoiceRow): string {
  const g = (row.gstin || '').toLowerCase();
  const prefix = (row.gstin && !['nan', 'urp', 'exp', ''].includes(g)) ? `${row.gstin}|` : '';
  return prefix + row.invoice_no;
}

export function reconcile(
  gstrRows: StandardInvoiceRow[],
  ewbRows: StandardInvoiceRow[],
  tolerance = 1.0,
  dateToleranceDays: DateToleranceOption = 0,
  ewbExemptionThreshold = 50000
): ReconciliationItem[] {
  const g = gstrRows
    .filter(r => r.invoice_no !== '')
    .map(r => ({ ...r, key: makeKey(r) }));

  const e = ewbRows
    .filter(r => r.invoice_no !== '')
    .map(r => ({ ...r, key: makeKey(r) }));

  // Track duplicated keys within GSTR-1
  const gKeyCounts = new Map<string, number>();
  for (const r of g) {
    gKeyCounts.set(r.key, (gKeyCounts.get(r.key) || 0) + 1);
  }
  const gDuplicates = new Set<string>();
  for (const [k, count] of gKeyCounts.entries()) {
    if (count > 1) gDuplicates.add(k);
  }

  // Available E-Way Bills (with original index for unambiguous matching)
  interface EwbIndexedItem {
    row: StandardInvoiceRow & { key: string };
    index: number;
    matched: boolean;
  }

  const ewbItems: EwbIndexedItem[] = e.map((row, idx) => ({
    row,
    index: idx,
    matched: false,
  }));

  const rows: ReconciliationItem[] = [];

  for (const gr of g) {
    const isGDuplicate = gDuplicates.has(gr.key);

    // Multi-tiered search for corresponding E-Way bill:
    let matchedEwbItem: EwbIndexedItem | null = null;

    // Strategy 1: Exact Key (GSTIN + Invoice No)
    const exactKeyMatches = ewbItems.filter(item => !item.matched && item.row.key === gr.key);
    if (exactKeyMatches.length > 0) {
      // Pick best amount match if multiple
      matchedEwbItem = exactKeyMatches.reduce((best, cur) => {
        const curDiff = Math.abs(cur.row.total - gr.total);
        const bestDiff = Math.abs(best.row.total - gr.total);
        return curDiff < bestDiff ? cur : best;
      }, exactKeyMatches[0]);
    }

    // Strategy 2: Exact GSTIN + Clean Simplified Invoice No (e.g. INV-001 vs INV/001)
    if (!matchedEwbItem && gr.gstin && !['urp', 'exp', 'nan', ''].includes(gr.gstin.toLowerCase())) {
      const gstinSimplifiedMatches = ewbItems.filter(
        item => !item.matched &&
          item.row.gstin === gr.gstin &&
          item.row.clean_inv_no &&
          gr.clean_inv_no &&
          item.row.clean_inv_no === gr.clean_inv_no
      );
      if (gstinSimplifiedMatches.length > 0) {
        matchedEwbItem = gstinSimplifiedMatches[0];
      }
    }

    // Strategy 3: Invoice Number Match (exact string)
    if (!matchedEwbItem) {
      const invMatches = ewbItems.filter(item => !item.matched && item.row.invoice_no === gr.invoice_no);
      if (invMatches.length > 0) {
        // Prefer one where GSTIN matches or is empty, or closest amount
        matchedEwbItem = invMatches.reduce((best, cur) => {
          const curGstinMatch = cur.row.gstin === gr.gstin;
          const bestGstinMatch = best.row.gstin === gr.gstin;
          if (curGstinMatch && !bestGstinMatch) return cur;
          if (!curGstinMatch && bestGstinMatch) return best;
          const curDiff = Math.abs(cur.row.total - gr.total);
          const bestDiff = Math.abs(best.row.total - gr.total);
          return curDiff < bestDiff ? cur : best;
        }, invMatches[0]);
      }
    }

    // Strategy 4: Simplified Invoice Number Match (stripping -, /, leading zeros)
    if (!matchedEwbItem && gr.clean_inv_no) {
      const simplifiedMatches = ewbItems.filter(
        item => !item.matched && item.row.clean_inv_no === gr.clean_inv_no
      );
      if (simplifiedMatches.length > 0) {
        matchedEwbItem = simplifiedMatches.reduce((best, cur) => {
          const curDiff = Math.abs(cur.row.total - gr.total);
          const bestDiff = Math.abs(best.row.total - gr.total);
          return curDiff < bestDiff ? cur : best;
        }, simplifiedMatches[0]);
      }
    }

    let status: ReconciliationItem['Status'];
    let reason = '';
    let er: StandardInvoiceRow | null = null;

    if (isGDuplicate) {
      status = 'Review - Duplicate';
      reason = 'Duplicate invoice number & GSTIN detected in GSTR-1';
      if (matchedEwbItem) {
        matchedEwbItem.matched = true;
        er = matchedEwbItem.row;
      }
    } else if (!matchedEwbItem) {
      // E-Way Bill Not Found in uploaded report
      // Check Rule 138: Under GST, E-Way Bill is NOT required if invoice value is below ₹50,000!
      const invoiceVal = gr.total > 0 ? gr.total : gr.taxable;
      if (invoiceVal > 0 && invoiceVal < ewbExemptionThreshold) {
        status = 'E-Way Bill Not Required (< ₹50k)';
        reason = `Invoice value (₹${invoiceVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) is below ₹${ewbExemptionThreshold.toLocaleString('en-IN')}; E-Way Bill is not legally mandatory under GST rules.`;
      } else {
        status = 'E-Way Bill Not Found';
        reason = `No corresponding invoice found in E-Way Bill report (Invoice value ₹${invoiceVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })} requires E-Way Bill).`;
      }
    } else {
      matchedEwbItem.matched = true;
      er = matchedEwbItem.row;
      const diffs: string[] = [];
      let dayDiff: number | null = null;

      // 1. Date comparison with tolerance
      if (dateToleranceDays !== -1) {
        if (gr.parsed_date && er.parsed_date) {
          dayDiff = Math.round(Math.abs(gr.parsed_date.getTime() - er.parsed_date.getTime()) / 86400000);
          if (dayDiff > dateToleranceDays) {
            diffs.push(`Date mismatch (GSTR-1: ${gr.date} vs EWB: ${er.date}, gap: ${dayDiff} day${dayDiff > 1 ? 's' : ''})`);
          }
        } else if (gr.date && er.date && gr.date !== er.date && dateToleranceDays === 0) {
          diffs.push(`Date mismatch (GSTR-1: ${gr.date} vs EWB: ${er.date})`);
        }
      }

      // 2. Total Invoice Value comparison
      const hasGrTotal = gr.total > 0;
      const hasErTotal = er.total > 0;
      if (hasGrTotal && hasErTotal) {
        const totalDiff = Math.abs(gr.total - er.total);
        if (totalDiff > tolerance) {
          diffs.push(`Invoice value diff: ₹${totalDiff.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (GSTR-1: ₹${gr.total.toLocaleString('en-IN')} vs EWB: ₹${er.total.toLocaleString('en-IN')})`);
        }
      }

      // 3. Taxable Value comparison
      const hasGrTaxable = gr.taxable > 0;
      const hasErTaxable = er.taxable > 0;
      if (hasGrTaxable && hasErTaxable) {
        const taxDiff = Math.abs(gr.taxable - er.taxable);
        if (taxDiff > tolerance) {
          diffs.push(`Taxable value diff: ₹${taxDiff.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (GSTR-1: ₹${gr.taxable.toLocaleString('en-IN')} vs EWB: ₹${er.taxable.toLocaleString('en-IN')})`);
        }
      }

      // 4. Tax components (IGST, CGST, SGST)
      // Note: Only compare if BOTH files have non-zero values for this specific tax header
      // (because many E-Way Bill portal exports only contain Total Invoice Value or aggregate tax).
      const taxComponents: Array<{ key: 'igst' | 'cgst' | 'sgst'; title: string }> = [
        { key: 'igst', title: 'IGST' },
        { key: 'cgst', title: 'CGST' },
        { key: 'sgst', title: 'SGST' }
      ];

      for (const { key, title } of taxComponents) {
        const a = gr[key];
        const b = er[key];
        if (a > 0 && b > 0) {
          const compDiff = Math.abs(a - b);
          if (compDiff > tolerance) {
            diffs.push(`${title} diff: ₹${compDiff.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
          }
        }
      }

      if (diffs.length > 0) {
        status = 'Unmatched';
        reason = diffs.join('; ');
      } else {
        status = 'Matched';
        if (dayDiff != null && dayDiff > 0 && dateToleranceDays > 0) {
          reason = `Exact match within tolerance (Date gap of ${dayDiff} day${dayDiff > 1 ? 's' : ''} permitted)`;
        } else {
          reason = 'Exact match within tolerance limit';
        }
      }
    }

    rows.push({
      'Status': status,
      'Reason': reason,
      'Invoice No.': gr.invoice_no,
      'GSTIN': gr.gstin,
      'GSTR-1 Date': gr.date,
      'E-Way Bill Date': er ? er.date : null,
      'GSTR-1 Taxable': gr.taxable,
      'EWB Taxable': er ? er.taxable : null,
      'GSTR-1 IGST': gr.igst,
      'EWB IGST': er ? er.igst : null,
      'GSTR-1 CGST': gr.cgst,
      'EWB CGST': er ? er.cgst : null,
      'GSTR-1 SGST': gr.sgst,
      'EWB SGST': er ? er.sgst : null,
      'GSTR-1 Invoice Value': gr.total,
      'EWB Invoice Value': er ? er.total : null,
      'GSTR-1 Source Row': gr.source_row,
      'EWB Source Row': er ? er.source_row : null,
    });
  }

  // Extra E-Way Bills (in EWB file but never matched to any GSTR-1 invoice)
  for (const item of ewbItems) {
    if (!item.matched) {
      const er = item.row;
      rows.push({
        'Status': 'Extra E-Way Bill',
        'Reason': 'Invoice exists in E-Way Bill report but not in GSTR-1 outward filing',
        'Invoice No.': er.invoice_no,
        'GSTIN': er.gstin,
        'GSTR-1 Date': null,
        'E-Way Bill Date': er.date,
        'GSTR-1 Taxable': null,
        'EWB Taxable': er.taxable,
        'GSTR-1 IGST': null,
        'EWB IGST': er.igst,
        'GSTR-1 CGST': null,
        'EWB CGST': er.cgst,
        'GSTR-1 SGST': null,
        'EWB SGST': er.sgst,
        'GSTR-1 Invoice Value': null,
        'EWB Invoice Value': er.total,
        'GSTR-1 Source Row': null,
        'EWB Source Row': er.source_row,
      });
    }
  }

  return rows;
}

export function exportReconciliationToExcel(items: ReconciliationItem[]) {
  const wb = XLSX.utils.book_new();

  // 1. All Reconciliation
  const allWs = XLSX.utils.json_to_sheet(items);
  XLSX.utils.book_append_sheet(wb, allWs, 'All Reconciliation');

  // 2. Sub sheets for each key compliance category
  const sheets: Array<{ status: ReconciliationItem['Status']; sheetName: string }> = [
    { status: 'Matched', sheetName: 'Matched' },
    { status: 'Unmatched', sheetName: 'Unmatched' },
    { status: 'E-Way Bill Not Found', sheetName: 'EWB Missing (>50k)' },
    { status: 'E-Way Bill Not Required (< ₹50k)', sheetName: 'EWB Not Required (<50k)' },
    { status: 'Extra E-Way Bill', sheetName: 'Extra EWB' },
    { status: 'Review - Duplicate', sheetName: 'Review' },
  ];

  for (const { status, sheetName } of sheets) {
    const filtered = items.filter(x => x.Status === status);
    if (filtered.length > 0) {
      const ws = XLSX.utils.json_to_sheet(filtered);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  }

  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const filename = `GST_EWB_Reconciliation_${timestamp}.xlsx`;

  XLSX.writeFile(wb, filename);
}
