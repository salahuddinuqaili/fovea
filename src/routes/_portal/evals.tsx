import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { runEvalsFn } from "@/lib/api";
import type { EvalReport } from "@/kernel/types";
import { useState } from "react";

export const Route = createFileRoute("/_portal/evals")({ component: EvalsPage });

function EvalsPage() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const mut = useMutation({
    mutationFn: () => runEvalsFn(),
    onSuccess: setReport,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        kicker="Govern"
        title="Evaluations"
        description="Hard gates cannot be averaged away. The eval suite recommends eligibility; it does not possess signing authority."
        actions={
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Running suite…" : "Run golden + adversarial"}
          </Button>
        }
      />
      <div className="p-4 md:p-8">
        {!report ? (
          <p className="text-sm text-muted">Run the suite to produce a release report against a fresh kernel.</p>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3">
              <Badge tone={report.hardGatesPassed ? "ok" : "danger"}>{report.recommendation.replaceAll("_", " ")}</Badge>
              <span className="text-sm text-muted">candidate {report.releaseCandidate}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(report.hardGates).map(([k, v]) => (
                <div key={k} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-subtle">{k.replaceAll("_", " ")}</div>
                  <div className="mt-1 font-display text-3xl tabular-nums">{v}</div>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-[11px] uppercase tracking-[0.12em] text-subtle">
                  <tr>
                    <th className="px-4 py-3">Case</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {report.cases.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-4 py-3 font-mono text-xs">{c.id}</td>
                      <td className="px-4 py-3 text-muted">{c.category}</td>
                      <td className="px-4 py-3">
                        <Badge tone={c.passed ? "ok" : "danger"}>{c.passed ? "pass" : "fail"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
