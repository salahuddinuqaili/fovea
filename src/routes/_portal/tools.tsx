import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { bootstrapFn } from "@/lib/api";

export const Route = createFileRoute("/_portal/tools")({ component: ToolsPage });

function ToolsPage() {
  const q = useQuery({ queryKey: ["bootstrap"], queryFn: () => bootstrapFn() });
  return (
    <div>
      <PageHeader
        kicker="Platform"
        title="Tool registry"
        description="Every enterprise tool is registered before an agent can call it. Arbitrary plugins and MCP servers cannot be installed into the governed environment."
      />
      <div className="grid gap-3 p-4 md:grid-cols-2 md:p-8">
        {(q.data?.tools ?? []).map((t) => (
          <article key={t.id} className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="font-mono text-sm">{t.id}</div>
              <Badge tone={t.status === "approved" ? "ok" : "danger"}>{t.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">{t.description}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-subtle">
              <div>risk T{t.riskTier}</div>
              <div>output {t.outputTrust}</div>
              <div>injection {t.promptInjectionRisk}</div>
              <div>{t.capabilities.join(", ")}</div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
