import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { healthFn, setKillFn } from "@/lib/api";
import { useFoveaSession } from "@/lib/session";

export const Route = createFileRoute("/_portal/health")({ component: HealthPage });

function HealthPage() {
  const actorId = useFoveaSession((s) => s.principalId);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["health"], queryFn: () => healthFn() });
  const mut = useMutation({
    mutationFn: (patch: { writePlane?: boolean; entireOs?: boolean }) => setKillFn({ data: { actorId, patch } }),
    onSuccess: () => {
      toast.success("Kill switch updated.");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const h = q.data;
  const live = h?.warehouses?.find((w) => w.id === "live");
  const liveConnected = Boolean(live?.connected);
  const liveWritesOff = live?.writes === "disabled";

  return (
    <div>
      <PageHeader
        kicker="Govern"
        title="Health"
        description="Revocation does not require a source deployment. Switch to Sam Okonkwo (security) to use the kill switches."
      />
      <div className="grid gap-4 p-4 md:grid-cols-3 md:p-8">
        <Card k="OS" v={h?.os ?? "—"} tone={h?.os === "up" ? "ok" : "danger"} />
        <Card k="Write plane" v={h?.writePlane ?? "—"} tone={h?.writePlane !== "disabled" ? "ok" : "danger"} />
        <Card k="Pending approvals" v={String(h?.pendingApprovals ?? 0)} tone="ok" />
        <Card k="KMS" v={h?.kms?.ok ? "Verified" : "Blocked"} tone={h?.kms?.ok ? "ok" : "danger"} />
        <Card
          k="Live warehouse"
          v={liveConnected ? "Connected" : "Gated"}
          tone={!liveWritesOff ? "danger" : liveConnected ? "ok" : "warn"}
        />
        <Card
          k="Active grants"
          v={String(h?.activeGrants ?? 0)}
          tone="ok"
        />
      </div>
      <div className="flex flex-wrap gap-2 px-4 md:px-8">
        <Button variant="secondary" onClick={() => mut.mutate({ writePlane: true })}>
          Disable writes
        </Button>
        <Button variant="secondary" onClick={() => mut.mutate({ writePlane: false })}>
          Restore writes (gated)
        </Button>
        <Button variant="danger" onClick={() => mut.mutate({ entireOs: true })}>
          Disable OS
        </Button>
        <Button variant="secondary" onClick={() => mut.mutate({ entireOs: false })}>
          Restore OS
        </Button>
      </div>
      <div className="grid gap-6 p-4 md:grid-cols-2 md:p-8">
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
          <h2 className="text-sm font-medium">Models</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(h?.models ?? []).map((m) => (
              <li key={m.alias} className="flex justify-between">
                <span>{m.alias}</span>
                <Badge tone={m.status === "approved" ? "ok" : "danger"}>{m.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
          <h2 className="text-sm font-medium">Tools</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(h?.tools ?? []).map((t) => (
              <li key={t.id} className="flex justify-between gap-3">
                <span className="truncate">{t.id}</span>
                <Badge tone={t.status === "approved" ? "ok" : "danger"}>{t.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Card({ k, v, tone }: { k: string; v: string; tone: "ok" | "warn" | "danger" }) {
  const label = tone === "ok" ? "healthy" : tone === "warn" ? "gated" : "degraded";
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">{k}</div>
      <div className="mt-2 font-display text-3xl">{v}</div>
      <Badge className="mt-2" tone={tone}>
        {label}
      </Badge>
    </div>
  );
}
