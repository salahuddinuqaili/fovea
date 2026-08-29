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

- Per-tool, per-task, per-risk permissions. No global “autonomous” switch.
- Demo KMS signing + runtime verification. `--skip-signature-check` is not available.
- Live warehouse adapter registered and policy-gated. Writes stay disabled. No DSN in the demo.
- Eight operator simulations as a release input.

## v4 — Grant desk

- Named Stage D grants from Policy and Work. Alex can issue; Maya cannot.
- Wildcards, writes, and tier 4 stay denied. A grant never self-promotes.
- Command featured playbooks (Autonomy / Live no longer sliced away). Work starters, pre-wrapped briefs, evidence download.
- Nine operator simulations as a release input.

## v5 — Grant lifecycle

- Active grants cover the matching named workflow (read-only). They do not widen policy and do not promote Stage D.
- Duplicate active grants are refused. Owners can revoke. Grants expire in eight hours.
- Work console is this session; durable history stays on Tasks.
- Ten operator simulations as a release input.

## v6 — Selected workflow continuation (this tree)

- A covered `investigate-metric` grant continues Maya’s named read with sibling canonical queries in the same task.
- Without a grant (or after revoke) the metric stays a single query.
- Writes, backfills, and `warehouse.live` are not continued. Grants do not chain across tasks.
- Eleven operator simulations as a release input.

## Later — Accounts and a real warehouse DSN

- SSO / accounts only when the user explicitly asks for them (Auth stays OFF until then)
- KMS/HSM in a real deploy, live warehouse DSN still behind policy
