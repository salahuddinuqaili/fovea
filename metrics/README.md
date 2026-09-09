# Metric catalog

The kernel answers a **named metric** or it abstains. `src/kernel/fixtures.ts` `METRICS` is what the demo actually loads. This directory is the portable, file-shaped copy of that catalog.

A future loader may import these JSON files with `{ type: "json" }` (browser-safe; no `fs`). Until that ships with evals, do not change lookup behavior from this folder.

## Packs

| Pack | Runtime today | Purpose |
| --- | --- | --- |
| `packs/lumen/` | Must match `METRICS` (CI) | Example commerce / marketplace pack. Eval and simulation ids bind here. |

Do not invent a second pack in the demo. Two north stars make “revenue last week” ambiguous and the governor must abstain. To replace Lumen, copy `packs/lumen/`, rename ids, and update `METRICS` in the same change — with evals.

## Schema

Each file is one `MetricDefinition` plus optional documentation fields:

- `id` — stable slug. Evals and grants bind this, not the display name.
- `name` — what Maya sees
- `status` — `canonical` \| `draft` \| `deprecated` \| `ambiguous`
- `owner` — team that can change the formula
- `description`, `formula`, `grains`, `filters`, `sourceTable`, `dataClass`
- `aliases` — extra lookup strings. They do not create a second metric. Unused until a loader ships.
- `allowedSchemas` — SQL validator allowlist for this metric’s queries. Unused until a loader ships.

Draft and ambiguous metrics are refusals, not guesses.

## Portable mapping (Lumen → your company)

| Lumen id | Tech-company name | Broader analogue |
| --- | --- | --- |
| `northstar_revenue` | recognized revenue, only after you make it canonical | GMV / net sales |
| `weekly_active_accounts` | WAU / WAA | active customers / members |
| `order_fill_rate` | fulfillment / SLA hit rate | on-time jobs |
| `refund_rate` | credits + refunds | returns / chargebacks |
| `booked_revenue` | keep as draft | the abstain demo |

A bank or hospital deletes `packs/lumen/` and ships their own pack. The kernel does not change.

## Runtime

- Demo kernel loads `src/kernel/fixtures.ts`. CI fails if a Lumen JSON file drifts from that list.
- A dbt importer, when it exists, **writes these files**. It is not a second source of truth.
- Auth stays off in the public tree. No warehouse DSN belongs in this repo.
