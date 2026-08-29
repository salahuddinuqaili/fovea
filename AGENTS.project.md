# Fovea — project instructions for future sessions

This is an **open-source Agentic OS** (name: **Fovea**). Continue in place. Do not scaffold a new app.

## Current version: v4.0.0 — Grant desk (prod exec still off, Auth still OFF)

Locked defaults:

- Apache-2.0 TypeScript app (TanStack Start portal + `src/kernel` control plane)
- Auth OFF (demo principal switcher, not Better Auth)
- Database ON (unowned control snapshot via PGLite/Neon; personal memory is in-process only)
- Principals remain Stage B. Writes require exact-hash approval.
- Stage C path: sandbox.* writes after approval + short-lived credential. Production execution disabled.
- Stage D is selected workflows only: per-tool, per-task, per-risk grants. No global autonomous switch.
- Alex (OS owner) or Sam (security) can issue a named grant from Policy or Work. Maya cannot. Wildcards, writes, and T4 are denied. A grant never self-promotes.
- Live warehouse adapter is registered and policy-gated. No DSN in the demo. Writes stay disabled.
- Releases sign and verify through the demo KMS. `--skip-signature-check` does not exist.
- Skills: investigate-metric, investigate-incident, write-and-validate-sql, plan-backfill, session-close
- Operator simulations in `src/kernel/simulations.ts` are a release input (nine journeys).

## Do not reopen

See README “principles” and the original implementation guide. Intersection permissions, signed releases, personal-memory isolation, no arbitrary plugins, tool output is not policy.

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
