export const SAMPLE_GSTR1_DATA = {
  columns: ['Invoice No', 'Receiver GSTIN', 'Invoice Date', 'Taxable Value', 'IGST Amount', 'CGST Amount', 'SGST Amount', 'Total Invoice Value'],
  rows: [
    {
      'Invoice No': 'INV-2024-001',
      'Receiver GSTIN': '27AAPFU0939F1ZV',
      'Invoice Date': '15-05-2024',
      'Taxable Value': 150000,
      'IGST Amount': 27000,
      'CGST Amount': 0,
      'SGST Amount': 0,
      'Total Invoice Value': 177000,
    },
    {
      'Invoice No': 'INV-2024-002',
      'Receiver GSTIN': '07AAGCB1234A1Z5',
      'Invoice Date': '18-05-2024',
      'Taxable Value': 80000,
      'IGST Amount': 0,
      'CGST Amount': 7200,
      'SGST Amount': 7200,
      'Total Invoice Value': 94400,
    },
    {
      // Date is 20-05-2024, EWB is 21-05-2024 (1 day gap - matches when date tolerance >= 1)
      'Invoice No': 'INV-2024-003',
      'Receiver GSTIN': '29ABCDE5678F1Z9',
      'Invoice Date': '20-05-2024',
      'Taxable Value': 210000,
      'IGST Amount': 37800,
      'CGST Amount': 0,
      'SGST Amount': 0,
      'Total Invoice Value': 247800,
    },
    {
      'Invoice No': 'INV-2024-004',
      'Receiver GSTIN': '33AABCT9999K1Z1',
      'Invoice Date': '22-05-2024',
      'Taxable Value': 45000,
      'IGST Amount': 8100,
      'CGST Amount': 0,
      'SGST Amount': 0,
      'Total Invoice Value': 53100,
    },
    {
      // Missing in EWB and Value > 50k -> "E-Way Bill Not Found"
      'Invoice No': 'INV-2024-005',
      'Receiver GSTIN': '27AAPFU0939F1ZV',
      'Invoice Date': '25-05-2024',
      'Taxable Value': 120000,
      'IGST Amount': 21600,
      'CGST Amount': 0,
      'SGST Amount': 0,
      'Total Invoice Value': 141600,
    },
    {
      // Invoice format variation: INV/2024/006 in GSTR-1 vs INV-2024-006 in EWB
      'Invoice No': 'INV/2024/006',
      'Receiver GSTIN': '06AAACR5544B1Z3',
      'Invoice Date': '28-05-2024',
      'Taxable Value': 350000,
      'IGST Amount': 63000,
      'CGST Amount': 0,
      'SGST Amount': 0,
      'Total Invoice Value': 413000,
    },
    {
      // Duplicate key test
      'Invoice No': 'INV-2024-007',
      'Receiver GSTIN': '27AAPFU0939F1ZV',
      'Invoice Date': '30-05-2024',
      'Taxable Value': 50000,
      'IGST Amount': 9000,
      'CGST Amount': 0,
      'SGST Amount': 0,
      'Total Invoice Value': 59000,
    },
    {
      'Invoice No': 'INV-2024-007',
      'Receiver GSTIN': '27AAPFU0939F1ZV',
      'Invoice Date': '30-05-2024',
      'Taxable Value': 50000,
      'IGST Amount': 9000,
      'CGST Amount': 0,
      'SGST Amount': 0,
      'Total Invoice Value': 59000,
    },
    {
      // Missing in EWB but Value < 50,000 -> "E-Way Bill Not Required (< ₹50k)"
      'Invoice No': 'INV-2024-008',
      'Receiver GSTIN': '27AAPFU0939F1ZV',
      'Invoice Date': '31-05-2024',
      'Taxable Value': 32000,
      'IGST Amount': 5760,
      'CGST Amount': 0,
      'SGST Amount': 0,
      'Total Invoice Value': 37760,
    }
  ]
};

export const SAMPLE_EWB_DATA = {
  columns: ['Doc No', 'To GSTIN', 'Doc Date', 'Taxable Amt', 'IGST Amt', 'CGST Amt', 'SGST Amt', 'Total Value'],
  rows: [
    {
      // Exact Match
      'Doc No': 'INV-2024-001',
      'To GSTIN': '27AAPFU0939F1ZV',
      'Doc Date': '15-05-2024',
      'Taxable Amt': 150000,
      'IGST Amt': 27000,
      'CGST Amt': 0,
      'SGST Amt': 0,
      'Total Value': 177000,
    },
    {
      // Value & Tax difference
      'Doc No': 'INV-2024-002',
      'To GSTIN': '07AAGCB1234A1Z5',
      'Doc Date': '18-05-2024',
      'Taxable Amt': 82000,
      'IGST Amt': 0,
      'CGST Amt': 7380,
      'SGST Amt': 7380,
      'Total Value': 96760,
    },
    {
      // Date is 21-05-2024 (1 day variance)
      'Doc No': 'INV-2024-003',
      'To GSTIN': '29ABCDE5678F1Z9',
      'Doc Date': '21-05-2024',
      'Taxable Amt': 210000,
      'IGST Amt': 37800,
      'CGST Amt': 0,
      'SGST Amt': 0,
      'Total Value': 247800,
    },
    {
      // Match (INV-2024-004)
      'Doc No': 'INV-2024-004',
      'To GSTIN': '33AABCT9999K1Z1',
      'Doc Date': '22-05-2024',
      'Taxable Amt': 45000,
      'IGST Amt': 8100,
      'CGST Amt': 0,
      'SGST Amt': 0,
      'Total Value': 53100,
    },
    // INV-2024-005 is omitted in EWB and > 50k -> "E-Way Bill Not Found"
    {
      // Matched via simplified number (INV-2024-006 vs INV/2024/006)
      'Doc No': 'INV-2024-006',
      'To GSTIN': '06AAACR5544B1Z3',
      'Doc Date': '28-05-2024',
      'Taxable Amt': 350000,
      'IGST Amt': 63000,
      'CGST Amt': 0,
      'SGST Amt': 0,
      'Total Value': 413000,
    },
    {
      // Duplicate in GSTR-1
      'Doc No': 'INV-2024-007',
      'To GSTIN': '27AAPFU0939F1ZV',
      'Doc Date': '30-05-2024',
      'Taxable Amt': 50000,
      'IGST Amt': 9000,
      'CGST Amt': 0,
      'SGST Amt': 0,
      'Total Value': 59000,
    },
    {
      // Extra E-Way Bill (not in GSTR-1)
      'Doc No': 'INV-2024-099',
      'To GSTIN': '24AAACH7788C1Z6',
      'Doc Date': '12-05-2024',
      'Taxable Amt': 195000,
      'IGST Amt': 35100,
      'CGST Amt': 0,
      'SGST Amt': 0,
      'Total Value': 230100,
    },
    {
      // Another Extra E-Way Bill
      'Doc No': 'INV-2024-100',
      'To GSTIN': '19AAACA0000A1Z5',
      'Doc Date': '14-05-2024',
      'Taxable Amt': 67000,
      'IGST Amt': 12060,
      'CGST Amt': 0,
      'SGST Amt': 0,
      'Total Value': 79060,
    }
  ]
};
