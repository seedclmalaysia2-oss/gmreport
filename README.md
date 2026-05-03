# Malaysia GM Report Dashboard

Upload POS data → edit figures → export the HQ deck in one click.
Two export templates: **Classic** (pixel-close to current HQ layout) or **Modern** (Midnight Executive redesign).

## Run it

```bash
pnpm install
pnpm prisma db push   # creates prisma/dev.db
pnpm db:seed          # loads Jan/Feb/Mar 2026 with real figures from your samples
pnpm dev              # → http://localhost:3000
```

Password gate is disabled in `NODE_ENV=development`. In production it uses `DASHBOARD_PASSWORD` from `.env` (default `seed2026`).

Set `AI_GATEWAY_API_KEY` in `.env` to enable the **Generate outlook** button on Slide 5 (routes through Vercel AI Gateway → Claude Sonnet 4.6). Without the key the button still appears but the call will fail with an inline error.

## Using the app

1. **Months** (home) — grid of all months on file, with completion %. Click a card to edit.
2. **Import POS** — drop the `Stock Sales Analysis Summary - By Group.pdf` plus any MCUV colour PDFs (BLUE/ORANGE/PEGA). Optional: a "Monthly Sales Performance" Excel plus "ECP List" Excel for ECP & region rollups. Everything auto-routes to the right parser, and unmapped SKU codes surface in a drawer so you can either add them to `src/lib/catalog/sku-map.ts` or edit manually in the month.
3. **Report editor** — 13 sidebar tabs, one per PPTX section. All fields auto-save 500ms after you stop typing. FX rate sits in the header and recomputes every JPY figure live.
4. **Export PPTX** — pick one month (normal report) or two consecutive months (combined deck like the Jan+Feb you sent). Pick the template. Download.

## What the parsers handle today (calibrated from the real files you sent)

| Input file | Schema | Populates |
|------------|--------|-----------|
| `Stock Sales Analysis Summary - By Group.pdf` | Master monthly dump | Slide 3 grand total, Slide 7 qty, Slide 8 top products |
| `MCUV-BLUE/ORANGE/PEGA.pdf` | Colour-variant breakdowns | Slide 7/8 MonthlyColour lines |
| `Monthly Sales Performance.xlsx` | Outlet rows with Account Type | Slide 9 (ECP) + Slide 10 (Region) |
| `ECP List.xlsx` | Outlet → State/Type lookup | Feeds Slide 9 + Slide 10 joiners |
| `SCLM - Stock List YYYY.MM.DD.xlsx` | Nationwide stock + expiry | Slide 12 (Inventory) |
| `Stocks Write Off Report Jan-Mar YY.pdf` | Multi-month write-offs | Slide 13 (Expire Stock) — splits into the correct month automatically |
| `Colletion Listing.xlsx` | AR collection register | Slide 14 Collection (editable override) |
| `Daily Sales Quantity.xlsx` | Per-day per-SKU grid | Slide 6 (Daily Sales qty) |

Any file the router doesn't recognise lands in `outletsXlsxBuf` as a fallback, so unknown POS Excels still get a shot at the ECP parser. Check the Import page's "unmapped SKUs" drawer after each run — that's the one-click place to fix SKU map gaps in `src/lib/catalog/sku-map.ts`.

Slide 5 (outlook text) has a **Generate outlook** button that drafts commentary from this month's sales figures via the AI Gateway. You can still edit freely afterwards.

Still manual: Slide 11 (product registration), and the AR/AP/cashflow rows of Slide 14 (if you want those auto-filled, share the aging report and cashflow export).

## Structure

```
src/
├─ app/
│  ├─ page.tsx                   # Months index
│  ├─ login/                     # Password gate
│  ├─ import/, export/           # Pages
│  ├─ report/[id]/               # 13-tab editor
│  └─ api/{auth,months,import,export}/
├─ components/
│  ├─ site-header.tsx, report-editor.tsx
│  ├─ sections/                  # 13 section editors
│  └─ import-form.tsx, export-form.tsx, new-month-button.tsx
├─ lib/
│  ├─ schema.ts                  # Zod schemas = DB = PPTX input
│  ├─ db.ts, month-report.ts     # Prisma wrapper
│  ├─ catalog/                   # SKU map, ECP+region mappings, product list
│  ├─ parsers/                   # pos-pdf.ts, pos-xlsx.ts
│  ├─ aggregation/               # pure transforms: raw → section JSON
│  ├─ pptx/                      # classic.ts, modern.ts, shared.ts
│  └─ auth.ts, utils.ts
└─ middleware.ts                 # Password gate (skipped in dev)
```

## Data

SQLite at `prisma/dev.db`. One `MonthReport` row per `YYYY-MM`. Section payloads are JSON blobs validated by Zod (`src/lib/schema.ts`) — same shape the PPTX generators consume, so anything you edit in the grid flows straight through to the deck.

Switching to hosted Postgres later is a Prisma connector swap — nothing else changes.

## FX rate

Every month carries its own `fxRate` (default `30.73`). Edit it in the editor's header to refresh every JPY figure in both templates.

## Templates

- **Classic** — exact coordinates, colours, and table shapes from your HQ deck. 16 slides (17 for combined months). Send this to HQ.
- **Modern** — Midnight Executive palette (navy `#1E2761` + ice `#CADCFC` + coral accent), Cambria/Calibri, big KPI callouts, doughnut ECP chart, horizontal region bars. Use when you want the deck to stand out.
