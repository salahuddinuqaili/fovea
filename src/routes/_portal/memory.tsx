import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { listMemoryFn } from "@/lib/api";
import { useFoveaSession } from "@/lib/session";

export const Route = createFileRoute("/_portal/memory")({ component: MemoryPage });

function MemoryPage() {
  const actorId = useFoveaSession((s) => s.principalId);
  const org = useQuery({
    queryKey: ["mem", actorId, "org"],
    queryFn: () => listMemoryFn({ data: { actorId, scope: "org" } }),
  });
  const team = useQuery({
    queryKey: ["mem", actorId, "team"],
    queryFn: () => listMemoryFn({ data: { actorId, scope: "team" } }),
  });
  const personal = useQuery({
    queryKey: ["mem", actorId, "personal"],
    queryFn: () => listMemoryFn({ data: { actorId, scope: "personal" } }),
  });

  return (
    <div>
      <PageHeader
        kicker="Knowledge"
        title="Memory"
        description="Org and team knowledge are governed. Personal memory is encrypted and isolated. Switch to Jordan and you will not see Maya’s private notes."
      />
      <div className="grid gap-4 p-4 md:grid-cols-3 md:p-8">
        <Column title="Organization" items={org.data?.items ?? []} />
        <Column title="Team" items={team.data?.items ?? []} />
        <Column title="Personal" items={personal.data?.items ?? []} empty="No personal items visible to this principal." />
      </div>
    </div>
  );
}

function Column({
  title,
  items,
  empty,
}: {
  title: string;
  items: { id: string; title: string; body: string; path: string; encrypted: boolean }[];
  empty?: string;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="mt-3 space-y-3">
        {items.length === 0 ? <p className="text-sm text-muted">{empty ?? "Empty."}</p> : null}
        {items.map((m) => (
          <article key={m.id} className="rounded-[var(--radius-md)] border border-border bg-bg p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{m.title}</div>
              {m.encrypted ? <Badge>encrypted</Badge> : null}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">{m.body}</p>
            <p className="mt-2 font-mono text-[10px] text-subtle">{m.path}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
