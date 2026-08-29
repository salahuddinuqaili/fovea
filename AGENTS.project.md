# Fovea — project instructions for future sessions

This is an **open-source Agentic OS** (name: **Fovea**). Continue in place. Do not scaffold a new app.

## Current version: v0.1.0 — Stage B Trusted Copilot

Locked defaults:

- Apache-2.0 TypeScript app (TanStack Start portal + `src/kernel` control plane)
- Auth OFF (demo principal switcher, not Better Auth)
- Database OFF (in-process store + fixtures)
- Writes: require_approval, execution disabled
- Four skills: investigate-metric, write-and-validate-sql, plan-backfill, session-close

## Do not reopen

See README “principles” and the original implementation guide. Intersection permissions, signed releases, personal-memory isolation, no arbitrary plugins, tool output is not policy.

## Where to edit

- Kernel: `src/kernel/` (policy, orchestrator, evals, tools, release)
- Portal: `src/routes/_portal/`
- Invariant tests: `src/kernel/invariants.test.ts`
- Roadmap: `ROADMAP.md`

## Next versions (do these, don’t rebuild)

- **v1** — durable store, richer SQL validator, more golden fixtures, personal skill tests, Stage C write path in sandbox only
- **v2** — real pipeline adapters, approval → short-lived write credential, still no prod backfill exec until gates pass
- **v3** — SSO, KMS signing, live warehouse adapter behind policy

Keep the portal on `0.0.0.0:8080` via `npm run dev` and `startup.sh`.
