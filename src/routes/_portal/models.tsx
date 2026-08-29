import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { bootstrapFn } from "@/lib/api";

export const Route = createFileRoute("/_portal/models")({ component: ModelsPage });

function ModelsPage() {
  const q = useQuery({ queryKey: ["bootstrap"], queryFn: () => bootstrapFn() });
  return (
    <div>
      <PageHeader
        kicker="Platform"
        title="Models"
        description="Provider-neutral gateway. Routing is evidence-based. A generic benchmark winner is not automatically eligible for a critical internal task. Model changes are production changes."
      />
      <div className="grid gap-3 p-4 md:p-8">
        {(q.data?.models ?? []).map((m) => (
          <article key={m.alias} className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{m.alias}</div>
                <div className="text-xs text-muted">
                  {m.providerClass} · {m.endpointClass}
                </div>
              </div>
              <Badge tone={m.status === "approved" ? "ok" : "warn"}>{m.status}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-subtle">
              {Object.entries(m.evalScores).map(([k, v]) => (
                <span key={k} className="rounded-full border border-border px-2 py-0.5">
                  {k} {v.toFixed(2)}
                </span>
              ))}
            </div>
          </article>
        ))}
        <p className="text-sm text-muted">
          {q.data?.xaiAvailable
            ? "An enterprise model endpoint is configured. Freeform questions may use it; golden paths stay deterministic."
            : "No network model key in this environment. Golden analytical paths use the deterministic router."}
        </p>
      </div>
    </div>
  );
}
