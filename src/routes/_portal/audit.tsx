import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { listAuditFn } from "@/lib/api";
import { useFoveaSession } from "@/lib/session";

export const Route = createFileRoute("/_portal/audit")({ component: AuditPage });

function AuditPage() {
  const actorId = useFoveaSession((s) => s.principalId);
  const q = useQuery({
    queryKey: ["audit", actorId],
    queryFn: () => listAuditFn({ data: { actorId } }),
  });

  return (
    <div>
      <PageHeader
        kicker="Govern"
        title="Audit"
        description="Append-only event chain. Switch to Riley Park (auditor) or Sam Okonkwo (security) if your current role is denied."
      />
      <div className="p-4 md:p-8">
        {q.data && !q.data.ok ? (
          <p className="text-sm text-danger">{q.data.error}</p>
        ) : (
          <ol className="space-y-2 font-mono text-[12px] text-muted">
            {(q.data && q.data.ok ? q.data.events : []).map((e) => (
              <li key={e.eventId} className="rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2">
                <span className="text-subtle">{e.timestamp}</span> · <span className="text-fg">{e.eventType}</span> ·{" "}
                {e.summary}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
