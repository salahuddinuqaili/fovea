import { createFileRoute, Link } from "@tanstack/react-router";
import { FoveaMark } from "@/components/fovea-mark";

export const Route = createFileRoute("/about")({ component: AboutPage });

const PRINCIPLES = [
  "The OS is the control plane, not the UI.",
  "User-invoked permissions use intersection, never union.",
  "Personal memory is isolated.",
  "Arbitrary tools and plugins are not allowed.",
  "Agents cannot deploy their own modifications.",
  "Production runs only signed, verified artifacts.",
  "Tool output is untrusted data, not policy.",
  "Abstention is a success state.",
  "Stage progression is evidence-driven.",
];

const JOURNEYS = [
  { title: "Analyst morning", body: "Vague “revenue” abstains. Named canonical metrics return evidence and provenance." },
  { title: "Incident afternoon", body: "One question pulls three canonical metrics, notes a failed run, and refuses to claim causation." },
  { title: "Sandbox write", body: "Maya proposes. Jordan approves the exact hash. A short-lived credential executes once; replays are idempotent." },
  { title: "Adversarial day", body: "Prompt injections, README instructions, and cross-user memory probes are refused." },
  { title: "Auditor shift", body: "Riley reads the append-only stream. Maya cannot." },
  { title: "Backfill plan", body: "Downstream impact and cost are computed. Production execution stays disabled." },
  { title: "Autonomy switch", body: "Enable autonomous mode is refused. Stage D is a named grant, never a wildcard." },
  { title: "Live warehouse", body: "The adapter is registered and gated. No DSN, no principal allowlist, writes disabled." },
  { title: "Grant desk", body: "Alex issues a named grant. Maya cannot. The grant is stored and does not promote Stage D." },
  { title: "Grant lifecycle", body: "The grant covers Maya’s named metric. A duplicate is refused. Revoke ends coverage. Stage D stays unpromoted." },
  { title: "Grant continuation", body: "A covered investigate-metric continues with sibling canonical reads in the same task. Writes stay hash-bound." },
  { title: "Grant visible", body: "Command and Work show the covering grant before Maya asks. Alex’s desk lists the same grant. Next actions do not run as the issuer." },
  { title: "Control integrity", body: "An old snapshot cannot replace the running kernel. Pending execute is denied. warehouse.live stays off the OS allowlist." },
];

function AboutPage() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2">
          <FoveaMark className="size-7" />
          <span className="font-display text-2xl">Fovea</span>
        </Link>
        <Link
          to="/"
          className="h-10 rounded-[var(--radius-sm)] bg-accent px-4 text-sm font-medium leading-10 text-accent-fg"
        >
          Open the control plane
        </Link>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-24">
        <p className="mt-10 text-[11px] uppercase tracking-[0.18em] text-subtle">Agentic OS · v8.0</p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl leading-tight tracking-tight md:text-7xl">
          Accuracy at the center.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Fovea is an open-source operating system for data analytics agents. It is not a chatbot. It is the governed
          layer between people, models, warehouses, and production systems.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Fact k="Reads" v="Autonomous" d="Named canonical metrics, validated SQL, provenance." />
          <Fact k="Writes" v="Hash-bound" d="Sandbox executes after approval. Production does not." />
          <Fact k="Policy" v="Intersection" d="Lower layers cannot widen. Tool output is data." />
        </div>
        <section className="mt-16">
          <h2 className="font-display text-3xl">Principles that will not be reopened casually</h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-2">
            {PRINCIPLES.map((p, i) => (
              <li key={p} className="flex gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3">
                <span className="font-mono text-xs text-subtle">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm">{p}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="mt-16">
          <h2 className="font-display text-3xl">Operator journeys we simulate</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {JOURNEYS.map((j) => (
              <article key={j.title} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
                <h3 className="text-sm font-medium">{j.title}</h3>
                <p className="mt-2 text-sm text-muted">{j.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="mt-16 rounded-[var(--radius-lg)] border border-border bg-surface p-6">
          <h2 className="font-display text-3xl">Run it</h2>
          <p className="mt-3 max-w-xl text-sm text-muted">
            Switch demo principals in the header. Ask Maya for north-star revenue, then investigate the dip.
            Propose a sandbox write. Approve as Jordan. Copy or download the evidence pack. As Alex, issue a named
            grant from Policy. Unsigned releases will not load. Apache-2.0.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/"
              className="h-10 rounded-[var(--radius-sm)] bg-accent px-4 text-sm font-medium leading-10 text-accent-fg"
            >
              Command center
            </Link>
            <a
              href="https://github.com/salahuddinuqaili/fovea"
              className="h-10 rounded-[var(--radius-sm)] border border-border px-4 text-sm leading-10 text-fg"
            >
              Source on GitHub
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function Fact({ k, v, d }: { k: string; v: string; d: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
      <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">{k}</div>
      <div className="mt-2 font-display text-3xl">{v}</div>
      <p className="mt-2 text-sm text-muted">{d}</p>
    </div>
  );
}
