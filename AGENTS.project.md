# Fovea — project instructions for future sessions

This is an **open-source Agentic OS** (name: **Fovea**). Continue in place. Do not scaffold a new app.

## Current version: v2.1.0 — Operator desk (prod exec still off)

Locked defaults:

- Apache-2.0 TypeScript app (TanStack Start portal + `src/kernel` control plane)
- Auth OFF (demo principal switcher, not Better Auth)
- Database ON (unowned control snapshot via PGLite/Neon; personal memory is in-process only)
- Principals remain Stage B. Writes require exact-hash approval.
- Stage C path: sandbox.* writes after approval + short-lived credential. Production execution disabled.
- Skills: investigate-metric, investigate-incident, write-and-validate-sql, plan-backfill, session-close
- Operator simulations in `src/kernel/simulations.ts` are a release input.

## Do not reopen

See README “principles” and the original implementation guide. Intersection permissions, signed releases, personal-memory isolation, no arbitrary plugins, tool output is not policy.

## Where to edit

- Kernel: `src/kernel/` (policy, orchestrator, evals, tools, sql, credentials, sandbox, durable, simulations)
- Portal: `src/routes/_portal/`
- Persist: `src/lib/control-persist.ts` + `migrations/0002_fovea_control.sql`
- Invariant tests: `src/kernel/invariants.test.ts`
- Public site: `docs/`
- Roadmap: `ROADMAP.md`

## Next versions (do these, don’t rebuild)

- **v3** — SSO, KMS signing, live warehouse adapter behind policy. Auth stays OFF until the user explicitly asks for accounts.

Keep the portal on `0.0.0.0:8080` via `npm run dev` and `startup.sh`.
