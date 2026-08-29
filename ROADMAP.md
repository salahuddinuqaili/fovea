# Roadmap

## v0 — Stage B reference (this tree)

Working kernel + portal. Fixture warehouse. Plan-only backfills. Signed demo releases. Eval hard gates.

## v1 — Persistence and Stage C sandbox writes

- Replace in-process store with durable control metadata
- Idempotent sandbox writes (non-prod datasets only)
- Exact-action approval hashing end-to-end with credential broker
- Expanded golden corpus from historical work

## v2 — Governed production backfills (still approval-gated)

- Pipeline adapters for at least two native systems
- Partition state, cost estimator vs actual, rollback
- Shadow evaluation of candidate autonomy

## v3 — Selected Stage D workflows

- Per-tool, per-task, per-risk permissions
- No global “autonomous” switch
- KMS/HSM-backed signing, runtime verification in real deploy
