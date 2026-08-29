import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { bootstrapFn, listTasksFn } from "@/lib/api";
import { formatUsd } from "@/lib/utils";

export const Route = createFileRoute("/_portal/backfills")({ component: BackfillsPage });

function BackfillsPage() {
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => bootstrapFn() });
  const q = useQuery({ queryKey: ["all-tasks"], queryFn: () => listTasksFn({ data: {} }) });
  const plans = (q.data ?? []).filter((t) => t.plan);
  const adapters = boot.data?.adapters ?? [];

  return (
    <div>
      <PageHeader
        kicker="Operate"
        title="Backfills"
        description="v2 plans through native adapters (dbt + scheduled query): partition state, dry-run cost vs estimate, rollback. Adapter.execute() stays disabled."
      />
      <div className="grid gap-3 p-4 md:grid-cols-2 md:p-8">
        {adapters.map((a) => (
          <article key={a.id} className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">{a.id}</div>
                <h2 className="mt-1 text-sm font-medium">{a.label}</h2>
              </div>
              <Badge tone="warn">exec disabled</Badge>
            </div>
            <p className="mt-2 text-xs text-muted">
              {a.nodeCount} nodes · runtime {a.runtime} · {a.execute.reason.replaceAll("_", " ")}
            </p>
          </article>
        ))}
      </div>
      <div className="px-4 pb-16 md:px-8">
        {plans.length === 0 ? (
          <p className="text-sm text-muted">
            No plans yet.{" "}
            <Link
              to="/work"
              search={{ q: "Backfill the affected partitions after the upstream correction." }}
              className="underline"
            >
              Generate one
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-3">
            {plans.map((t) => (
              <Link
                key={t.taskId}
                to="/tasks/$taskId"
                params={{ taskId: t.taskId }}
                className="rounded-[var(--radius-lg)] border border-border bg-surface p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{t.plan!.id}</div>
                  <StatusBadge status={t.plan!.status} />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {t.plan!.adapter.label} · {t.plan!.targetNodes.join(", ")} · {t.plan!.resolvedPartitions.length}{" "}
                  partitions · est. {formatUsd(t.plan!.cost.expectedUsd)} / dry-run {formatUsd(t.plan!.cost.dryRunUsd)} ·
                  rollback {t.plan!.rollback.strategy}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
