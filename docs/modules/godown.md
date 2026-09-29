# godown

**Purpose.** Read-only answer to "where are the cylinders": filled and empty per
product, how many are with customers, and every ledger movement behind it.

**Files.** `src/module/godown/{godown.service,godown.payload.schema,godown.serializer}.ts`
· UI `src/app/(dashboard)/godown/` and the dashboard panel
`src/app/(dashboard)/_components/godown-preview.tsx`

**`getGodownStatus()`** — cylinder products only (non-cylinders would always read 0).
Per row: `filledQty`, `emptyQty` (from the cache), `withCustomers` (sum of
`CustomerCylinderLedger.pendingCylinder > 0`), `batchQty` / `batchCount` (sellable
stock), `ledgerFilled` / `ledgerEmpty` (re-derived by summing
`CylinderTransaction`), and `inSync` = cache equals ledger. `totals` includes
`outOfSync`.

**`inSync` is a self-audit**, not a data-entry check. Every legitimate write
updates ledger and cache in one transaction, so a mismatch means a bug, a raw DB
edit or a partial import. `godown.service.integration.test.ts` corrupts the cache
on purpose to prove detection works. `batchQty` is deliberately **not** compared:
batches and the godown drift legitimately on manual corrections.

**`getGodownMovements({ productId?, txnType?, from?, to?, page, limit })`** —
the ledger, newest first; reversal rows are badged in the UI (raw `from`/`to`,
README #8).

**UI.** The summary tiles (filled / empty / with customers / total) were
**removed at the client's request** (2026-08-16) from both `/godown` and the
dashboard panel. What remains: out-of-sync warning, per-product table, movements.

**Routes.** `GET /api/godown`, `GET /api/godown/movements` — `stock.read`.
