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
| Same line as **Alex Voss** | A **named grant** is stored. Switch to Maya — Work shows the grant before she asks. Alex’s Command lists Maya’s grant. |
| Same line again as Alex | **Refused.** An active grant already covers that workflow. Revoke it first. |
| Maya’s Work console | A chip: **Selected workflow live**. Command says Maya · investigate-metric continues. |
| Maya then asks north-star revenue | **Covered**, **short sibling lines**, **sibling SQL** in Evidence. Still no write. |
| Switch the header while a `?q=` is in the URL | The last question is **not** replayed as the new person. |
| *Revoke Maya warehouse.query for investigate-metric.* as Alex | Coverage ends. Maya’s next metric is a single query again. |
| *Connect the live warehouse.* | **Gated.** The adapter is registered. Maya cannot arm it. Writes stay disabled. |
| The sandbox `INSERT` from Command (or ⌘K → Sandbox write) | **Needs approval.** Maya cannot approve her own write. |
| Then switch the header to **Jordan Hale** | Jordan’s Command shows the pending hash. Approvals is pending-first. |
| Approve as Jordan | A short-lived sandbox credential. One row. Replay does nothing. |
| Switch to **Alex Voss** and try to approve Maya’s write | **Refused.** OS owners are not hidden super-approvers. |
| A denied write (writes killed, or policy deny) | **Refused.** No approval is queued. |
| Leave Work and come back this session | The thread is still there. `?q=` is consumed once. |
| Switch to **Riley Park**, open Audit, then switch back to Maya | Riley can read the stream. Maya’s Command shows this desk only. |
| Switch to **Jordan** with nothing pending | Command is a queue, not Maya’s four-click first run. |
| Memory as Riley | Team conventions are not visible. Maya’s personal body is ciphertext until she opens it. |

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
| Duplicate grant refused | An active grant already covers that workflow. | Revoke it first, then re-issue if you mean to. |
| “Selected workflow live” on Work | This desk has a covering grant. | Ask a named metric. Sibling reads continue. Revoke from Policy if it should stop. |
| “Covered by named grant…” plus sibling lines | The selected `investigate-metric` workflow continued in-task. | Evidence lists every query **and its SQL**. Writes stay hash-bound. |
| Alex’s Command says “none covering this desk” after a grant | It shouldn’t. v8 lists the issued grant on the issuer’s desk. | Refresh Command. Health also names who holds the grant. |
| Switching Maya → Jordan re-ran the sandbox INSERT | That was a v7 defect. | v8 does not auto-run `q` on a principal switch. |
| “Connect the live warehouse” gated | The live adapter is not on the OS allowlist. | Ask a named metric. The fixture is still the read path. |
| Work thread vanished after Approvals | That was a v8 gap. | v9 keeps this session’s Work in the tab. |
| Alex could approve Maya’s write | That was a hidden super-approver. | Only Jordan (approver, not the requester) can decide. |

A confident wrong number is a failure. A refusal is not.

---

## Who you are acting as

The header switcher (or **⌘K → Act as**) is not a login. It is whose desk you are sitting at. There is no “admin who can do everything.” Permissions **intersect**. They never union.

| Person | Role | Try this |
| --- | --- | --- |
| Maya Chen | Analyst | Ask metrics, investigate dips, propose sandbox writes, plan backfills |
| Jordan Hale | Approver | Accept or deny the **exact** action hash; mint a sandbox credential |
| Sam Okonkwo | Security owner | Kill switches (Health); issue or revoke named grants |
| Riley Park | Auditor | Read the append-only audit stream |
| Alex Voss | OS owner | Issue and revoke named grants; evals, simulations, signed releases |

---

## What this version is

**v10.0 — Desk-true Command / honest storage**

- **Command is this desk.** Maya sees the four-click first run. Jordan sees a queue, not Maya’s onboarding. Riley’s home is Audit. Alex’s home is the grant roster.
- **Personal memory is actually encrypted** at rest in process, and still never written to the unowned snapshot. Team memory is scoped to the caller’s team.
- Sandbox **UPDATE/DELETE need WHERE**. A snapshot does not store sandbox SQL.
- Fifteen operator simulations as a release input.

**Not in this version**

- Real SSO / accounts (the header switcher is not a login)
- A live warehouse DSN
- Production backfill execution
- Arbitrary plugins or MCP install
- A global autonomous switch (not planned)

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
npm test         # invariants, eval hard gates, fifteen operator simulations
npm run typecheck
```

If a critical security eval fails, the release is `blocked`. You cannot average it away.

Principles that will not be reopened casually: intersection permissions, isolated personal memory, no arbitrary plugins, agents cannot deploy themselves, production runs only signed artifacts, tool output is not policy, abstention is success, stage progression is evidence-driven.

See [CONTRIBUTING.md](CONTRIBUTING.md), [ROADMAP.md](ROADMAP.md), and [SECURITY.md](SECURITY.md).

## License

Apache License 2.0. See [LICENSE](LICENSE).
