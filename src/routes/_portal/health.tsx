import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { healthFn, setKillFn, bootstrapFn } from "@/lib/api";
import { useFoveaSession } from "@/lib/session";

export const Route = createFileRoute("/_portal/health")({ component: HealthPage });

function HealthPage() {
  const actorId = useFoveaSession((s) => s.principalId);
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => bootstrapFn() });
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
  const actor = boot.data?.principals.find((p) => p.id === actorId);
  const canKill = Boolean(actor?.roles.includes("security_owner") || actor?.roles.includes("os_owner"));

  return (
    <div>
      <PageHeader
        kicker="Govern"
        title="Health"
        description="The running kernel’s signed release wins when the snapshot lags. Kill switches revoke without a redeploy. Switch to Sam Okonkwo (security) to use them."
      />
      <div className="grid gap-4 p-4 md:grid-cols-3 md:p-8">
        <Card k="OS" v={h?.os ?? "—"} tone={h?.os === "up" ? "ok" : "danger"} />
        <Card k="Write plane" v={h?.writePlane ?? "—"} tone={h?.writePlane !== "disabled" ? "ok" : "danger"} />
        <Card k="Kernel" v={h?.kernel ?? "—"} tone="ok" />
        <Card
          k="Snapshot"
          v={h?.aligned ? "Aligned" : (h?.snapshotVersion ?? "lagging")}
          tone={h?.aligned ? "ok" : "warn"}
        />
        <Card k="KMS" v={h?.kms?.ok ? "Verified" : "Blocked"} tone={h?.kms?.ok ? "ok" : "danger"} />
        <Card
          k="Live warehouse"
          v={liveConnected ? "Connected" : "Gated"}
          tone={!liveWritesOff ? "danger" : liveConnected ? "ok" : "warn"}
        />
        <Card k="Pending approvals" v={String(h?.pendingApprovals ?? 0)} tone="ok" />
        <Card k="Open handoffs" v={String(h?.openHandoffs ?? 0)} tone="ok" />
        <Card k="Active grants" v={String(h?.activeGrants ?? 0)} tone="ok" />
      </div>
      {canKill ? (
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
      ) : (
        <p className="px-4 text-sm text-muted md:px-8">
          Kill switches require Sam Okonkwo (security) or Alex Voss (OS owner). Analysts and approvers cannot flip them.
        </p>
      )}
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
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 md:col-span-2">
          <h2 className="text-sm font-medium">Named grants</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(h?.activeGrantViews ?? []).length === 0 ? (
              <li className="text-muted">None active. Issue one from Policy as Alex or Sam.</li>
            ) : (
              (h?.activeGrantViews ?? []).map((g) => (
                <li key={g.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    {g.principalName} · {g.tool} / {g.task}
                  </span>
                  <Badge tone="ok">{g.continuesReads ? "continues" : "named"}</Badge>
                </li>
              ))
            )}
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
