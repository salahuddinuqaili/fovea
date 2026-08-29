# Roadmap

## v0 — Stage B reference

Working kernel + portal. Fixture warehouse. Plan-only backfills. Signed demo releases. Eval hard gates.

## v1 — Persistence and Stage C sandbox writes

- Durable control metadata (unowned snapshot; personal memory never persisted)
- Idempotent sandbox writes (non-prod datasets only)
- Exact-action approval hashing end-to-end with credential broker
- Richer SQL validator (comment strip, multi-statement, SELECT INTO, schema allowlist)
- Expanded golden corpus (refund rate, personal-skill widening, sandbox hash mismatch)

## v1.1 — Operator UX, simulations, public site (this tree)

- Next-action routing on every work result
- Command palette, role-aware playbooks, work-console hydrate + auto-run
- Five operator simulations as a release input
- GitHub Pages site in `/docs`
- README rewritten for operators and contributors

## v2 — Governed production backfills (this tree)

- Pipeline adapters for two native systems: dbt Core (fixture) and warehouse scheduled query
- Partition state, dry-run cost vs estimate, structured rollback
- Shadow evaluation of candidate Stage C autonomy — never promotes itself
- Production execution remains disabled until gates pass

## v2.1 — Operator desk (this tree)

- Incident brief skill (three canonical metrics, no causal claim)
- Copyable evidence pack on every work result
- Session cost budget enforced
- In-app operator guide and first-run on Command
- README rewritten for people who will actually click around

## v3 — Selected Stage D workflows

- Per-tool, per-task, per-risk permissions
- No global “autonomous” switch
- KMS/HSM-backed signing, runtime verification in real deploy
