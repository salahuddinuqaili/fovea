import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { runEvalsFn, runSimulationsFn } from "@/lib/api";
import type { EvalReport } from "@/kernel/types";
import type { SimulationResult } from "@/kernel/simulations";
import { useState } from "react";

export const Route = createFileRoute("/_portal/evals")({ component: EvalsPage });

function EvalsPage() {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [sims, setSims] = useState<{
    passed: boolean;
    simulations: SimulationResult[];
    friction: string[];
  } | null>(null);
  const evalMut = useMutation({
    mutationFn: () => runEvalsFn(),
    onSuccess: setReport,
    onError: (e: Error) => toast.error(e.message),
  });
  const simMut = useMutation({
    mutationFn: () => runSimulationsFn(),
    onSuccess: setSims,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        kicker="Govern"
        title="Evaluations"
        description="Hard gates cannot be averaged away. Thirteen operator desks, including control-plane integrity: the running kernel wins when the snapshot lags, pending execute is denied, grants stay issuer-visible."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => evalMut.mutate()} disabled={evalMut.isPending}>
              {evalMut.isPending ? "Running suite…" : "Run golden + adversarial"}
            </Button>
            <Button variant="secondary" onClick={() => simMut.mutate()} disabled={simMut.isPending}>
              {simMut.isPending ? "Simulating…" : "Run operator simulations"}
            </Button>
          </div>
        }
      />
      <div className="space-y-10 p-4 md:p-8">
        {sims ? (
          <section>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-sm font-medium">Operator simulations</h2>
              <Badge tone={sims.passed ? "ok" : "danger"}>{sims.passed ? "all passed" : "friction found"}</Badge>
            </div>
            {sims.friction.length ? (
              <p className="mb-3 text-sm text-warn">Friction: {sims.friction.join(" ")}</p>
            ) : (
              <p className="mb-3 text-sm text-muted">No operator friction recorded. Next actions routed correctly.</p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {sims.simulations.map((s) => (
                <article key={s.id} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{s.title}</div>
                      <div className="text-xs text-muted">{s.persona}</div>
                    </div>
                    <Badge tone={s.passed ? "ok" : "danger"}>{s.passed ? "pass" : "fail"}</Badge>
                  </div>
                  <ul className="mt-3 space-y-1 font-mono text-[11px] text-muted">
                    {s.steps.map((st) => (
                      <li key={st.name}>
                        {st.passed ? "ok" : "fail"} · {st.name} · {st.detail}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ) : null}

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
