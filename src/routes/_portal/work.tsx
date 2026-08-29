import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { bootstrapFn, listTasksFn, submitWorkFn } from "@/lib/api";
import { playbooksFor } from "@/lib/playbooks";
import { useFoveaSession } from "@/lib/session";
import { cn, formatUsd, shortId } from "@/lib/utils";
import type { NextAction, WorkResult } from "@/kernel/types";

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
  const [draft, setDraft] = useState(q ?? "");
  const [thread, setThread] = useState<WorkResult[]>([]);
  const [selected, setSelected] = useState<WorkResult | null>(null);
  const autoRan = useRef<string | null>(null);
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => bootstrapFn() });
  const history = useQuery({
    queryKey: ["tasks", principalId],
    queryFn: () => listTasksFn({ data: { principalId } }),
  });
  const roles = boot.data?.principals.find((p) => p.id === principalId)?.roles ?? ["analyst"];
  const books = playbooksFor(roles);

  useEffect(() => {
    setThread([]);
    setSelected(null);
    autoRan.current = null;
  }, [principalId]);

  useEffect(() => {
    if (thread.length || !history.data?.length) return;
    const chronological = [...history.data].reverse();
    setThread(chronological);
    setSelected(history.data[0] ?? null);
  }, [history.data, thread.length]);

  const mut = useMutation({
    mutationFn: (message: string) => submitWorkFn({ data: { principalId, message } }),
    onSuccess: (res) => {
      setThread((t) => [...t, res]);
      setSelected(res);
      setDraft("");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!q?.trim()) return;
    if (autoRan.current === `${principalId}:${q}`) return;
    autoRan.current = `${principalId}:${q}`;
    setDraft(q);
    mut.mutate(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-run once per q+principal
  }, [q, principalId]);

  const follow = (action: NextAction) => {
    const [path, query] = action.href.split("?");
    const nextQ = new URLSearchParams(query ?? "").get("q");
    if (path === "/work" && nextQ) {
      setDraft(nextQ);
      mut.mutate(nextQ);
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
            Every answer is classified. Unsupported confidence is a failure. Sandbox writes execute only after exact-hash
            approval. Production execution stays disabled.
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 md:px-8">
          {thread.length === 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {books.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setDraft(s.q);
                    mut.mutate(s.q);
                  }}
                  className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-left hover:border-border-strong"
                >
                  <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">{s.kicker}</div>
                  <div className="mt-1 text-sm text-fg">{s.q}</div>
                  <div className="mt-1 text-xs text-muted">{s.why}</div>
                </button>
              ))}
            </div>
          ) : null}
          {thread.map((item) => (
            <article key={item.taskId} className="flex w-full flex-col gap-2">
              <div className="ml-auto w-fit max-w-[90%] rounded-[var(--radius-md)] bg-surface-2 px-4 py-3 text-sm">
                {item.userRequest}
              </div>
              <button
                type="button"
                onClick={() => setSelected(item)}
                className={cn(
                  "block w-full max-w-[95%] rounded-[var(--radius-lg)] border bg-surface p-4 text-left",
                  selected?.taskId === item.taskId ? "border-border-strong" : "border-border",
                )}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <ClaimBadge cls={item.answer?.claimClass ?? "inferred"} />
                  <Badge>{item.status.replace("_", " ")}</Badge>
                  {item.skillId ? <Badge tone="info">{item.skillId}</Badge> : null}
                </div>
                <p className="text-sm leading-relaxed text-fg">{item.answer?.text}</p>
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
              </button>
            </article>
          ))}
          {mut.isPending ? <p className="text-sm text-muted">Evaluating policy, then retrieving evidence…</p> : null}
        </div>
        <form
          className="border-t border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            mut.mutate(draft.trim());
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (draft.trim() && !mut.isPending) mut.mutate(draft.trim());
              }
            }}
            placeholder="Ask a named metric, plan a backfill, or try an adversarial prompt."
            rows={3}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-subtle">
              Bound to {principalId} · <kbd className="rounded border border-border px-1 py-0.5 font-mono">⌘↵</kbd> run
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
      <Section title="Policy">
        {result.policy.map((p, i) => (
          <div key={i} className="rounded-[var(--radius-sm)] border border-border bg-bg px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs">{p.decision}</span>
              <span className="text-[11px] text-subtle">{p.policyVersion}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{p.reason}</p>
          </div>
        ))}
      </Section>
      {result.sql ? (
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
            <Field k="Cost" v={formatUsd(result.plan.expectedCost)} />
            <Field k="Partitions" v={String(result.plan.resolvedPartitions.length)} />
            <Field k="Risk" v={`T${result.plan.riskTier}`} />
          </dl>
          <p className="mt-2 text-xs text-muted">Downstream: {result.plan.downstreamImpact.join(", ") || "none"}</p>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-subtle">{k}</div>
      <div className="font-mono text-fg">{v}</div>
    </div>
  );
}
