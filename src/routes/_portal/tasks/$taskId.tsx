import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { getTaskFn } from "@/lib/api";
import { shortId } from "@/lib/utils";

export const Route = createFileRoute("/_portal/tasks/$taskId")({ component: TaskDetail });

function TaskDetail() {
  const { taskId } = Route.useParams();
  const q = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTaskFn({ data: { id: taskId } }),
  });
  const t = q.data;
  if (q.isLoading) {
    return <div className="p-8 text-sm text-muted">Loading task…</div>;
  }
  if (!t) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted">Task not found in this process. Run it from Work first — v0 stores tasks in the control-plane memory of the running instance.</p>
        <Link to="/work" className="mt-3 inline-block text-sm underline">
          Open work
        </Link>
      </div>
    );
  }
  return (
    <div>
      <PageHeader kicker={t.taskId} title={t.title} description={t.userRequest} actions={<StatusBadge status={t.status} />} />
      <div className="grid gap-6 p-4 md:grid-cols-2 md:p-8">
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
          <h2 className="text-sm font-medium">Answer</h2>
          <p className="mt-3 text-sm leading-relaxed">{t.answer?.text}</p>
          {t.nextAction ? (
            <p className="mt-4 text-xs text-muted">
              Next:{" "}
              <Link to={t.nextAction.href.split("?")[0] as "/"} className="underline">
                {t.nextAction.label}
              </Link>
              {" — "}
              {t.nextAction.hint}
            </p>
          ) : null}
        </section>
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
          <h2 className="text-sm font-medium">Provenance</h2>
          <pre className="mt-3 overflow-x-auto font-mono text-[11px] text-muted">
            {JSON.stringify(t.provenance, null, 2)}
          </pre>
        </section>
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 md:col-span-2">
          <h2 className="text-sm font-medium">Event chain</h2>
          <ol className="mt-3 space-y-2 font-mono text-[11px] text-muted">
            {t.events.map((e) => (
              <li key={e.eventId}>
                {e.timestamp} · {e.eventType} · {e.summary} · {shortId(e.eventId, 8)}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
