# GST Reconciliation Pro (Prototype)

## Run locally
1. Install Python 3.10 or newer.
2. Open a terminal in this folder.
3. Run:
   `pip install -r requirements.txt`
4. Run:
   `streamlit run app.py`
5. Open the local URL shown in the terminal.

## Public website hosting
This project can be deployed to a Python hosting service that supports Streamlit. A public deployment is not included in this ZIP; it requires a hosting account and deployment configuration.

## Current prototype features
- Upload GSTR-1 Excel/CSV/JSON and E-Way Bill Excel/CSV.
- Dashboard counts and category filtering.
- Invoice number + GSTIN matching.
- Date and amount mismatch checks.
- Excel download with category sheets.
- Duplicate invoice review category.

## Important limitations
- GST report layouts differ; verify detected column mappings and test on sample files.
- Nested GSTR-1 JSON structures may need specific schema mapping.
- Matching is based primarily on invoice number and GSTIN. It is not a legal assessment of E-Way Bill applicability.
- Do not upload sensitive client data to a public deployment until authentication, access controls, retention and security have been configured.
