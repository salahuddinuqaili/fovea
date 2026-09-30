# AGENTS.md — fovea

> Canonical agent instructions. Product locks and edit locations live in
> [AGENTS.project.md](AGENTS.project.md) and are part of these instructions:
> read both before changing anything. Continue in place; do not scaffold a new app.

## Purpose
Fovea: an open-source (Apache-2.0) Agentic OS. TanStack Start portal plus a
`src/kernel` control plane with intersection permissions, signed releases and
exact-hash write approval. Owner: Sal.

## Walls and identity
- Commits are authored as **salahuddinuqaili**. Never commit as thebotgrok.
- **Confirm before commit:** show the diff and wait for Sal's OK before any new commit.
- Never force-push the default branch. Never commit secrets or `.env` files.
- Do not read or reference walled material: per-x (Atlas), vault-X / grokbot-vault
  (vault), synapse-os (client), any DH / work-kris repo.
- Canonical Sapne root is `C:\Users\salahuddin\projects`. The old drive-root
  projects folder is retired: do not use it.
- Product walls (from AGENTS.project.md, do not reopen): Auth stays OFF unless Sal
  explicitly asks for accounts; production execution stays disabled; **no global
  autonomy switch, ever**; `warehouse.live` is not on the OS allowlist; no DSN in
  the demo; `--skip-signature-check` does not exist.

## How to run
```sh
npm ci
npm run dev        # portal on 0.0.0.0:8080 (also startup.sh)
```

## How to test
```sh
npm test           # node:test + strip-types kernel tests (invariants in src/kernel/invariants.test.ts)
npm run typecheck
npm run check:auth
npm run lint
```
CI (`.github/workflows/ci.yml`) runs `npm test` and `npm run typecheck` on every PR.

## Done = evidence
"Done" only with a pointer: a green CI run URL, pasted test output, or an artifact
path. No pointer, not done. Anything unverified is labelled unverified.

## Packaging rule
Short-lived branch (≤ 7 days) → one PR → **squash-merge only after the lila stamp**
→ delete the branch. No direct pushes to the default branch.
