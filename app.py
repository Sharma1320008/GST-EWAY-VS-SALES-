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
st.info("Prototype: upload your reports below. Files are processed in this app session; check the column mapping before relying on results.")

def norm_col(c):
    return re.sub(r'[^a-z0-9]', '', str(c).lower())

ALIASES = {
    "invoice_no": ["invoiceno", "invoicenumber", "documentnumber", "docno", "billno", "billnumber", "invno", "inum"],
    "gstin": ["gstin", "gstinofrecipient", "gstinuin", "suppliergstin", "gstinofsupplier", "gstinofsupplier"],
    "date": ["invoicedate", "documentdate", "docdate", "date", "billdate", "invdate", "idt"],
    "taxable": ["taxablevalue", "taxableamount", "assessablevalue", "taxable"],
    "igst": ["igst", "igstamount"],
    "cgst": ["cgst", "cgstamount"],
    "sgst": ["sgst", "sgstamount", "utgst", "utgstamount"],
    "total": ["invoicevalue", "invoiceamount", "totalinvoicevalue", "totalvalue", "billamount", "totalamount", "val"],
}
def find_col(df, key):
    norms = {norm_col(c): c for c in df.columns}
    for alias in ALIASES[key]:
        if alias in norms:
            return norms[alias]
    for n, original in norms.items():
        if any(alias in n for alias in ALIASES[key] if len(alias) > 4):
            return original
    return None

def json_to_frames(obj):
    # GSTR-1 JSON can contain nested invoice lists. Find lists of dictionaries and flatten them.
    found = []
    def walk(x, path=""):
        if isinstance(x, dict):
            # If a dict contains invoice-like records under an array, flatten those records.
            for k, v in x.items():
                if isinstance(v, list) and v and all(isinstance(z, dict) for z in v):
                    rows = []
                    for item in v:
                        row = {}
                        def flatten(d, prefix=""):
                            for kk, vv in d.items():
                                key = f"{prefix}_{kk}" if prefix else str(kk)
                                if isinstance(vv, dict):
                                    flatten(vv, key)
                                elif not isinstance(vv, list):
                                    row[key] = vv
                        flatten(item)
                        rows.append(row)
                    if rows:
                        found.append((path + "/" + str(k), pd.DataFrame(rows)))
                else:
                    walk(v, path + "/" + str(k))
        elif isinstance(x, list):
            for i, v in enumerate(x):
                walk(v, path + f"/{i}")
    walk(obj)
    if not found:
        raise ValueError("JSON mein tabular invoice data nahi mila. GSTR-1 JSON structure ke liye mapping update karni pad sakti hai.")
    # Prefer table with invoice number-like fields and most rows/columns
    def score(item):
        _, df = item
        cols = " ".join(norm_col(c) for c in df.columns)
        return (int(any(a in cols for a in ["inum", "invoiceno", "documentnumber"])), len(df), len(df.columns))
    found.sort(key=score, reverse=True)
    return found[0][1], [p for p, _ in found]

def read_upload(upload, json_mode=False):
    if json_mode:
        obj = json.load(upload)
        return json_to_frames(obj)[0]
    name = upload.name.lower()
    data = upload.getvalue()
    if name.endswith(".csv"):
        return pd.read_csv(BytesIO(data), dtype=str)
    book = pd.ExcelFile(BytesIO(data))
    # Use the sheet with the most rows, avoiding empty cover sheets
    candidates = []
    for sh in book.sheet_names:
        try:
            d = pd.read_excel(book, sheet_name=sh, dtype=str)
            if not d.empty:
                candidates.append(d)
        except Exception:
            pass
    if not candidates:
        raise ValueError("Excel file mein usable data sheet nahi mili.")
    return max(candidates, key=lambda d: len(d))

def standardize(df, label):
    out = pd.DataFrame(index=df.index)
    mapping = {}
    for key in ALIASES:
        col = find_col(df, key)
        mapping[key] = col
        out[key] = df[col] if col is not None else None
    out["source_row"] = range(2, len(df) + 2)
    out["source"] = label
    out["invoice_no"] = out["invoice_no"].fillna("").astype(str).str.strip().str.upper().str.replace(r"\s+", "", regex=True)
    out["gstin"] = out["gstin"].fillna("").astype(str).str.strip().str.upper()
    out["date"] = pd.to_datetime(out["date"], errors="coerce", dayfirst=True)
    for k in ["taxable", "igst", "cgst", "sgst", "total"]:
        out[k] = pd.to_numeric(out[k].astype(str).str.replace(",", "", regex=False).str.replace("₹", "", regex=False), errors="coerce")
    return out, mapping

def make_key(df):
    # GSTIN + invoice number is preferred. If GSTIN is unavailable, invoice number is used.
    return df.apply(lambda r: (r["gstin"] + "|" if r["gstin"] and r["gstin"].lower() != "nan" else "") + r["invoice_no"], axis=1)

def reconcile(gstr, ewb, tolerance):
    g = gstr.copy()
    e = ewb.copy()
    g["key"] = make_key(g)
    e["key"] = make_key(e)
    g = g[g["invoice_no"] != ""].copy()
    e = e[e["invoice_no"] != ""].copy()

    # Duplicate keys should be surfaced, not silently treated as a reliable one-to-one match.
    gdup = set(g.loc[g.duplicated("key", keep=False), "key"])
    edup = set(e.loc[e.duplicated("key", keep=False), "key"])
    e_groups = {k: grp for k, grp in e.groupby("key", dropna=False)}
    rows = []
    used_ewb_keys = set()
    for _, gr in g.iterrows():
        key = gr["key"]
        matches = e_groups.get(key)
        if key in gdup or key in edup:
            status, reason, er = "Review - Duplicate", "Duplicate invoice key in one or both files", None
        elif matches is None:
            status, reason, er = "E-Way Bill Not Found", "No corresponding invoice key in E-Way Bill report", None
        else:
            er = matches.iloc[0]
            used_ewb_keys.add(key)
            diffs = []
            if pd.notna(gr["date"]) and pd.notna(er["date"]) and gr["date"].date() != er["date"].date():
                diffs.append("Date mismatch")
            for field, title in [("taxable", "Taxable value"), ("igst", "IGST"), ("cgst", "CGST"), ("sgst", "SGST"), ("total", "Invoice value")]:
                a, b = gr[field], er[field]
                if pd.notna(a) and pd.notna(b) and abs(float(a)-float(b)) > tolerance:
                    diffs.append(title + " mismatch")
            if diffs:
                status, reason = "Unmatched", ", ".join(diffs)
            else:
                status, reason = "Matched", "Key fields matched; compare available amounts"
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
    for _, er in e.iterrows():
        if er["key"] not in set(g["key"]):
            rows.append({
                "Status": "Extra E-Way Bill", "Reason": "No corresponding invoice key in GSTR-1 file",
                "Invoice No.": er["invoice_no"], "GSTIN": er["gstin"], "GSTR-1 Date": pd.NaT,
                "E-Way Bill Date": er["date"], "GSTR-1 Taxable": None, "EWB Taxable": er["taxable"],
                "GSTR-1 IGST": None, "EWB IGST": er["igst"], "GSTR-1 CGST": None, "EWB CGST": er["cgst"],
                "GSTR-1 SGST": None, "EWB SGST": er["sgst"], "GSTR-1 Invoice Value": None,
                "EWB Invoice Value": er["total"], "GSTR-1 Source Row": None, "EWB Source Row": er["source_row"]
            })
    return pd.DataFrame(rows)

with st.sidebar:
    st.header("1. Upload Reports")
    gfile = st.file_uploader("GSTR-1 Excel or JSON", type=["xlsx", "xls", "json", "csv"], key="gstr")
    efile = st.file_uploader("E-Way Bill Excel", type=["xlsx", "xls", "csv"], key="ewb")
    st.header("2. Settings")
    tolerance = st.number_input("Amount difference tolerance (₹)", min_value=0.0, value=1.0, step=0.5)
    run = st.button("Run Reconciliation", type="primary", use_container_width=True)

if run:
    if not gfile or not efile:
        st.error("Please GSTR-1 aur E-Way Bill dono files upload karein.")
    else:
        try:
            gd = read_upload(gfile, json_mode=gfile.name.lower().endswith(".json"))
            ed = read_upload(efile)
            gs, gm = standardize(gd, "GSTR-1")
            es, em = standardize(ed, "E-Way Bill")
            missing_g = [k for k in ["invoice_no"] if gm[k] is None]
            missing_e = [k for k in ["invoice_no"] if em[k] is None]
            if missing_g or missing_e:
                st.error("Invoice number column detect nahi hua. Apni file ke column headings check karein.")
                st.write("GSTR-1 columns:", list(gd.columns))
                st.write("E-Way Bill columns:", list(ed.columns))
            else:
                result = reconcile(gs, es, tolerance)
                st.session_state["result"] = result
                st.session_state["graw_cols"] = list(gd.columns)
                st.session_state["eraw_cols"] = list(ed.columns)
                st.session_state["gmapping"] = gm
                st.session_state["emapping"] = em
        except Exception as exc:
            st.error(f"File read karte waqt issue aaya: {exc}")

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
    st.caption("Kisi card par click karke neeche us category ke bills filter karein.")
    st.markdown("---")
    status_options = ["All", "Matched", "Unmatched", "E-Way Bill Not Found", "Extra E-Way Bill", "Review - Duplicate"]
    default_filter = st.session_state.get("filter_status", "All")
    if default_filter not in status_options:
        default_filter = "All"
    selected = st.selectbox("Bill category", status_options, index=status_options.index(default_filter))
    q = st.text_input("Search invoice number / GSTIN")
    view = result.copy()
    if selected != "All":
        view = view[view["Status"] == selected]
    if q:
        mask = view["Invoice No."].astype(str).str.contains(q, case=False, na=False) | view["GSTIN"].astype(str).str.contains(q, case=False, na=False)
        view = view[mask]
    st.write(f"**Showing {len(view):,} bills**")
    st.dataframe(view, use_container_width=True, hide_index=True)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        result.to_excel(writer, sheet_name="All Reconciliation", index=False)
        for status, sheet in [("Matched","Matched"), ("Unmatched","Unmatched"), ("E-Way Bill Not Found","EWB Missing"), ("Extra E-Way Bill","Extra EWB"), ("Review - Duplicate","Review")]:
            result[result["Status"] == status].to_excel(writer, sheet_name=sheet, index=False)
    st.download_button("Download Complete Excel Report", data=output.getvalue(),
                       file_name="GST_EWB_Reconciliation.xlsx",
                       mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    with st.expander("Detected column mapping (please verify)"):
        st.write("GSTR-1 mapping", {k: v for k, v in st.session_state["gmapping"].items() if v is not None})
        st.write("E-Way Bill mapping", {k: v for k, v in st.session_state["emapping"].items() if v is not None})
else:
    st.subheader("Start a reconciliation")
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("### Supported uploads")
        st.write("- GSTR-1: Excel (.xlsx/.xls), JSON, CSV")
        st.write("- E-Way Bill: Excel (.xlsx/.xls), CSV")
    with c2:
        st.markdown("### Results")
        st.write("- Matched invoices")
        st.write("- Value/date mismatches")
        st.write("- E-Way Bill not found")
        st.write("- Extra E-Way Bills and duplicate review")
    st.warning("Important: GSTR-1 JSON layouts and E-Way Bill Excel column names can vary. Before using this for filing/compliance decisions, test with sample reports and verify the detected column mapping and results. This prototype is a reconciliation aid, not a legal determination of E-Way Bill applicability.")
