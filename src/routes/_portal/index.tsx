import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { bootstrapFn, openHandoffFn, overviewFn } from "@/lib/api";
import { FIRST_RUN, COMMAND_FEATURED, featuredPlaybooks, deskHome, deskOf } from "@/lib/playbooks";
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
  const desk = deskOf(principalId);
  const principal = boot.data?.principals.find((p) => p.id === principalId);
  const roles = principal?.roles ?? desk.roles;
  const displayName = principal?.displayName ?? desk.name;
  const firstName = displayName.split(" ")[0];
  const books = featuredPlaybooks(roles, COMMAND_FEATURED);
  const home = deskHome(roles);
  const inbox = data?.inbox;
  const pending = inbox?.pendingForDesk ?? [];
  const handoffs = (inbox?.handoffs ?? []).filter((h) => !(h.kind === "approval" && pending.length > 0));
  const hasHandoffs = handoffs.length > 0;
  const stat = deskStat(home, pending.length, handoffs.length, data?.recentEvents.length ?? 0, boot.data?.activeGrants ?? 0);
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
        description={
          home === "approver"
            ? "This is the approver desk. Pending hashes land here. You cannot approve a write you requested."
            : home === "auditor"
              ? "This is the auditor desk. The stream is append-only. Maya cannot read it."
              : home === "owner"
                ? "This is the OS desk. Issue a named grant — never a global switch. Kill switches live on Health."
                : "This is this desk. Handoffs land here. Writes need an exact-hash approval. Analysts cannot mint a credential."
        }
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
            displayName,
            boot.data?.activeGrantViews,
          )}
        />
        <Stat
          label="Release"
          value={verified ? "Verified" : "Blocked"}
          hint={boot.data?.agentRelease ?? data?.release?.version ?? "—"}
        />
        <Stat label={stat.label} value={stat.value} hint={stat.hint} />
        <Stat
          label="Budget left"
          value={formatUsd(data?.budgetRemainingUsd ?? 25, 2)}
          hint={`${formatUsd(data?.spentUsd ?? 0, 3)} spent of ${formatUsd(data?.budgetUsd ?? 25, 0)}`}
        />
      </div>

      {hasHandoffs ? (
        <section className="mx-4 mb-6 rounded-[var(--radius-lg)] border border-border-strong bg-surface p-5 md:mx-8">
          <h2 className="text-sm font-medium">Waiting on {firstName}</h2>
          <p className="mt-1 text-xs text-muted">
            Named handoffs, not a global queue. Opening one switches this desk — it does not run as someone else. This
            desk’s home stays below.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {handoffs.map((h) => (
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

      {home === "approver" ? (
        <section className="mx-4 mb-6 rounded-[var(--radius-lg)] border border-border bg-surface p-5 md:mx-8">
          {pending.length === 0 ? (
            <>
              <h2 className="text-sm font-medium">Nothing waiting on this desk</h2>
              <p className="mt-2 text-sm text-muted">
                Switch to Maya Chen and propose a sandbox write. The exact hash lands here. You cannot approve a write you
                requested.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-sm font-medium">Pending hashes</h2>
              <p className="mt-1 text-xs text-muted">Exact-action approvals. You cannot decide a write you requested.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {pending.map((a) => (
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
              </div>
            </>
          )}
        </section>
      ) : home === "auditor" ? (
        <section className="mx-4 mb-6 rounded-[var(--radius-lg)] border border-border bg-surface p-5 md:mx-8">
          <h2 className="text-sm font-medium">Auditor desk</h2>
          <p className="mt-2 text-sm text-muted">
            The append-only stream is below. Maya cannot open Audit. You do not issue grants or approve writes.
          </p>
          <Link to="/audit" className="mt-3 inline-block text-sm underline">
            Open Audit
          </Link>
        </section>
      ) : home === "owner" ? (
        <section className="mx-4 mb-6 rounded-[var(--radius-lg)] border border-border bg-surface p-5 md:mx-8">
          <h2 className="text-sm font-medium">Named grants</h2>
          <p className="mt-2 text-sm text-muted">
            One person, one tool, one task, a risk ceiling. This is not a global switch.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {(boot.data?.activeGrantViews ?? []).length === 0 ? (
              <li className="text-muted">None active. Issue one from Policy.</li>
            ) : (
              (boot.data?.activeGrantViews ?? []).map((g) => (
                <li key={g.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    {g.principalName} · {g.tool} / {g.task}
                  </span>
                  <span className="text-xs text-muted">{g.continuesReads ? "continues" : "named"}</span>
                </li>
              ))
            )}
          </ul>
          <Link to="/policies" className="mt-3 inline-block text-sm underline">
            Open Policy
          </Link>
        </section>
      ) : (
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
      )}

      <div className="grid gap-6 px-4 pb-10 md:grid-cols-3 md:px-8">
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">Playbooks for {firstName}</h2>
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

function deskStat(
  home: "analyst" | "approver" | "auditor" | "owner",
  pending: number,
  handoffs: number,
  events: number,
  grants: number,
) {
  if (home === "approver") {
    return {
      label: "Pending",
      value: String(pending),
      hint: pending === 0 ? "Nothing waiting" : `${pending} exact hash${pending === 1 ? "" : "es"}`,
    };
  }
  if (home === "auditor") {
    return {
      label: "This stream",
      value: String(events),
      hint: "Append-only. Maya cannot open it.",
    };
  }
  if (home === "owner") {
    return {
      label: "Named grants",
      value: String(grants),
      hint: grants === 0 ? "None active · selected workflow only" : "Selected workflows only · never a global switch",
    };
  }
  return {
    label: "This desk",
    value: String(handoffs),
    hint: handoffs === 0 ? "Named handoffs, eight-hour TTL" : `${handoffs} named handoff${handoffs === 1 ? "" : "s"} · eight-hour TTL`,
  };
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
