# Fovea — project instructions for future sessions

This is an **open-source Agentic OS** (name: **Fovea**). Continue in place. Do not scaffold a new app.

## Current version: v11.0.0 — Desk stays put (prod exec still off, Auth still OFF)

Locked defaults:

- Apache-2.0 TypeScript app (TanStack Start portal + `src/kernel` control plane)
- Auth OFF (demo principal switcher, not Better Auth)
- Database ON (unowned control snapshot via PGLite/Neon; personal memory is in-process only)
- Principals remain Stage B. Writes require exact-hash approval.
- Stage C path: sandbox.* writes after approval + short-lived credential. Production execution disabled.
- Stage D is selected workflows only: per-tool, per-task, per-risk grants. **No global autonomous switch — not planned, not later.** A global switch would union permissions across principals. Intersection forbids that. `autonomy.global` stays a permanent human gate.
- Alex (OS owner) or Sam (security) can issue and revoke a named grant from Policy or Work. Maya cannot. Wildcards, writes, duplicates, and T4 are denied. A grant never self-promotes. An active `warehouse.query` / `investigate-metric` / `read` grant continues Maya’s next named metric with sibling canonical reads in the same task. Without a grant, a metric is one query. Grants do not chain across tasks and never execute writes.
- Covering grants are visible on the grantee’s Command and Work before they ask. Issued grants are also visible on the issuer’s Command and on Health. Next actions switch desk; they do not run as the issuer.
- Work is this session (tab). Named handoffs land on the target desk. Jordan sees a pending queue. Maya’s Command audit is her desk. Denied writes are not queued. Only an approver who is not the requester can decide.
- Command is desk-true: Maya’s first-run, Jordan’s queue, Riley’s audit, Alex’s grant roster. A named handoff is a banner; it does not hide that home. Labels face the recipient. Personal memory is encrypted at rest in process. Team memory is scoped to the caller’s team. Sandbox UPDATE/DELETE need WHERE. Snapshot SQL is redacted.
- The running kernel’s signed release wins when the snapshot lags. Pending execute is denied. `warehouse.live` is not on the OS allowlist.
- Live warehouse adapter is registered and policy-gated. No DSN in the demo. Writes stay disabled.
- Releases sign and verify through the demo KMS. `--skip-signature-check` does not exist.
- Skills: investigate-metric, investigate-incident, write-and-validate-sql, plan-backfill, session-close
- Operator simulations in `src/kernel/simulations.ts` are a release input (sixteen journeys).

## Do not reopen

See README “principles” and the original implementation guide. Intersection permissions, signed releases, personal-memory isolation, no arbitrary plugins, tool output is not policy. Do not add a global autonomy switch.

## Where to edit

- Kernel: `src/kernel/` (policy, orchestrator, evals, tools, sql, credentials, sandbox, durable, simulations, kms, grants, warehouse)
- Portal: `src/routes/_portal/`
- Persist: `src/lib/control-persist.ts` + `migrations/0002_fovea_control.sql`
- Invariant tests: `src/kernel/invariants.test.ts`
- Public site: `docs/`
- Roadmap: `ROADMAP.md`

## Next versions (do these, don’t rebuild)

- **Accounts / SSO** — only if the user explicitly asks for accounts, sign-in, or login. Until then Auth stays OFF.
- Live warehouse DSN wiring stays behind policy even if a DSN appears.

Keep the portal on `0.0.0.0:8080` via `npm run dev` and `startup.sh`.
