import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { bootstrapFn, listTasksFn, overviewFn, submitWorkFn } from "@/lib/api";
import { featuredPlaybooks, WORK_STARTERS } from "@/lib/playbooks";
import { useFoveaSession } from "@/lib/session";
import { cn, formatUsd, shortId } from "@/lib/utils";
import type { EvidencePack, NextAction, WorkResult } from "@/kernel/types";
import { evidencePackJson } from "@/kernel/evidence";

type Search = { q?: string };

export const Route = createFileRoute("/_portal/work")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  component: WorkPage,
});

function WorkPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const principalId = useFoveaSession((s) => s.principalId);
  const setPrincipalId = useFoveaSession((s) => s.setPrincipalId);
  const [draft, setDraft] = useState(q ?? "");
  const [threads, setThreads] = useState<Record<string, WorkResult[]>>({});
  const [selectedId, setSelectedId] = useState<Record<string, string | null>>({});
  const autoRanQ = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => bootstrapFn() });
  const overview = useQuery({
    queryKey: ["overview", principalId],
    queryFn: () => overviewFn({ data: { principalId } }),
  });
  const history = useQuery({
    queryKey: ["tasks", principalId],
    queryFn: () => listTasksFn({ data: { principalId } }),
  });
  const roles = boot.data?.principals.find((p) => p.id === principalId)?.roles ?? ["analyst"];
  const actor = boot.data?.principals.find((p) => p.id === principalId);
  const covering = overview.data?.coveringGrants ?? [];
  const liveRead = covering.find((g) => g.continuesReads);
  const books = featuredPlaybooks(roles, WORK_STARTERS).map((b) =>
    b.id === "northstar" && liveRead
      ? { ...b, why: "Covered — sibling canonical reads continue." }
      : b,
  );
  const thread = threads[principalId] ?? [];
  const selected = thread.find((t) => t.taskId === selectedId[principalId]) ?? null;

  const mut = useMutation({
    mutationFn: (input: { message: string; as: string }) =>
      submitWorkFn({ data: { principalId: input.as, message: input.message } }),
    onSuccess: (res, vars) => {
      setThreads((t) => ({ ...t, [vars.as]: [...(t[vars.as] ?? []), res] }));
      setSelectedId((s) => ({ ...s, [vars.as]: res.taskId }));
      setDraft("");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!q?.trim()) return;
    if (autoRanQ.current === q) return;
    autoRanQ.current = q;
    setDraft(q);
    mut.mutate({ message: q, as: principalId });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-run once per q, never on principal switch
  }, [q]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread.length, mut.isPending, selected?.taskId]);

  const runAs = (message: string, as = principalId) => {
    if (!message.trim()) return;
    mut.mutate({ message: message.trim(), as });
  };

  const follow = (action: NextAction) => {
    const [path, query] = action.href.split("?");
    const nextQ = new URLSearchParams(query ?? "").get("q");
    if (action.asPrincipalId && action.asPrincipalId !== principalId) {
      setPrincipalId(action.asPrincipalId);
      if (path === "/work") {
        autoRanQ.current = nextQ ? null : autoRanQ.current;
        void navigate({ to: "/work", search: nextQ ? { q: nextQ } : {} });
        return;
      }
      void navigate({ to: (path || "/") as "/" });
      return;
    }
    if (path === "/work" && nextQ) {
      setDraft(nextQ);
      runAs(nextQ);
      return;
    }
    if (path === "/approvals") {
      void navigate({ to: "/approvals" });
      return;
    }
    if (path === "/policies") {
      void navigate({ to: "/policies" });
      return;
    }
    if (path === "/") {
      void navigate({ to: "/" });
      return;
    }
    void navigate({ to: "/work", search: nextQ ? { q: nextQ } : {} });
  };

  return (
    <div className="grid min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
      <div className="flex min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
        <div className="border-b border-border px-5 py-5 md:px-8">
          <div className="text-[11px] uppercase tracking-[0.18em] text-subtle">Work console</div>
          <h1 className="mt-1 font-display text-4xl tracking-tight">Ask with evidence</h1>
          <p className="mt-2 max-w-lg text-sm text-muted">
            Every answer is classified. Unsupported confidence is a failure. This console is this desk’s session —
            switching the header does not replay the last question as someone else. Production execution stays disabled.
          </p>
          <p className="mt-3 font-mono text-[11px] text-subtle">
            Session budget {formatUsd(overview.data?.budgetRemainingUsd ?? 25, 2)} left of{" "}
            {formatUsd(overview.data?.budgetUsd ?? 25, 0)}
          </p>
          {liveRead ? (
            <p className="mt-3 rounded-[var(--radius-md)] border border-border-strong bg-surface-2 px-3 py-2 text-sm text-fg">
              Selected workflow live · {liveRead.task} continues sibling reads. Not a global switch.
            </p>
          ) : covering.length ? (
            <p className="mt-3 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
              Named grant live · {covering[0].tool} / {covering[0].task}. Selected workflow only.
            </p>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 md:px-8">
          {thread.length === 0 ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {books.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setDraft(s.q);
                      runAs(s.q);
                    }}
                    className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-left hover:border-border-strong"
                  >
                    <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">{s.kicker}</div>
                    <div className="mt-1 text-sm text-fg">{s.q}</div>
                    <div className="mt-1 text-xs text-muted">{s.why}</div>
                  </button>
                ))}
              </div>
              {(history.data?.length ?? 0) > 0 ? (
                <p className="text-xs text-muted">
                  {history.data!.length} earlier task{history.data!.length === 1 ? "" : "s"} live on{" "}
                  <Link to="/tasks" className="underline">
                    Tasks
                  </Link>
                  . They are not replayed here.
                </p>
              ) : null}
            </>
          ) : null}
          {thread.map((item) => (
            <article key={item.taskId} className="flex w-full flex-col gap-2">
              <div className="ml-auto w-fit max-w-[90%] rounded-[var(--radius-md)] bg-surface-2 px-4 py-3 text-sm">
                {item.userRequest}
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId((s) => ({ ...s, [principalId]: item.taskId }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId((s) => ({ ...s, [principalId]: item.taskId }));
                  }
                }}
                className={cn(
                  "block w-full max-w-[95%] rounded-[var(--radius-lg)] border bg-surface p-4 text-left",
                  selected?.taskId === item.taskId ? "border-border-strong" : "border-border",
                )}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <ClaimBadge cls={item.answer?.claimClass ?? "inferred"} />
                  <Badge>{item.status.replace("_", " ")}</Badge>
                  {item.skillId ? <Badge tone="info">{item.skillId}</Badge> : null}
                  {item.behaviors.includes("grant_chained") ? <Badge tone="info">continued</Badge> : null}
                  {item.behaviors.includes("grant_covers") && !item.behaviors.includes("grant_chained") ? (
                    <Badge>covered</Badge>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{item.answer?.text}</p>
                {item.nextAction ? (
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="text-xs text-muted">{item.nextAction.hint}</span>
                    <span
                      role="link"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        follow(item.nextAction!);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          follow(item.nextAction!);
                        }
                      }}
                      className="shrink-0 text-xs font-medium text-fg underline-offset-2 hover:underline"
                    >
                      {item.nextAction.label}
                    </span>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
          {mut.isPending ? <p className="text-sm text-muted">Evaluating policy, then retrieving evidence…</p> : null}
          <div ref={bottomRef} />
        </div>
        <form
          className="border-t border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            runAs(draft.trim());
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (draft.trim() && !mut.isPending) runAs(draft.trim());
              }
            }}
            placeholder="Ask a named metric, plan a backfill, or try an adversarial prompt."
            rows={3}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-subtle">
              Acting as {actor?.displayName ?? principalId} ·{" "}
              <kbd className="rounded border border-border px-1 py-0.5 font-mono">⌘↵</kbd> run
            </span>
            <Button type="submit" disabled={mut.isPending || !draft.trim()}>
              Run
            </Button>
          </div>
        </form>
      </div>
      <EvidencePane result={selected} onFollow={follow} />
    </div>
  );
}

function ClaimBadge({ cls }: { cls: string }) {
  const tone =
    cls === "supported" || cls === "derived" || cls === "abstention"
      ? "ok"
      : cls === "refusal" || cls === "unsupported"
        ? "danger"
        : "warn";
  return <Badge tone={tone as "ok"}>{cls}</Badge>;
}

function EvidencePane({
  result,
  onFollow,
}: {
  result: WorkResult | null;
  onFollow: (action: NextAction) => void;
}) {
  if (!result) {
    return (
      <div className="p-6 text-sm text-muted">
        Evidence inspector. Policy decisions, queries, provenance, and cost appear here after a task runs.
      </div>
    );
  }
  return (
    <div className="overflow-y-auto p-5 md:p-6">
      <h2 className="font-display text-2xl">Evidence</h2>
      <p className="mt-1 font-mono text-[11px] text-subtle">{result.taskId}</p>
      {result.nextAction ? (
        <button
          type="button"
          onClick={() => onFollow(result.nextAction!)}
          className="mt-4 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface-2 px-4 py-3 text-left"
        >
          <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">Next</div>
          <div className="mt-1 text-sm font-medium">{result.nextAction.label}</div>
          <p className="mt-1 text-xs text-muted">{result.nextAction.hint}</p>
        </button>
      ) : null}
      {result.evidencePack ? (
        <div className="mt-3 rounded-[var(--radius-md)] border border-border bg-bg px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">Evidence pack</div>
          <div className="mt-1 font-mono text-[11px] text-muted">
            {result.evidencePack.claimClass} · {result.evidencePack.metrics.length} metrics ·{" "}
            {result.evidencePack.queryHashes.length} queries · {shortId(result.evidencePack.outputHash, 10)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const json = evidencePackJson(result.evidencePack!);
                void navigator.clipboard.writeText(json).then(
                  () => toast.success("Evidence pack copied."),
                  () => toast.message(json.slice(0, 180)),
                );
              }}
            >
              Copy JSON
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => downloadEvidence(result.evidencePack!)}>
              Download
            </Button>
          </div>
        </div>
      ) : null}
      <Section title="Policy">
        {groupPolicy(result.policy).map((p, i) => (
          <div key={i} className="rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs">
                {p.decision}
                {p.count > 1 ? ` ×${p.count}` : ""}
              </span>
              <span className="text-[11px] text-subtle">{p.policyVersion}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{p.reason}</p>
          </div>
        ))}
      </Section>
      {result.provenance?.queries.length ? (
        <Section title={result.provenance.queries.length > 1 ? "Queries" : "Query"}>
          <ul className="space-y-1.5">
            {result.provenance.queries.map((q, i) => (
              <li key={q.jobId} className="rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-fg">
                    {result.provenance!.metricDefinitions[i]?.replace(/_/g, " ") ?? q.tables[0] ?? q.jobId}
                    {i === 0 && result.provenance!.queries.length > 1 ? " · primary" : i > 0 ? " · sibling" : ""}
                  </span>
                  <span className="font-mono text-[11px] text-subtle">{q.jobId}</span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-muted">{q.tables.join(", ")}</p>
                {q.sql ? (
                  <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-muted">{q.sql}</pre>
                ) : i === 0 && result.sql ? (
                  <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-muted">
                    {result.sql.query}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
          {result.sql ? (
            <p className="mt-2 text-xs text-muted">
              Dry-run {result.sql.dryRun.valid ? "valid" : "invalid"} · est. {formatUsd(result.sql.dryRun.estimatedCost, 3)}
            </p>
          ) : null}
        </Section>
      ) : result.sql ? (
        <Section title="Query">
          <pre className="overflow-x-auto rounded-[var(--radius-sm)] bg-bg p-3 font-mono text-[11px] leading-relaxed text-muted">
            {result.sql.query}
          </pre>
          <p className="mt-2 text-xs text-muted">
            Dry-run {result.sql.dryRun.valid ? "valid" : "invalid"} · est. {formatUsd(result.sql.dryRun.estimatedCost, 3)}
          </p>
        </Section>
      ) : null}
      {result.plan ? (
        <Section title="Backfill plan">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <Field k="Hash" v={shortId(result.plan.planHash, 12)} />
            <Field k="Adapter" v={result.plan.adapter.label} />
            <Field k="Estimate" v={formatUsd(result.plan.cost.expectedUsd)} />
            <Field k="Dry-run" v={formatUsd(result.plan.cost.dryRunUsd)} />
            <Field k="Variance" v={`${result.plan.cost.variancePct}%`} />
            <Field k="Rollback" v={result.plan.rollback.strategy} />
            <Field k="Partitions" v={String(result.plan.resolvedPartitions.length)} />
            <Field k="Risk" v={`T${result.plan.riskTier}`} />
          </dl>
          <p className="mt-2 text-xs text-muted">Downstream: {result.plan.downstreamImpact.join(", ") || "none"}</p>
          <p className="mt-1 text-xs text-muted">
            Failed partitions:{" "}
            {result.plan.partitionStates.filter((p) => p.status === "failed").map((p) => p.partition).join(", ") || "none"}
          </p>
          <p className="mt-1 text-xs text-muted">Order: {result.plan.dependencyOrder.join(" → ")}</p>
        </Section>
      ) : null}
      {result.approvals.length ? (
        <Section title="Approvals">
          {result.approvals.map((a) => (
            <div key={a.approvalId} className="rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{shortId(a.proposedActionHash, 12)}</span>
                <span className="text-[11px] text-subtle">{a.executionStatus}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{a.actionSummary}</p>
              {a.decision === "pending" ? (
                <Link to="/approvals" className="mt-2 inline-block text-xs underline">
                  Decide on Approvals
                </Link>
              ) : null}
            </div>
          ))}
        </Section>
      ) : null}
      {result.provenance ? (
        <Section title="Provenance">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <Field k="Result" v={result.provenance.resultId} />
            <Field k="Agent" v={result.provenance.agentRelease} />
            <Field k="Policy" v={result.provenance.policyRelease} />
            <Field k="Output" v={shortId(result.provenance.outputHash, 10)} />
          </dl>
        </Section>
      ) : null}
      <Section title="Behaviors">
        <div className="flex flex-wrap gap-1.5">
          {result.behaviors.map((b) => (
            <Badge key={b}>{b}</Badge>
          ))}
        </div>
      </Section>
      <Section title="Cost">
        <p className="text-sm">{formatUsd(result.cost.totalUsd, 3)}</p>
      </Section>
    </div>
  );
}

function groupPolicy(policy: WorkResult["policy"]) {
  const grouped: Array<WorkResult["policy"][number] & { count: number }> = [];
  for (const p of policy) {
    const last = grouped[grouped.length - 1];
    if (last && last.decision === p.decision && last.reason === p.reason) {
      last.count += 1;
    } else {
      grouped.push({ ...p, count: 1 });
    }
  }
  return grouped;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function downloadEvidence(pack: EvidencePack) {
  const json = evidencePackJson(pack);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${pack.resultId}.evidence.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Evidence pack downloaded.");
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-subtle">{k}</div>
      <div className="font-mono text-fg">{v}</div>
    </div>
  );
}
