# Haazri

Camera-verified labour ledger for Indian builders — the builder-facing dashboard.

Cheap site cameras feed an edge AI box that counts workers through a channelled man-gate. The cloud keeps a hash-chained daily ledger of verified labour-day **ranges** (never point numbers) and reconciles them weekly against the labour contractor's bill to expose padding ("billed 40, verified 28–31"). Camera-offline and tamper events raise alerts *and* land on the ledger as evidence.

## Stack

- Next.js 16 (App Router, React Server Components), React 19, TypeScript strict
- Tailwind CSS v4 (`@theme` tokens in `app/globals.css` — no tailwind.config)
- lucide-react icons; Space Grotesk + Inter via Google Fonts
- JSON file store at `data/db.json`, auto-seeded with demo data on first read

## Run

```bash
npm run dev
```

Open <http://localhost:3000>. Delete `data/db.json` to reset the demo data — it reseeds on the next request.

## Routes

| Route | What it shows |
| --- | --- |
| `/` | Portfolio — KPI row, per-site cards, variance flags, recent alerts |
| `/sites/[id]` | Site detail — today's range, live tiles, 60-day ledger chart, cameras, hash chain, clips |
| `/reconciliation` | Pending bill form, reconciled-week history with evidence drawers |
| `/alerts` | Day-grouped tamper/offline/power feed with resolve actions |
| `/api/evidence/[billId]` | Downloadable JSON evidence pack for a reconciled bill |
| `/api/ingest/{counts,events,heartbeat}` | POST stubs for the edge box (validate, log, acknowledge) |

## Checks

```bash
npx tsc --noEmit
npm run lint
npm run build
```
