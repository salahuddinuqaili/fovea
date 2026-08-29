import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { getCostFn } from "@/lib/api";
import { formatUsd } from "@/lib/utils";

export const Route = createFileRoute("/_portal/cost")({ component: CostPage });

function CostPage() {
  const q = useQuery({ queryKey: ["cost"], queryFn: () => getCostFn({ data: {} }) });
  const chart = Object.entries(q.data?.byKind ?? {}).map(([kind, amount]) => ({ kind, amount }));

  return (
    <div>
      <PageHeader
        kicker="Platform"
        title="Cost"
        description="Optimize cost subject to quality and security constraints, never the reverse."
      />
      <div className="p-4 md:p-8">
        <div className="mb-6 font-display text-5xl tabular-nums">{formatUsd(q.data?.total ?? 0, 3)}</div>
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
