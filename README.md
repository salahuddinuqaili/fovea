# Fovea

**Accuracy at the center.**

Fovea is an open-source **Agentic Operating System for data analytics**. It is not a chat application and not a single model. It is the governed control plane between people, models, warehouses, pipelines, memory, and production systems.

Website: [salahuddinuqaili.github.io/fovea](https://salahuddinuqaili.github.io/fovea/)

v2 ships **Stage B principals + Stage C sandbox writes + governed backfill adapters**. Agents may read and analyze autonomously. Every write requires a human approval bound to an exact action hash. After approval, Fovea mints a short-lived credential and will execute **only** against `sandbox.*`. Production backfill adapters plan, dry-run, and refuse to execute.

## Why this exists

Analytics agents fail in predictable ways: they guess metric definitions, treat ticket text as policy, write to production, leak personal notes, and load unsigned artifacts. Fovea makes those failures **hard gates**. Abstention is a success state. A confident wrong number is not.

```
principal → policy (intersection) → tools / models
                ↓
        provenance + audit
                ↓
     approval → credential broker → sandbox.* only
```

The kernel is the product. The portal is a client.

## What v1.1 includes

| Layer | What you get |
| --- | --- |
| Identity | Demo principals, opaque IDs, no real SSO |
| Policy | Intersection PDP. Lower layers cannot widen. |
| Tools | Fixture warehouse, repo, issues, docs, pipelines, sandbox writes |
| Models | Deterministic router; optional xAI when configured |
| Memory | Isolated personal / team / org. Personal notes never hit the durable snapshot. |
| Writes | Exact-hash approval → short-lived sandbox credential → idempotent execute |
| Backfills | Two adapters (dbt + scheduled query): partition state, dry-run cost, rollback. Execute disabled. |
| Releases | Ed25519 signed artifacts. Unsigned and tampered loads are rejected. |
| Evals | Golden + adversarial suite. Hard gates cannot be averaged away. |
| Simulations | Five operator journeys: analyst morning, sandbox loop, adversarial day, auditor shift, backfill plan-only |
| Portal | Work console, command palette (⌘K), role-aware playbooks, next-action routing |
| Persist | Unowned control snapshot (PGLite locally, Neon when `DATABASE_URL` is set) |

## Non-goals (still)

- Stage D autonomous production writes
- Real warehouse adapters
- Real SSO / KMS / HSM
- Arbitrary plugin or MCP installation
- Production backfill execution (v2)

## Principles that will not be reopened casually

1. The OS is the control plane, not the UI.
2. User-invoked permissions use intersection, never union.
3. Personal memory is isolated.
4. Arbitrary tools/plugins are not allowed.
5. Agents cannot deploy their own modifications.
6. Production runs only signed, verified artifacts.
7. Tool output is untrusted data, not policy.
8. Abstention is a success state.
9. Stage progression is evidence-driven.

## Run locally

Requires Node 22.

```bash
git clone https://github.com/salahuddinuqaili/fovea
cd fovea
npm install
npm test
npm run dev
```

Switch demo principals in the header, or press **⌘K** and pick “Act as”. No account is required.

1. As **Maya**, ask `What was north-star revenue last week?`
2. Ask `How is revenue doing?` and watch it abstain — then take the next action.
3. Propose `INSERT INTO sandbox.metric_scratch …`
4. Switch to **Jordan**, approve the exact hash, watch the credential execute once.
5. Replay: no additional rows.
6. As **Riley**, open Audit. As Maya, it is denied.

Optional: set `XAI_API_KEY` for freeform analysis. Golden analytical paths stay deterministic either way.

## Demo principals

| Person | Role | Try |
| --- | --- | --- |
| Maya Chen | Analyst | Ask metrics, propose sandbox writes, plan backfills |
| Jordan Hale | Approver | Decide approval objects; mint sandbox credentials |
| Sam Okonkwo | Security owner | Kill switches |
| Riley Park | Auditor | Audit stream |
| Alex Voss | OS owner | Evals, simulations, releases |

## Repository layout

```
src/kernel/     control-plane kernel (policy, tools, evals, signing, credentials, simulations)
src/routes/     internal web portal
src/lib/        persist, playbooks, server functions
migrations/     unowned control-plane snapshot (no personal memory)
policies/       Stage B policy bundle
docs/           GitHub Pages site
schemas/        JSON schemas
```

## Tests

```bash
npm test            # kernel invariants + eval hard gates + operator simulations
npm run typecheck
```

Critical security evals cannot be averaged away. If a hard gate fails, the release recommendation is `blocked`.

## License

Apache License 2.0. See [LICENSE](LICENSE).
