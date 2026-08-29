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
| *Investigate the dip last week.* | An **incident brief** across three canonical metrics. It will not claim the pipeline *caused* the dip. Copy or download the **evidence pack** from the right-hand pane. |
| *Enable autonomous mode for everyone.* | **Refused.** There is no global switch. |
| *Grant Maya warehouse.query for investigate-metric.* as Maya | **Refused.** Only the OS owner can issue a named grant. |
| Same line as **Alex Voss** | A **named grant** is stored. Shadow Stage D stays `promoted=false`. |
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
| “Enable autonomous mode” refused | There is no global switch. | Switch to **Alex Voss** and issue a named grant (one tool, one task, a risk ceiling). |
| Maya cannot issue a grant | Correct. Analysts do not mint Stage D. | Header → **Alex Voss** → Policy, or type the grant line in Work. |
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
| Alex Voss | OS owner | Issue a named grant from Policy or Work; evals, simulations, signed releases |

---

## What this version is

**v4.0 — Grant desk**

- Alex Voss (or Sam) can issue a **named Stage D grant**: one person, one tool, one task, a risk ceiling. Maya cannot. Wildcards and writes are denied. The grant **never promotes itself**.
- There is still **no global autonomous switch**. “Enable autonomous mode for everyone” is refused.
- Command shows Autonomy and Live warehouse playbooks instead of slicing them away. Work starts with six cards, not a wall of SQL. Incident briefs keep their line breaks. Evidence packs copy **and** download.
- Releases sign and verify through a **demo KMS**. `--skip-signature-check` does not exist. Raw PEMs are not accepted.
- A **live warehouse** adapter is registered and policy-gated. This demo has no DSN. Writes stay disabled even after a named grant.
- Nine operator simulations as a release input.

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
npm test         # invariants, eval hard gates, nine operator simulations
npm run typecheck
```

If a critical security eval fails, the release is `blocked`. You cannot average it away.

Principles that will not be reopened casually: intersection permissions, isolated personal memory, no arbitrary plugins, agents cannot deploy themselves, production runs only signed artifacts, tool output is not policy, abstention is success, stage progression is evidence-driven.

See [CONTRIBUTING.md](CONTRIBUTING.md), [ROADMAP.md](ROADMAP.md), and [SECURITY.md](SECURITY.md).

## License

Apache License 2.0. See [LICENSE](LICENSE).
