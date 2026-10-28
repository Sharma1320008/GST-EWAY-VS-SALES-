import json
import re
from io import BytesIO
from datetime import datetime
import pandas as pd
import streamlit as st

st.set_page_config(page_title="GST Reconciliation Pro", page_icon="📊", layout="wide")

st.markdown("""
<style>
.block-container {padding-top: 1.4rem; padding-bottom: 2rem;}
div[data-testid="stMetric"] {background:#f5f7fb; border:1px solid #e4e8f0; padding:14px; border-radius:12px;}
.small-note {color:#5b6472; font-size:0.9rem;}
</style>
""", unsafe_allow_html=True)

st.title("GST Reconciliation Pro")
st.caption("E-Way Bill vs GSTR-1 • Invoice-wise reconciliation dashboard")
st.info("Upload your GSTR-1 (JSON / Excel) and E-Way Bill (Excel / CSV) reports below to run automated invoice-level reconciliation.")

def norm_col(c):
    return re.sub(r'[^a-z0-9]', '', str(c).lower())

ALIASES = {
    "invoice_no": [
        "invoiceno", "invoicenumber", "documentnumber", "docno", "docnumber",
        "documentno", "billno", "billnumber", "invno", "inum", "invnum",
        "docnum", "challanno", "ebillno"
    ],
    "gstin": [
        "gstin", "gstinofrecipient", "gstinuin", "suppliergstin", "gstinofsupplier",
        "ctin", "togstin", "fromgstin", "recipientgstin", "receivergstin",
        "consigneegstin", "buyergstin", "gstinuinofrecipient", "gstinnumber"
    ],
    "date": [
        "invoicedate", "documentdate", "docdate", "date", "billdate", "invdate",
        "idt", "docdt", "invdt", "documentdt"
    ],
    "taxable": [
        "taxablevalue", "taxableamount", "assessablevalue", "taxable", "txval",
        "taxableamt", "totaltaxablevalue", "assessableamt", "totaltaxableamount"
    ],
    "igst": [
        "igst", "igstamount", "iamt", "integratedtax", "integratedtaxamount",
        "igstamt", "integratedtaxamt"
    ],
    "cgst": [
        "cgst", "cgstamount", "camt", "centraltax", "centraltaxamount",
        "cgstamt", "centraltaxamt"
    ],
    "sgst": [
        "sgst", "sgstamount", "samt", "statetax", "statetaxamount",
        "sgstamt", "statetaxamt", "utgst", "utgstamount", "utamt"
    ],
    "total": [
        "invoicevalue", "invoiceamount", "totalinvoicevalue", "totalvalue",
        "billamount", "totalamount", "val", "totinvval", "totinvvalue",
        "totaldocvalue", "documentvalue", "totalinvamount", "grandtotal"
    ],
}

def find_col(df, key):
    norms = {norm_col(c): c for c in df.columns}
    for alias in ALIASES.get(key, []):
        if alias in norms:
            return norms[alias]
    for n, original in norms.items():
        if any(alias in n for alias in ALIASES.get(key, []) if len(alias) > 3):
            return original
    return None

def parse_gstr1_json(obj):
    """
    Parses standard GSTR-1 JSON downloaded from GST Portal.
    Extracts all invoice-bearing sections (B2B, B2BA, B2CL, B2CLA, EXP, EXPA, CDNR, CDNRA, CDNUR).
    Sums multi-rate items (itms) under each invoice.
    """
    rows = []
    
    # 1. B2B & B2BA (B2B Regular, SEZ, Deemed Exports & Amendments)
    for section_key in ["b2b", "b2ba"]:
        for group in obj.get(section_key, []):
            ctin = group.get("ctin", "")
            for inv in group.get("inv", []):
                inum = str(inv.get("inum", "")).strip()
                idt = inv.get("idt", "")
                val = inv.get("val", None)
                inv_typ = inv.get("inv_typ", "")
                pos = inv.get("pos", "")
                
                txval, iamt, camt, samt = 0.0, 0.0, 0.0, 0.0
                has_items = False
                for itm in inv.get("itms", []):
                    det = itm.get("itm_det", itm)
                    txval += float(det.get("txval", 0) or 0)
                    iamt += float(det.get("iamt", 0) or 0)
                    camt += float(det.get("camt", 0) or 0)
                    samt += float(det.get("samt", 0) or 0)
                    has_items = True
                
                rows.append({
                    "invoice_no": inum,
                    "gstin": ctin,
                    "date": idt,
                    "taxable": txval if has_items else None,
                    "igst": iamt if has_items else None,
                    "cgst": camt if has_items else None,
                    "sgst": samt if has_items else None,
                    "total": val,
                    "section": section_key.upper(),
                    "pos": pos,
                    "inv_typ": inv_typ
                })

    # 2. B2CL & B2CLA (B2C Large Invoices & Amendments)
    for section_key in ["b2cl", "b2cla"]:
        for group in obj.get(section_key, []):
            pos = group.get("pos", "")
            for inv in group.get("inv", []):
                inum = str(inv.get("inum", "")).strip()
                idt = inv.get("idt", "")
                val = inv.get("val", None)
                
                txval, iamt = 0.0, 0.0
                has_items = False
                for itm in inv.get("itms", []):
                    det = itm.get("itm_det", itm)
                    txval += float(det.get("txval", 0) or 0)
                    iamt += float(det.get("iamt", 0) or 0)
                    has_items = True
                
                rows.append({
                    "invoice_no": inum,
                    "gstin": "URP",
                    "date": idt,
                    "taxable": txval if has_items else None,
                    "igst": iamt if has_items else None,
                    "cgst": 0.0,
                    "sgst": 0.0,
                    "total": val,
                    "section": section_key.upper(),
                    "pos": pos,
                    "inv_typ": "B2CL"
                })

    # 3. EXP & EXPA (Exports)
    for section_key in ["exp", "expa"]:
        for group in obj.get(section_key, []):
            exp_typ = group.get("exp_typ", "")
            for inv in group.get("inv", []):
                inum = str(inv.get("inum", "")).strip()
                idt = inv.get("idt", "")
                val = inv.get("val", None)
                
                txval, iamt = 0.0, 0.0
                has_items = False
                for itm in inv.get("itms", []):
                    det = itm.get("itm_det", itm)
                    txval += float(det.get("txval", 0) or 0)
                    iamt += float(det.get("iamt", 0) or 0)
                    has_items = True
                
                rows.append({
                    "invoice_no": inum,
                    "gstin": "EXP",
                    "date": idt,
                    "taxable": txval if has_items else None,
                    "igst": iamt if has_items else None,
                    "cgst": 0.0,
                    "sgst": 0.0,
                    "total": val,
                    "section": section_key.upper(),
                    "pos": "",
                    "inv_typ": exp_typ
                })

    # 4. CDNR & CDNRA (Credit/Debit Notes Registered)
    for section_key in ["cdnr", "cdnra"]:
        for group in obj.get(section_key, []):
            ctin = group.get("ctin", "")
            for nt in group.get("nt", []):
                nt_num = str(nt.get("nt_num", "")).strip()
                nt_dt = nt.get("nt_dt", "")
                val = nt.get("val", None)
                ntty = nt.get("ntty", "")
                
                txval, iamt, camt, samt = 0.0, 0.0, 0.0, 0.0
                has_items = False
                for itm in nt.get("itms", []):
                    det = itm.get("itm_det", itm)
                    txval += float(det.get("txval", 0) or 0)
                    iamt += float(det.get("iamt", 0) or 0)
                    camt += float(det.get("camt", 0) or 0)
                    samt += float(det.get("samt", 0) or 0)
                    has_items = True
                
                rows.append({
                    "invoice_no": nt_num,
                    "gstin": ctin,
                    "date": nt_dt,
                    "taxable": txval if has_items else None,
                    "igst": iamt if has_items else None,
                    "cgst": camt if has_items else None,
                    "sgst": samt if has_items else None,
                    "total": val,
                    "section": f"{section_key.upper()} ({ntty})",
                    "pos": "",
                    "inv_typ": ntty
                })

    # 5. CDNUR & CDNURA (Credit/Debit Notes Unregistered)
    for section_key in ["cdnur", "cdnura"]:
        for group in obj.get(section_key, []):
            typ = group.get("typ", "URP")
            for nt in group.get("nt", []):
                nt_num = str(nt.get("nt_num", "")).strip()
                nt_dt = nt.get("nt_dt", "")
                val = nt.get("val", None)
                
                txval, iamt, camt, samt = 0.0, 0.0, 0.0, 0.0
                has_items = False
                for itm in nt.get("itms", []):
                    det = itm.get("itm_det", itm)
                    txval += float(det.get("txval", 0) or 0)
                    iamt += float(det.get("iamt", 0) or 0)
                    camt += float(det.get("camt", 0) or 0)
                    samt += float(det.get("samt", 0) or 0)
                    has_items = True
                
                rows.append({
                    "invoice_no": nt_num,
                    "gstin": typ,
                    "date": nt_dt,
                    "taxable": txval if has_items else None,
                    "igst": iamt if has_items else None,
                    "cgst": camt if has_items else None,
                    "sgst": samt if has_items else None,
                    "total": val,
                    "section": section_key.upper(),
                    "pos": "",
                    "inv_typ": typ
                })

    if rows:
        return pd.DataFrame(rows)
    return None

def generic_json_to_frames(obj):
    found = []
    def walk(x, path=""):
        if isinstance(x, dict):
            for k, v in x.items():
                if isinstance(v, list) and v and all(isinstance(z, dict) for z in v):
                    has_nested = any(any(isinstance(val, list) for val in item.values()) for item in v)
                    if has_nested:
                        for idx, item in enumerate(v):
                            walk(item, f"{path}/{k}[{idx}]")
                    else:
                        rows = []
                        for item in v:
                            row = {}
                            for kk, vv in item.items():
                                if not isinstance(vv, (list, dict)):
                                    row[kk] = vv
                            rows.append(row)
                        if rows:
                            found.append((f"{path}/{k}", pd.DataFrame(rows)))
                else:
                    walk(v, f"{path}/{k}")
        elif isinstance(x, list):
            for i, v in enumerate(x):
                walk(v, f"{path}/{i}")
                
    walk(obj)
    if not found:
        raise ValueError("JSON mein tabular invoice data nahi mila. Please check file format.")
        
    def score(item):
        _, df = item
        cols = " ".join(norm_col(c) for c in df.columns)
        has_inv = int(any(a in cols for a in ["inum", "invoiceno", "documentnumber", "docno", "billno"]))
        return (has_inv, len(df), len(df.columns))
        
    found.sort(key=score, reverse=True)
    return found[0][1]

def find_header_row(df_raw):
    keywords = ["invoice", "doc", "bill", "gstin", "date", "taxable", "value", "amount", "total", "rate", "cgst", "sgst", "igst", "eway", "inum", "ctin", "txval"]
    col_str = " ".join(norm_col(c) for c in df_raw.columns)
    best_score = sum(1 for kw in keywords if kw in col_str)
    best_idx = 0
    
    max_check = min(15, len(df_raw))
    for idx in range(max_check):
        row_str = " ".join(norm_col(val) for val in df_raw.iloc[idx].dropna())
        score = sum(1 for kw in keywords if kw in row_str)
        if score > best_score:
            best_score = score
            best_idx = idx + 1
            
    if best_idx > 0 and best_score >= 2:
        header_vals = df_raw.iloc[best_idx - 1]
        new_df = df_raw.iloc[best_idx:].copy()
        new_df.columns = [str(c).strip() if pd.notna(c) and str(c).strip() != "" else f"col_{j}" for j, c in enumerate(header_vals)]
        return new_df.reset_index(drop=True)
    return df_raw

def read_upload(upload, is_gstr=False):
    name = upload.name.lower()
    data = upload.getvalue()
    
    if name.endswith(".json"):
        obj = json.load(BytesIO(data))
        df_parsed = parse_gstr1_json(obj)
        if df_parsed is not None and not df_parsed.empty:
            return df_parsed
        return generic_json_to_frames(obj)
        
    if name.endswith(".csv"):
        df_raw = pd.read_csv(BytesIO(data), dtype=str)
        return find_header_row(df_raw)
        
    book = pd.ExcelFile(BytesIO(data))
    sheet_candidates = []
    
    for sh in book.sheet_names:
        try:
            d = pd.read_excel(book, sheet_name=sh, dtype=str)
            if not d.empty:
                d_clean = find_header_row(d)
                cols = " ".join(norm_col(c) for c in d_clean.columns)
                has_inv = any(a in cols for a in ["inum", "invoiceno", "documentnumber", "docno", "billno", "invno"])
                is_inv_sheet = any(target in sh.lower() for target in ["b2b", "b2ba", "b2cl", "cdnr", "exp", "invoice", "outward", "sheet1"])
                is_summary = any(skip in sh.lower() for skip in ["b2cs", "hsn", "doc_issue", "instructions", "summary", "master"])
                
                priority = 0
                if has_inv:
                    priority += 10
                if is_inv_sheet:
                    priority += 5
                if is_summary:
                    priority -= 15
                    
                sheet_candidates.append((priority, len(d_clean), sh, d_clean))
        except Exception:
            pass
            
    if not sheet_candidates:
        raise ValueError("Excel file mein usable data sheet nahi mili.")
        
    sheet_candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return sheet_candidates[0][3]

def standardize(df, label, custom_mapping=None):
    out = pd.DataFrame(index=df.index)
    mapping = {}
    for key in ALIASES:
        if custom_mapping and custom_mapping.get(key):
            col = custom_mapping[key]
        else:
            col = find_col(df, key)
        mapping[key] = col
        out[key] = df[col] if col is not None and col in df.columns else None
        
    out["source_row"] = range(2, len(df) + 2)
    out["source"] = label
    out["invoice_no"] = (
        out["invoice_no"]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
        .str.replace(r"\s+", "", regex=True)
    )
    out["gstin"] = out["gstin"].fillna("").astype(str).str.strip().str.upper()
    out["date"] = pd.to_datetime(out["date"], errors="coerce", dayfirst=True)
    
    for k in ["taxable", "igst", "cgst", "sgst", "total"]:
        out[k] = pd.to_numeric(
            out[k].astype(str)
            .str.replace(",", "", regex=False)
            .str.replace("₹", "", regex=False)
            .str.replace(" ", "", regex=False),
            errors="coerce"
        ).fillna(0.0)
        
    if label == "GSTR-1" and not out.empty:
        valid_mask = out["invoice_no"].ne("") & out["invoice_no"].ne("NAN")
        valid_df = out[valid_mask].copy()
        if not valid_df.empty:
            grouped = valid_df.groupby(["gstin", "invoice_no"], as_index=False).agg({
                "date": "first",
                "taxable": "sum",
                "igst": "sum",
                "cgst": "sum",
                "sgst": "sum",
                "total": lambda s: s.iloc[0] if (s.nunique() == 1 and s.iloc[0] > 0) else s.max(),
                "source_row": lambda s: ", ".join(str(x) for x in s),
                "source": "first"
            })
            grouped["total"] = grouped.apply(
                lambda r: r["taxable"] + r["igst"] + r["cgst"] + r["sgst"] if r["total"] <= 0 else r["total"],
                axis=1
            )
            out = pd.concat([grouped, out[~valid_mask]], ignore_index=True)
            
    return out, mapping

def make_key(df):
    return df.apply(lambda r: (r["gstin"] + "|" if r["gstin"] and r["gstin"].lower() not in ["nan", "urp", "exp"] else "") + r["invoice_no"], axis=1)

def reconcile(gstr, ewb, tolerance):
    g = gstr.copy()
    e = ewb.copy()
    g["key"] = make_key(g)
    e["key"] = make_key(e)
    g = g[g["invoice_no"] != ""].copy()
    e = e[e["invoice_no"] != ""].copy()

    gdup = set(g.loc[g.duplicated("key", keep=False), "key"])
    edup = set(e.loc[e.duplicated("key", keep=False), "key"])
    e_groups = {k: grp for k, grp in e.groupby("key", dropna=False)}
    e_by_inv = {inv: grp for inv, grp in e.groupby("invoice_no", dropna=False)}
    
    rows = []
    matched_ewb_indices = set()
    
    for _, gr in g.iterrows():
        key = gr["key"]
        inv_no = gr["invoice_no"]
        matches = e_groups.get(key)
        
        if matches is None and inv_no in e_by_inv and len(e_by_inv[inv_no]) == 1:
            matches = e_by_inv[inv_no]
            
        if key in gdup or (matches is not None and matches.iloc[0]["key"] in edup):
            status, reason, er = "Review - Duplicate", "Duplicate invoice key detected in report", None
        elif matches is None:
            status, reason, er = "E-Way Bill Not Found", "No corresponding invoice key found in E-Way Bill report", None
        else:
            er = matches.iloc[0]
            matched_ewb_indices.add(er.name)
            diffs = []
            
            if pd.notna(gr["date"]) and pd.notna(er["date"]) and gr["date"].date() != er["date"].date():
                diffs.append(f"Date mismatch (GSTR-1: {gr['date'].strftime('%d-%m-%Y')} vs EWB: {er['date'].strftime('%d-%m-%Y')})")
                
            for field, title in [("taxable", "Taxable value"), ("igst", "IGST"), ("cgst", "CGST"), ("sgst", "SGST"), ("total", "Invoice value")]:
                a, b = float(gr[field]), float(er[field])
                if a > 0 or b > 0:
                    diff = abs(a - b)
                    if diff > tolerance:
                        diffs.append(f"{title} diff: ₹{diff:,.2f}")
                        
            if diffs:
                status, reason = "Unmatched", "; ".join(diffs)
            else:
                status, reason = "Matched", "Exact match within tolerance limit"
                
        rows.append({
            "Status": status, "Reason": reason, "Invoice No.": gr["invoice_no"],
            "GSTIN": gr["gstin"], "GSTR-1 Date": gr["date"], "E-Way Bill Date": er["date"] if er is not None else pd.NaT,
            "GSTR-1 Taxable": gr["taxable"], "EWB Taxable": er["taxable"] if er is not None else None,
            "GSTR-1 IGST": gr["igst"], "EWB IGST": er["igst"] if er is not None else None,
            "GSTR-1 CGST": gr["cgst"], "EWB CGST": er["cgst"] if er is not None else None,
            "GSTR-1 SGST": gr["sgst"], "EWB SGST": er["sgst"] if er is not None else None,
            "GSTR-1 Invoice Value": gr["total"], "EWB Invoice Value": er["total"] if er is not None else None,
            "GSTR-1 Source Row": gr["source_row"], "EWB Source Row": er["source_row"] if er is not None else None
        })
        
    for idx, er in e.iterrows():
        if idx not in matched_ewb_indices:
            rows.append({
                "Status": "Extra E-Way Bill", "Reason": "Invoice exists in E-Way Bill report but not in GSTR-1",
                "Invoice No.": er["invoice_no"], "GSTIN": er["gstin"], "GSTR-1 Date": pd.NaT,
                "E-Way Bill Date": er["date"], "GSTR-1 Taxable": None, "EWB Taxable": er["taxable"],
                "GSTR-1 IGST": None, "EWB IGST": er["igst"], "GSTR-1 CGST": None, "EWB CGST": er["cgst"],
                "GSTR-1 SGST": None, "EWB SGST": er["sgst"], "GSTR-1 Invoice Value": None,
                "EWB Invoice Value": er["total"], "GSTR-1 Source Row": None, "EWB Source Row": er["source_row"]
            })
            
    return pd.DataFrame(rows)

with st.sidebar:
    st.header("1. Upload Reports")
    gfile = st.file_uploader("GSTR-1 (Excel or JSON)", type=["xlsx", "xls", "json", "csv"], key="gstr")
    efile = st.file_uploader("E-Way Bill (Excel or CSV)", type=["xlsx", "xls", "csv"], key="ewb")
    st.header("2. Settings")
    tolerance = st.number_input("Amount difference tolerance (₹)", min_value=0.0, value=1.0, step=0.5)
    run = st.button("Run Reconciliation", type="primary", use_container_width=True)

if run:
    if not gfile or not efile:
        st.error("Please upload both GSTR-1 and E-Way Bill files to proceed.")
    else:
        try:
            with st.spinner("Processing files and reconciling invoices..."):
                gd = read_upload(gfile, is_gstr=True)
                ed = read_upload(efile, is_gstr=False)
                
                gs, gm = standardize(gd, "GSTR-1")
                es, em = standardize(ed, "E-Way Bill")
                
                missing_g = [k for k in ["invoice_no"] if gm[k] is None]
                missing_e = [k for k in ["invoice_no"] if em[k] is None]
                
                if missing_g or missing_e:
                    st.error("Invoice number column detect nahi hua. Niche diye gaye mapping se column select karein.")
                    st.write("GSTR-1 detected columns:", list(gd.columns))
                    st.write("E-Way Bill detected columns:", list(ed.columns))
                    st.session_state["raw_gd"] = gd
                    st.session_state["raw_ed"] = ed
                    st.session_state["gmapping"] = gm
                    st.session_state["emapping"] = em
                else:
                    result = reconcile(gs, es, tolerance)
                    st.session_state["result"] = result
                    st.session_state["graw_cols"] = list(gd.columns)
                    st.session_state["eraw_cols"] = list(ed.columns)
                    st.session_state["gmapping"] = gm
                    st.session_state["emapping"] = em
        except Exception as exc:
            st.error(f"Error while processing files: {exc}")

if "raw_gd" in st.session_state and "raw_ed" in st.session_state and "result" not in st.session_state:
    st.subheader("Manual Column Mapping")
    st.write("Automatic detection was unable to uniquely find the invoice number. Please select the correct columns:")
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("**GSTR-1 Columns**")
        g_cols = ["None"] + list(st.session_state["raw_gd"].columns)
        g_inv = st.selectbox("GSTR-1 Invoice Number Column", g_cols, index=0)
        g_gstin = st.selectbox("GSTR-1 GSTIN Column", g_cols, index=0)
    with c2:
        st.markdown("**E-Way Bill Columns**")
        e_cols = ["None"] + list(st.session_state["raw_ed"].columns)
        e_inv = st.selectbox("EWB Invoice / Doc Number Column", e_cols, index=0)
        e_gstin = st.selectbox("EWB GSTIN Column", e_cols, index=0)
        
    if st.button("Apply Mapping & Run Reconciliation"):
        custom_g = {"invoice_no": g_inv if g_inv != "None" else None, "gstin": g_gstin if g_gstin != "None" else None}
        custom_e = {"invoice_no": e_inv if e_inv != "None" else None, "gstin": e_gstin if e_gstin != "None" else None}
        gs, gm = standardize(st.session_state["raw_gd"], "GSTR-1", custom_mapping=custom_g)
        es, em = standardize(st.session_state["raw_ed"], "E-Way Bill", custom_mapping=custom_e)
        result = reconcile(gs, es, tolerance)
        st.session_state["result"] = result
        st.session_state["gmapping"] = gm
        st.session_state["emapping"] = em
        st.rerun()

if "result" in st.session_state:
    result = st.session_state["result"]
    st.subheader("Reconciliation Dashboard")
    counts = result["Status"].value_counts()
    total_gstr = int(result["Status"].isin(["Matched", "Unmatched", "E-Way Bill Not Found", "Review - Duplicate"]).sum())
    total_ewb = int(result["Status"].isin(["Matched", "Unmatched", "Extra E-Way Bill", "Review - Duplicate"]).sum())
    cards = [
        ("GSTR-1 Bills", total_gstr),
        ("E-Way Bills", total_ewb),
        ("Matched", int(counts.get("Matched", 0))),
        ("Unmatched", int(counts.get("Unmatched", 0))),
        ("E-Way Bill Not Found", int(counts.get("E-Way Bill Not Found", 0))),
        ("Extra E-Way Bills", int(counts.get("Extra E-Way Bill", 0))),
        ("Review / Duplicate", int(counts.get("Review - Duplicate", 0))),
    ]
    cols = st.columns(4)
    for i, (label, value) in enumerate(cards):
        with cols[i % 4]:
            if st.button(f"{label}\n{value:,}", key=f"card_{i}", use_container_width=True):
                st.session_state["filter_status"] = label
                
    st.caption("Click any card above to quickly filter the table below.")
    st.markdown("---")
    
    status_options = ["All", "Matched", "Unmatched", "E-Way Bill Not Found", "Extra E-Way Bill", "Review - Duplicate"]
    default_filter = st.session_state.get("filter_status", "All")
    if default_filter not in status_options:
        default_filter = "All"
    selected = st.selectbox("Filter by Category", status_options, index=status_options.index(default_filter))
    q = st.text_input("Search by Invoice Number or GSTIN")
    
    view = result.copy()
    if selected != "All":
        view = view[view["Status"] == selected]
    if q:
        mask = view["Invoice No."].astype(str).str.contains(q, case=False, na=False) | view["GSTIN"].astype(str).str.contains(q, case=False, na=False)
        view = view[mask]
        
    st.write(f"**Showing {len(view):,} invoices**")
    st.dataframe(view, use_container_width=True, hide_index=True)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        result.to_excel(writer, sheet_name="All Reconciliation", index=False)
        for status, sheet in [("Matched","Matched"), ("Unmatched","Unmatched"), ("E-Way Bill Not Found","EWB Missing"), ("Extra E-Way Bill","Extra EWB"), ("Review - Duplicate","Review")]:
            sub = result[result["Status"] == status]
            if not sub.empty:
                sub.to_excel(writer, sheet_name=sheet, index=False)
                
    st.download_button(
        "📥 Download Complete Excel Report",
        data=output.getvalue(),
        file_name=f"GST_EWB_Reconciliation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    
    with st.expander("Detected Column Mapping (Verified)"):
        st.write("**GSTR-1 Mapping:**", {k: v for k, v in st.session_state.get("gmapping", {}).items() if v is not None})
        st.write("**E-Way Bill Mapping:**", {k: v for k, v in st.session_state.get("emapping", {}).items() if v is not None})
else:
    st.subheader("Start a Reconciliation")
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("### Supported Uploads")
        st.write("- **GSTR-1**: JSON (Direct portal download), Excel (.xlsx/.xls), CSV")
        st.write("- **E-Way Bill**: Excel (.xlsx/.xls), CSV (From NIC E-Way Bill Portal)")
    with c2:
        st.markdown("### Key Reconciliation Checks")
        st.write("- **Matched Invoices**: Key fields, tax amounts, and dates match within tolerance")
        st.write("- **Value & Date Mismatches**: Highlights exact difference amount and date variance")
        st.write("- **E-Way Bill Not Found**: Invoices reported in GSTR-1 with no matching E-Way Bill")
        st.write("- **Extra E-Way Bills**: E-Way bills generated but omitted in GSTR-1 filing")
    st.warning("Note: Files are processed locally in your session. Please verify detected column mappings before finalizing compliance reports.")
