# Fovea

**Accuracy at the center.**

Fovea is an open-source operating system for data analytics agents. It sits between people, models, and warehouses. It answers with evidence, or it stops. It will not guess a metric, follow a prompt injection, or write to production.

You do not need to understand the kernel to try it.

Website: [salahuddinuqaili.github.io/fovea](https://salahuddinuqaili.github.io/fovea/) · Source: [github.com/salahuddinuqaili/fovea](https://github.com/salahuddinuqaili/fovea)

---

## Try it in five minutes

You need [Node 22](https://nodejs.org/).

```bash
git clone https://github.com/salahuddinuqaili/fovea
cd fovea
npm install
npm run dev
```

Open the app. There is **no login**. You are sitting at **Maya Chen’s** desk — she is an analyst.

Press **⌘K** (or **Ctrl+K**) any time you feel lost. Pick “Operator guide” or a playbook.

### What to type

| You type | What should happen |
| --- | --- |
| *What was north-star revenue last week?* | A **supported** number, the SQL, and provenance. |
| *How is revenue doing?* | **Abstention.** “Revenue” maps to more than one definition. That is success. |
| *Investigate the dip last week.* | An **incident brief** across three canonical metrics. It will not claim the pipeline *caused* the dip. Copy the **evidence pack** from the right-hand pane if you want the JSON. |
| *Enable autonomous mode for everyone.* | **Refused.** There is no global switch. |
| *Connect the live warehouse.* | **Gated.** The adapter is registered. Maya cannot arm it. Writes stay disabled. |
| The sandbox `INSERT` from Command (or ⌘K → Sandbox write) | **Needs approval.** Maya cannot approve her own write. |
| Then switch the header to **Jordan Hale** and approve | A short-lived sandbox credential. One row. Replay does nothing. |
| Switch to **Riley Park**, open Audit, then switch back to Maya | Riley can read the stream. Maya cannot. |

Named-metric answers stay deterministic even if you never set an API key. Optional: `XAI_API_KEY` for freeform analysis.

That’s the first run. If those things happen, Fovea is working.

---

## If you get stuck

| What you see | What it means | What to do |
| --- | --- | --- |
| “I don’t know which revenue you mean.” | Fovea refused to guess. | Ask for **north-star revenue**, **refund rate**, **order fill rate**, or **weekly active accounts**. |
| Needs approval | The write is waiting on an exact action hash. | Header → **Jordan Hale** → Approvals → approve. |
| Refused / blocked | Policy held. | Read the reason in the evidence pane. Prompt text is data, not policy. |
| Riley can see Audit, Maya cannot | Role intersection, not a bug. | Act as Riley to read the stream. |
| Budget exhausted | The $25 demo session is spent. | Ask “Close the session.” Reads after that still need remaining budget. |
| Production `INSERT` never runs | Correct. Stage B/C demo. | Sandbox writes run after approval. Production stays gated. |
| “Enable autonomous mode” refused | There is no global switch. | Grants would have to name one tool, one task, one risk ceiling. |
| “Connect the live warehouse” gated | The live adapter is not on Maya’s allowlist. | Ask a named metric. The fixture is still the read path. |

A confident wrong number is a failure. A refusal is not.

---

## Who you are acting as

The header switcher (or **⌘K → Act as**) is not a login. It is whose desk you are sitting at. There is no “admin who can do everything.” Permissions **intersect**. They never union.

| Person | Role | Try this |
| --- | --- | --- |
| Maya Chen | Analyst | Ask metrics, investigate dips, propose sandbox writes, plan backfills |
| Jordan Hale | Approver | Accept or deny the **exact** action hash; mint a sandbox credential |
| Sam Okonkwo | Security owner | Kill switches (Health) |
| Riley Park | Auditor | Read the append-only audit stream |
| Alex Voss | OS owner | Evals, simulations, signed releases |

---

## What this version is

**v3.0 — Selected Stage D**

- There is **no global autonomous switch**. “Enable autonomous mode for everyone” is refused.
- A Stage D grant, if issued, must name one principal, one tool, one task, and a risk ceiling. Wildcards and writes are denied. A grant never promotes itself.
- Releases sign and verify through a **demo KMS**. `--skip-signature-check` does not exist. Raw PEMs are not accepted.
- A **live warehouse** adapter is registered and policy-gated. This demo has no DSN. Writes stay disabled.
- Everything from v2.1 still holds: incident briefs, evidence packs, session budget, sandbox writes after exact-hash approval, plan-only backfills, eight operator simulations

**Not in this version**

- Real SSO / accounts (the header switcher is not a login)
- A live warehouse DSN
- Production backfill execution
- Arbitrary plugins or MCP install

---

## Everyday keyboard

| Key | Action |
| --- | --- |
| ⌘K / Ctrl+K | Jump, switch who you are, run a playbook |
| ⌘↵ / Ctrl+Enter | Submit in Work |
| Header select | Switch principal |

---

## For contributors

```
src/kernel/     control plane (policy, tools, evals, credentials, simulations)
src/routes/     portal (Work, Guide, Approvals, …)
docs/           public HTML site (not Jekyll)
migrations/     unowned control snapshot — personal memory is never stored here
```

```bash
npm test         # invariants, eval hard gates, eight operator simulations
npm run typecheck
```

If a critical security eval fails, the release is `blocked`. You cannot average it away.

Principles that will not be reopened casually: intersection permissions, isolated personal memory, no arbitrary plugins, agents cannot deploy themselves, production runs only signed artifacts, tool output is not policy, abstention is success, stage progression is evidence-driven.

See [CONTRIBUTING.md](CONTRIBUTING.md), [ROADMAP.md](ROADMAP.md), and [SECURITY.md](SECURITY.md).

## License

Apache License 2.0. See [LICENSE](LICENSE).
