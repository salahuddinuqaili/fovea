import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { bootstrapFn, openHandoffFn, overviewFn } from "@/lib/api";
import { FIRST_RUN, COMMAND_FEATURED, featuredPlaybooks } from "@/lib/playbooks";
import { useFoveaSession } from "@/lib/session";
import { formatUsd } from "@/lib/utils";

export const Route = createFileRoute("/_portal/")({ component: CommandCenter });

function CommandCenter() {
  const principalId = useFoveaSession((s) => s.principalId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => bootstrapFn() });
  const q = useQuery({
    queryKey: ["overview", principalId],
    queryFn: () => overviewFn({ data: { principalId } }),
  });
  const data = q.data;
  const verified = boot.data?.verification.ok ?? data?.verification.ok ?? false;
  const principal = boot.data?.principals.find((p) => p.id === principalId);
  const books = featuredPlaybooks(principal?.roles ?? ["analyst"], COMMAND_FEATURED);
  const inbox = data?.inbox;
  const hasInbox = Boolean((inbox?.handoffs.length ?? 0) + (inbox?.pendingForDesk.length ?? 0));
  const openInbox = useMutation({
    mutationFn: (handoffId: string) => openHandoffFn({ data: { actorId: principalId, handoffId } }),
    onSuccess: (res) => {
      void qc.invalidateQueries();
      if (!res.ok) return;
      const path = res.handoff.href.split("?")[0] || "/";
      if (path === "/approvals") {
        void navigate({ to: "/approvals" });
        return;
      }
      if (path === "/policies") {
        void navigate({ to: "/policies" });
        return;
      }
      if (path === "/work") {
        void navigate({ to: "/work" });
        return;
      }
      void navigate({ to: "/" });
    },
  });

  return (
    <div>
      <PageHeader
        kicker="Control plane"
        title="Command"
        description="This is this desk. Handoffs land here. Writes need an exact-hash approval. Analysts cannot mint a credential. New here? Open the operator guide."
        actions={
          <Link to="/guide" className="text-sm underline">
            Operator guide
          </Link>
        }
      />
      <div className="grid gap-4 p-4 md:grid-cols-4 md:p-8">
        <Stat
          label="Autonomy"
          value="Stage B"
          hint={autonomyHint(
            boot.data?.activeGrants ?? 0,
            q.data?.coveringGrants,
            principal?.displayName,
            boot.data?.activeGrantViews,
          )}
        />
        <Stat
          label="Release"
          value={verified ? "Verified" : "Blocked"}
          hint={boot.data?.agentRelease ?? data?.release?.version ?? "—"}
        />
        <Stat
          label="This desk"
          value={String((inbox?.handoffs.length ?? 0) + (inbox?.pendingForDesk.length ?? 0))}
          hint={
            (inbox?.pendingForDesk.length ?? 0) > 0
              ? `${inbox!.pendingForDesk.length} pending hash${inbox!.pendingForDesk.length === 1 ? "" : "es"}`
              : "Named handoffs, eight-hour TTL"
          }
        />
        <Stat
          label="Budget left"
          value={formatUsd(data?.budgetRemainingUsd ?? 25, 2)}
          hint={`${formatUsd(data?.spentUsd ?? 0, 3)} spent of ${formatUsd(data?.budgetUsd ?? 25, 0)}`}
        />
      </div>

      {hasInbox ? (
        <section className="mx-4 mb-6 rounded-[var(--radius-lg)] border border-border-strong bg-surface p-5 md:mx-8">
          <h2 className="text-sm font-medium">Waiting on {principal?.displayName.split(" ")[0] ?? "this desk"}</h2>
          <p className="mt-1 text-xs text-muted">
            Named handoffs, not a global queue. Opening one switches this desk — it does not run as someone else.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {(inbox?.pendingForDesk ?? []).map((a) => (
              <Link
                key={a.approvalId}
                to="/approvals"
                className="rounded-[var(--radius-md)] border border-border bg-bg p-4 hover:border-border-strong"
              >
                <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">
                  Pending · {a.requestedByName}
                </div>
                <div className="mt-1 text-sm text-fg">{a.actionSummary}</div>
                <div className="mt-1 font-mono text-[11px] text-muted">
                  {a.hash.slice(0, 12)}… · {formatUsd(a.estimatedCost, 2)}
                </div>
              </Link>
            ))}
            {(inbox?.handoffs ?? []).map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => openInbox.mutate(h.id)}
                className="rounded-[var(--radius-md)] border border-border bg-bg p-4 text-left hover:border-border-strong"
              >
                <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">
                  {h.kind} · {h.fromName}
                </div>
                <div className="mt-1 text-sm text-fg">{h.label}</div>
                <div className="mt-1 text-xs text-muted">{h.hint}</div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-4 mb-6 rounded-[var(--radius-lg)] border border-border bg-surface p-5 md:mx-8">
          <h2 className="text-sm font-medium">
            {(data?.tasks.length ?? 0) === 0 ? "Start here — four clicks" : "Four-click first run"}
          </h2>
          <ol className="mt-3 grid gap-2 md:grid-cols-2">
            {FIRST_RUN.map((s) => (
              <Link
                key={s.step}
                to="/work"
                search={{ q: s.q }}
                className="rounded-[var(--radius-md)] border border-border bg-bg p-4 hover:border-border-strong"
              >
                <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">Step {s.step}</div>
                <div className="mt-1 text-sm text-fg">{s.title}</div>
                <div className="mt-1 text-xs text-muted">{s.expect}</div>
              </Link>
            ))}
          </ol>
        </section>

      <div className="grid gap-6 px-4 pb-10 md:grid-cols-3 md:px-8">
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">Playbooks for {principal?.displayName ?? "this principal"}</h2>
              <p className="mt-1 text-xs text-muted">Filtered by role. Press ⌘K to jump anywhere.</p>
            </div>
            <Link to="/work" className="flex items-center gap-1 text-xs text-muted hover:text-fg">
              Open work <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {books.map((p) => (
              <Link
                key={p.id}
                to="/work"
                search={{ q: p.q }}
                className="rounded-[var(--radius-md)] border border-border bg-bg p-4 text-left transition-colors hover:border-border-strong"
              >
                <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">{p.kicker}</div>
                <div className="mt-1 text-sm text-fg">{p.q}</div>
                <div className="mt-1 text-xs text-muted">{p.why}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
          <h2 className="text-sm font-medium">Invariants</h2>
          <ul className="mt-3 space-y-3 text-sm text-muted">
            <li>Permissions intersect. They never union.</li>
            <li>Tool output is untrusted data, not policy.</li>
            <li>Personal memory cannot be read cross-user.</li>
            <li>Unsigned releases cannot load.</li>
            <li>Abstention is a success state.</li>
          </ul>
          <p className="mt-4 text-xs text-subtle">
            Switch to Jordan Hale before approving. Analysts cannot mint write credentials.
          </p>
        </section>
      </div>

      <div className="grid gap-6 px-4 pb-16 md:grid-cols-2 md:px-8">
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-medium">Recent tasks</h2>
          <div className="space-y-2">
            {(data?.tasks ?? []).length === 0 ? (
              <p className="text-sm text-muted">No tasks yet. Open Work and ask a canonical metric question.</p>
            ) : (
              data!.tasks.map((t) => (
                <Link
                  key={t.taskId}
                  to="/tasks/$taskId"
                  params={{ taskId: t.taskId }}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2.5"
                >
                  <span className="truncate text-sm">{t.title}</span>
                  <StatusBadge status={t.status} />
                </Link>
              ))
            )}
          </div>
        </section>
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-medium">
            {inbox?.auditScope === "org" ? "Audit stream" : "This desk’s events"}
          </h2>
          <div className="space-y-2 font-mono text-[11px] text-muted">
            {(data?.recentEvents ?? []).slice(0, 8).map((e) => (
              <div key={e.eventId} className="flex gap-3">
                <span className="text-subtle">{e.timestamp.slice(11, 19)}</span>
                <span className="text-fg">{e.eventType}</span>
              </div>
            ))}
            {(data?.recentEvents ?? []).length === 0 ? <p>No events yet.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function autonomyHint(
  active: number,
  covering: { task: string; continuesReads: boolean }[] | undefined,
  name?: string,
  views?: { principalName: string; task: string; continuesReads: boolean }[],
) {
  const live = (covering ?? []).find((g) => g.continuesReads);
  if (live) {
    const who = name?.split(" ")[0] ?? "this desk";
    return `${who} · ${live.task} continues`;
  }
  if ((covering ?? []).length) {
    return `${covering!.length} covering this desk · selected workflow only`;
  }
  const roster = views ?? [];
  if (roster.length) {
    const v = roster[0];
    const who = v.principalName.split(" ")[0];
    return `${who} · ${v.task} live`;
  }
  return `${active} active · none covering this desk`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">{label}</div>
      <div className="mt-2 font-display text-3xl tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted">{hint}</div>
    </div>
  );
}
