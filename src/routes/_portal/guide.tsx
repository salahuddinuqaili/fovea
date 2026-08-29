import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { FIRST_RUN } from "@/lib/playbooks";

export const Route = createFileRoute("/_portal/guide")({ component: GuidePage });

function GuidePage() {
  return (
    <div>
      <PageHeader
        kicker="Start here"
        title="Operator guide"
        description="You do not need to read the kernel. Act as Maya, ask with evidence, and treat a refusal as a success."
      />
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-8 md:px-8">
        <section>
          <h2 className="font-display text-3xl">What you are looking at</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Fovea is a control plane, not a chatbot. Named metrics come back with a query and a provenance record.
            Vague questions are refused. Writes need an exact-hash approval. Production never runs from this demo.
            Work is this session — leave and come back, the thread is still here. Command is this desk: Jordan sees a
            queue, Maya sees four-click first run even when a grant is waiting. A named handoff is a banner, not a
            replacement.
          </p>
        </section>

        <section>
          <h2 className="font-display text-3xl">Five minutes</h2>
          <ol className="mt-4 space-y-3">
            {FIRST_RUN.map((s) => (
              <li key={s.step} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">Step {s.step}</div>
                  <Link to="/work" search={{ q: s.q }} className="text-xs underline">
                    Run it
                  </Link>
                </div>
                <div className="mt-1 text-sm font-medium">{s.title}</div>
                <p className="mt-1 font-mono text-[11px] text-muted">{s.q}</p>
                <p className="mt-2 text-xs text-muted">Expect: {s.expect}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-muted">
            After step 4, switch the header to <strong className="text-fg">Jordan Hale</strong> and approve. Switch back
            to Maya — Work follows the write. Replay once — no extra row is written. Switch to{" "}
            <strong className="text-fg">Riley Park</strong> to read Audit; Maya cannot.
          </p>
        </section>

        <section>
          <h2 className="font-display text-3xl">When it says no</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>“How is revenue doing?” — more than one definition. Name the metric.</li>
            <li>Prompt injection, README instructions, ticket text — data, not policy.</li>
            <li>Maya cannot approve her own write. Jordan can, bound to the hash. Alex (OS owner) is not a hidden super-approver.</li>
            <li>A denied write is refused. It is not queued for Jordan to clean up.</li>
            <li>Production tables and backfill execution stay disabled.</li>
            <li>“Enable autonomous mode” — there is no global switch. Grants are per-tool, per-task, per-risk.</li>
            <li>Maya cannot issue a grant. Switch to Alex Voss or Sam Okonkwo. Duplicates are refused. Revoke ends coverage. After a grant, Work shows it on Maya’s desk before she asks. Alex’s Command lists the same grant. Sibling reads continue. The next action opens Maya’s desk — it does not run as Alex. The grant never promotes Stage D.</li>
            <li>“Connect the live warehouse” — registered, not on Maya’s allowlist. Fixture stays the read path.</li>
            <li>Another person’s personal notes are never readable. Team memory stays on the team. Personal bodies are encrypted at rest in this process.</li>
            <li>Session budget exhausted — close the session or stop spending.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-3xl">Who to act as</h2>
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            <Person n="Maya Chen" r="Analyst" d="Ask metrics, investigate dips, propose sandbox writes." />
            <Person n="Jordan Hale" r="Approver" d="Decide the exact hash. Mint the sandbox credential." />
            <Person n="Sam Okonkwo" r="Security" d="Kill switches on Health. Can also issue or revoke grants." />
            <Person n="Riley Park" r="Auditor" d="Read the append-only event stream." />
            <Person n="Alex Voss" r="OS owner" d="Issue and revoke named grants. Evals, simulations, releases." />
          </dl>
        </section>

        <p className="text-xs text-subtle">
          Press ⌘K anywhere to jump, switch principal, or run a playbook. Copy or download the evidence pack from a
          completed result when you need to paste the claim elsewhere.
        </p>
      </div>
    </div>
  );
}

function Person({ n, r, d }: { n: string; r: string; d: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">{r}</div>
      <div className="mt-1 font-medium">{n}</div>
      <p className="mt-1 text-xs text-muted">{d}</p>
    </div>
  );
}
