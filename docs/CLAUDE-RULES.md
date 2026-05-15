# SEED Contact Lens (M) Sdn Bhd — POS Calculation Rules

Source: `CLAUDE INSTRUCTION.docx` (uploaded 2026-05-12).

These rules govern how raw POS Group Codes from "Stock Sales Analysis – Summary
By Group" are folded into the canonical product list shown on Slides 5 / 6.
The implementation lives in [`src/lib/catalog/sku-map.ts`](../src/lib/catalog/sku-map.ts)
and is applied during aggregation in [`src/lib/aggregation/index.ts`](../src/lib/aggregation/index.ts).

## Adjustment rules (every month)

| Code variant | What to do with QTY | What to do with MYR |
|---|---|---|
| Trial Lens (`*TR`, special codes below) | **qty ÷ divisor**, then add to parent | **as-is** |
| Promotion (`*PRM`) | full qty, add to parent | **as-is** |
| Regular | full qty as-is | as-is |

> Sales Amount (RM) is **never** adjusted. Net sales figures flow straight from
> the Excel Grand Total cell (with the optional "Sales adj" row applied) to
> Slide 1, and from each row to Slide 6.

## Trial Lens → Parent mappings

### ÷32 (1-day daily disposables, 32-pack)

| Code | Parent | Divisor |
|---|---|---|
| `1DPETR`   | `1DPE`  | 32 |
| `1DPSTR`   | `1DPS`  | 32 |
| `1DTR`     | `1DPR`  | 32 |
| `1DTT`     | `1DPT`  | 32 |
| `1MTR`     | `1DMS`  | 32 |

### ÷6 (2-week, 6-pack)

| Code | Parent | Divisor |
|---|---|---|
| `2UWKAT`   | `2UWK`  | 6 |
| `2UWT`     | `2UWK`  | 6 |
| `2WKUT`    | `2WMS`  | 6 |
| `MTPRT`    | `MTPR`  | 6 |

### ÷10

| Code | Parent | Divisor |
|---|---|---|
| `EC-MT`      | `EC10-M`            | 10 |
| `ECRT-MT`    | `ECRT30-M` (match by name) | 10 |
| `ECWT-MT`    | `ECWT30-M` (match by name) | 10 |
| `ECTR`       | `EC10-M`            | 10 |
| `MNSFTR`     | `MNSF10`            | 10 |

### ÷2

| Code | Parent | Divisor |
|---|---|---|
| `MCUV2T`   | `MCUV2` | 2 |
| `MCUVT`    | `MCUV`  | 2 |

### ÷3

| Code | Parent | Divisor |
|---|---|---|
| `MNSFCUVTR` | `MNSFCUV` | 3 |

## PRM → Parent (full quantity, no divisor)

| Code | Parent |
|---|---|
| `1DMSPRM`     | `1DMS` |
| `1DPEPRM`     | `1DPE` |
| `1DPRPRM`     | `1DPR` |
| `1DPRVSPRM`   | `1DPR` |
| `1DPSPRM`     | `1DPS` |
| `EC10-MPRM`   | `EC10-M` |
| `ECRT30-MPRM` | `ECRT30-M` |
| `ECWT30-MPRM` | `ECWT30-M` |
| `MCIIPHRM`    | `MCUV2` |
| `MCUPRM`      | `MCUV` |
| `MHFPRM`      | `MFN+` |
| `MHFPRM+`     | `MFN+` |
| `MNSFCUVPRM`  | `MNSFCUV` |
| `MNSFPRM`     | `MNSF10` |
| `MTPRPRM3`    | `MTPR3` |
| `2UWKPRM`     | `2UWK` |
| `2WMSPRM`     | `2WMS` |
| `2WPTPRM`     | `2WPT` |

## Template-row mapping (Slide 5 ordering)

| Row | Product | Group code(s) |
|---|---|---|
| R5  | 1 Day Pure                      | `1DPR` |
| R6  | 1 Day Pure Silfa                | `1DPS` |
| R7  | 1 Day Pure Astigmatism          | `1DPT` |
| R8  | 1 Day Multistage                | `1DMS` |
| R9  | 1 Day Pure EDOF                 | `1DPE` |
| R10 | 1 Day View Support              | `1DPVS` |
| R11 | 2 Week Pure Multistage          | `2WMS` |
| R12 | 2 Week Pure UP Toric            | `2WPT` |
| R13 | 2 Week Pure UP                  | `2UWK` |
| R14 | Eye Coffret-M                   | `EC10-M` + `EC10-MPRM` |
| R15 | Eye Coffret-M 10 Toric          | `ECRT10-M` + `ECWT10-M` |
| R16 | Eye Coffret-M 30 Toric          | `ECRT30-M` + `ECWT30-M` + promos |
| R17 | Monthly Fine Plus               | `MFN+` + promos |
| R18 | Monthly Pure3                   | `MTPR3` |
| R19 | Monthly Pure6                   | `MTPR` |
| R20 | Monthly Color UV — Pegavision   | sub-item of `MCUV` |
| R21 | Monthly Color UV — Blue         | sub-item of `MCUV` |
| R22 | Monthly Color UV — Orange       | sub-item of `MCUV` |
| R23 | Monthly Color UV II             | `MCUV2` + `MCIIPHRM` |
| R24 | Minasoft 1Day Color UV          | `MNSF10` + `MNSFPRM` |
| R25 | Minasoft Care UV                | `MNSFCUV` + `MNSFCUVPRM` |
| R26 | RGP UV-1 / UV-1 KC              | `SDUV1` + `SDUV1KC` |
| R27 | RGP AS-Luna / O2 Noah           | `SDASL` |
| R28 | Iris Lens                       | `SDIRIS` |
| R29 | Ultra Vision                    | `UVSCL` + `UVSPVCL` |
| R30 | Breath O Correct                | `SDBRHOC` |
| R31 | Breath O Correct (Overseas)     | `SDBRHOCSG` + `SDBRHOCSG202` |
| R33 | Disop H2O2 Solution             | `SDRGPSL` |
| R34 | Disop Ultra Eyedrop             | `SDEYEDROP` |
| R35 | Accessories / Others            | `CL` |
| R70 | Other Income                    | `SERVICE CHARGE` |

## Codes to exclude (zero revenue, no mapping)

- `PRMSD` — Promotion Use — SEED Free Gift
- **Any remaining trial-lens code not listed above** — enforced in code: a
  group code whose suffix-strip recovers a `TR` or `T` ending mapped to a
  known base, but which is missing from `TRIAL_LENS_ADJUSTMENTS`, is dropped
  to qty=0. PRM/FC variants without an explicit table entry still roll into
  their parent at full qty (no exclusion).

---

## Per-slide rule application

Going forward only RAW files are uploaded; the rules above apply uniformly.
This table is the contract for what each slide computes from what file.

| Slide | Source file (raw) | What gets adjusted | What stays raw |
|---|---|---|---|
| **1 Sales Achievement** | `Stock Sales Analysis Summary - By Group.pdf` (or .xlsx twin) | — | Excel `Grand Total` cell + `Sales adj` row → `actual2026[m]`. **MYR never adjusted.** |
| **2 Sales Trend** | (auto from Slide 1) | — | Pure derivation; no adjustment. |
| **3 Malaysia Outlook** | Manual + **Generate outlook** (AI Gateway) | — | Reads Slide 1/5/6 already-adjusted figures. |
| **4 Daily Sales Quantity** | `Daily Sales Quantity.xlsx` (per-SKU layout) | **Trial-lens ÷ divisor**, **PRM full qty**, **PRMSD excluded**, **any remaining trial-lens code dropped to 0** | Per-day MYR via the file's Amount Grand Total column. |
| **5 Sales Quantity (by Product)** | Master PDF + MCUV BLUE/ORANGE/PEGA PDFs | Same rules as Slide 4. Trial-lens packs convert to lens-equivalents before rolling to the canonical product. | — |
| **6 Top Products** | Master PDF + MCUV PDFs | — | `row.netSales` raw from every line; ranked by MYR. **MYR never adjusted.** |
| **7 Sales by ECP** | `Salesman Sales and Collection Listing By Account Type.xlsx` | Account-type prefix classifier: `SIO*`→SIO, `KCS*`→KCS, `KIO*`→KIO, `HOS*`/`UNI*`/`SPE*`→Hospital & University Clinic, `OVE*`/`EXPORT*`/empty→Overseas. | Outlet sales amount (`Mar' 2026 Sales` column) raw per row. Percentages derived from totals. |
| **8 Sales by Region** | `Sales Analysis By Region.xlsx` | State→region mapping (see below) | "Sub Total" row's monthly amount per `Customer UD Group : <STATE>` block. Country groups (e.g. `INDONESIA (COUNTRY)`) skipped. |
| **9 Product Registration** | Manual | — | Carries forward when a new month is created. |
| **10 Inventory** | `SCLM - Stock List` (master) **+** `SCLM Stock List HQ` **+** `SCLM Stock List HQ2` | warehouse vs consignment split (see below) | Per-product balance from the master; warehouse from HQ+HQ2. |
| **11 Expire Stock** | `Stocks Write Off Report.pdf` | — | Splits the multi-month PDF into the correct month's `expireWriteOff.rows`. |
| **12 Financial** | `Colletion Listing.xlsx` (preferred) or `Salesman Sales and Collection Listing By Account Type.xlsx`'s `Coll.` column (fallback) | — | Collection total raw. AR / AP / Cashflow remain manual. |
| **13 Other Market** | Manual | — | — |

### Slide 8 state → region

| State (from `Customer UD Group : <NAME> (STATE)`) | Region |
|---|---|
| Johor, Melaka, Negeri Sembilan | Southern Region (Johor, Melaka & Negeri Sembilan) |
| KL, Kuala Lumpur, Selangor, Putrajaya (incl. `W.P` prefixes) | Central Region (KL, Selangor & Putrajaya) |
| Kedah, Penang / Pulau Pinang, Perak, Perlis | Northern Region (Kedah, Penang, Perak & Perlis) |
| Pahang, Kelantan, Terengganu | East Coast Region (Pahang, Kelantan & Terengganu) |
| Sabah, Sarawak, Labuan, Brunei | East Malaysia (Sabah & Sarawak) & Brunei |

Country groups (`INDONESIA (COUNTRY)`, `PAKISTAN (COUNTRY)`, etc.) are excluded
from regional totals — they're export sales and roll up to Slide 7's "Overseas"
ECP category via the salesman file's account-type column.

### Slide 10 inventory — warehouse vs consignment

The SCLM master file is the **nationwide total** (warehouse + consignment).
The HQ and HQ2 files are the two **warehouse** exports. Joined by `Stock ID`:

```
warehouse (actual) = HQ[stockId] + HQ2[stockId]
consignment        = master[stockId] − warehouse   (clamped at 0 per row)
```

- Upload all three files together for the split. With only the master, the
  grid falls back to "everything in warehouse, consignment blank" and the
  import emits a warning.
- The master's trailing "Total" row (blank Stock ID) is skipped.
- "DISOP ACUAISS DUAL GEL" is its own inventory slot — excluded from the
  "DISOP ACUAISS → Ultra Eyedrop" description rule so it isn't double-counted.

**BOC consignment exception** — Breath O Correct consignment stock is NOT in
the master SCLM file. Upload `SCLM Stock List BOC <date>.xlsx` and the BOC
row's consignment is read directly from that file's printed Grand Total
quantity (the qty line directly above the "Grand Total" label). BOC warehouse
still comes from the master/HQ split.

### Slide 7 ECP prefix → category

| Account-type prefix | Category |
|---|---|
| `SIO*` (SIO-OPTC, SIO-OPTM-CN/MY, …) | Single Independent Outlet (SIO) |
| `KCS*` (KCS-EXC, KCS-JPN, KCS-LOC) | Key Chain Store (KCS) |
| `KIO*` (KIO-OPTC, KIO-OPTM-CN) | Key Individual Outlet (KIO) |
| `HOS*` (HOS-GOV), `UNI*` (UNI-LOC), `SPE*` (SPECIALIST) | Hospital & University Clinic |
| `OVE*` (OVERSEA / OVERSEAS), `EXPORT*`, empty | Overseas |
| Anything else (incl. `CASH`) | Falls to SIO (default) |

---

## File router (used by `/api/import`)

Most-specific first; first match wins:

1. PDF auto-detect: master / MCUV BLUE/ORANGE/PEGA / write-off (by header text).
2. XLSX filename match:
   - `ecp list` → ECP join table
   - `stock list hq2` / `sclm … hq2` → Inventory warehouse file (HQ2)
   - `stock list hq` / `sclm … hq` → Inventory warehouse file (HQ)
   - `stock list boc` / `sclm … boc` → BOC consignment listing
   - `stock list` / `sclm` → Inventory master (nationwide total)
   - `sales analysis region` / `sales by region` → Slide 8
   - `salesman ... sales/collection` / `account type` → Slide 7 + Collection fallback
   - `daily sales` → Slide 4 (Format A per-SKU; Format B consolidated also accepted)
   - `collection listing` → Financial collection
   - anything else → treated as the outlet Excel (legacy Slide 7 fallback)

---

## When the rules change

1. Update the three tables in [`src/lib/catalog/sku-map.ts`](../src/lib/catalog/sku-map.ts):
   `TRIAL_LENS_ADJUSTMENTS`, `PRM_TO_PARENT`, `EXCLUDED_CODES`.
2. Update the corresponding section above in this file so the human reference stays in sync.
3. Re-import the month or click **Repair chain** on the home page — both flows
   pick up the new rules immediately (no rebuild).
