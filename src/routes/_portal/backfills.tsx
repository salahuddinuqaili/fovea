import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { listTasksFn } from "@/lib/api";
import { formatUsd } from "@/lib/utils";

export const Route = createFileRoute("/_portal/backfills")({ component: BackfillsPage });

function BackfillsPage() {
  const q = useQuery({ queryKey: ["all-tasks"], queryFn: () => listTasksFn({ data: {} }) });
  const plans = (q.data ?? []).filter((t) => t.plan);

  return (
    <div>
      <PageHeader
        kicker="Operate"
        title="Backfills"
        description="Backfills are governed plans: lineage, blast radius, cost, idempotency, rollback. v0 is plan-only."
      />
      <div className="p-4 md:p-8">
        {plans.length === 0 ? (
          <p className="text-sm text-muted">
            No plans yet.{" "}
            <Link to="/work" search={{ q: "Backfill the affected partitions after the upstream correction." }} className="underline">
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
                  {t.plan!.targetNodes.join(", ")} · {t.plan!.resolvedPartitions.length} partitions ·{" "}
                  {formatUsd(t.plan!.expectedCost)} · downstream {t.plan!.downstreamImpact.length}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
