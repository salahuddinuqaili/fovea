import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { getCostFn } from "@/lib/api";
import { useFoveaSession } from "@/lib/session";
import { formatUsd } from "@/lib/utils";

export const Route = createFileRoute("/_portal/cost")({ component: CostPage });

function CostPage() {
  const principalId = useFoveaSession((s) => s.principalId);
  const q = useQuery({
    queryKey: ["cost", principalId],
    queryFn: () => getCostFn({ data: { principalId } }),
  });
  const chart = Object.entries(q.data?.byKind ?? {}).map(([kind, amount]) => ({ kind, amount }));
  const budgetUsd = q.data?.budgetUsd ?? 25;
  const remainingUsd = q.data?.remainingUsd ?? 25;
  const spentUsd = q.data?.spentUsd ?? 0;
  const usedPct = budgetUsd > 0 ? Math.min(100, (spentUsd / budgetUsd) * 100) : 0;

  return (
    <div>
      <PageHeader
        kicker="Platform"
        title="Cost"
        description="Quality and security first. When the session budget is gone, Fovea stops starting paid work."
      />
      <div className="p-4 md:p-8">
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">Session spent</div>
            <div className="mt-1 font-display text-5xl tabular-nums">{formatUsd(spentUsd, 3)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">Remaining of {formatUsd(budgetUsd, 0)}</div>
            <div className="mt-1 font-display text-5xl tabular-nums">{formatUsd(remainingUsd, 2)}</div>
          </div>
          <div className="flex flex-col justify-end">
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-accent" style={{ width: `${usedPct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">
              Demo sessions start at $25. Exhausted sessions block new warehouse and model calls until you close them.
            </p>
          </div>
        </div>
        <div className="h-56 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
          {chart.length === 0 ? (
            <p className="text-sm text-muted">No spend yet. Run a metric question in Work.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <XAxis dataKey="kind" stroke="#6b6b73" fontSize={12} />
                <YAxis stroke="#6b6b73" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#111113", border: "1px solid rgba(242,240,234,0.12)", color: "#f2f0ea" }}
                />
                <Bar dataKey="amount" fill="#c5cdd6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <ul className="mt-6 space-y-2 text-sm text-muted">
          {(q.data?.items ?? []).slice(0, 12).map((c) => (
            <li key={c.id} className="flex justify-between font-mono text-xs">
              <span>
                {c.kind} · {c.detail}
              </span>
              <span>{formatUsd(c.amountUsd, 3)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
