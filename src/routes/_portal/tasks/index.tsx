import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { listTasksFn } from "@/lib/api";
import { useFoveaSession } from "@/lib/session";

export const Route = createFileRoute("/_portal/tasks/")({ component: TasksPage });

function TasksPage() {
  const principalId = useFoveaSession((s) => s.principalId);
  const q = useQuery({
    queryKey: ["tasks", principalId],
    queryFn: () => listTasksFn({ data: { principalId } }),
  });

  return (
    <div>
      <PageHeader
        kicker="Operate"
        title="Tasks"
        description="Every task is bound to a human principal, a session, and an append-only event chain."
      />
      <div className="p-4 md:p-8">
        {(q.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">No tasks for this principal yet.</p>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-[11px] uppercase tracking-[0.12em] text-subtle">
                <tr>
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Skill</th>
                </tr>
              </thead>
              <tbody>
                {q.data!.map((t) => (
                  <tr key={t.taskId} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link to="/tasks/$taskId" params={{ taskId: t.taskId }} className="hover:underline">
                        {t.title}
                      </Link>
                      <div className="font-mono text-[11px] text-subtle">{t.taskId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">{t.skillId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
