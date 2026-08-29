# Fovea

**Accuracy at the center.**

Fovea is an open-source **Agentic Operating System for data analytics**. It is not a chat application and not a single model. It is the governed control plane between people, models, warehouses, pipelines, memory, and production systems.

v0 ships as **Stage B: Trusted Copilot**. Agents may read and analyze autonomously. Every write requires a human approval bound to an exact action hash, and production execution remains disabled.

## What v0 includes

- Identity and session broker (demo principals, opaque IDs)
- Policy decision point with **intersection** semantics
- Tool gateway and registry (fixture warehouse, repo, issues, docs, pipelines)
- Model gateway (deterministic router; optional xAI when configured)
- Provenance + append-only audit
- Golden + adversarial eval suite with hard gates
- Isolated personal / team / org memory
- Ed25519 signed-release verification (demo keys, not HSM)
- Internal portal: work console, approvals, evals, kill switch, cost, memory, skills
- Backfill **planner** (plan + dry-run, never execute)

## Non-goals of v0

- Stage C/D autonomous writes
- Real warehouse adapters
- Real SSO / KMS / HSM
- Arbitrary plugin or MCP installation

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
npm install
npm test
npm run dev
```

Switch demo principals in the header. No account is required. Writes stay gated; production execution is disabled.

Optional: set `XAI_API_KEY` for freeform analysis. Golden analytical paths stay deterministic either way.

## Repository layout

```
src/kernel/     control-plane kernel (policy, tools, evals, signing)
src/routes/     internal web portal
policies/       Stage B policy bundle
schemas/        JSON schemas
```

The kernel is the product. The portal is a client.

## Demo principals

| Person | Role | Try |
| --- | --- | --- |
| Maya Chen | Analyst | Ask metrics, plan backfills |
| Jordan Hale | Approver | Decide approval objects |
| Sam Okonkwo | Security owner | Kill switches |
| Riley Park | Auditor | Audit stream |
| Alex Voss | OS owner | Evals and releases |

## License

Apache License 2.0. See `LICENSE`.
