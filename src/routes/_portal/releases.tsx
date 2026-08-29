import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bootstrapFn, tryReleaseFn } from "@/lib/api";
import { shortId } from "@/lib/utils";

export const Route = createFileRoute("/_portal/releases")({ component: ReleasesPage });

function ReleasesPage() {
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => bootstrapFn() });
  const mut = useMutation({
    mutationFn: (kind: "current" | "tampered" | "unsigned") => tryReleaseFn({ data: { kind } }),
    onSuccess: (res) => {
      toast[res.ok ? "success" : "error"](res.ok ? "Release verified and loaded." : res.verification.reasons.join(" "));
      void qc.invalidateQueries();
    },
  });
  const rel = boot.data?.release;

  return (
    <div>
      <PageHeader
        kicker="Govern"
        title="Releases"
        description="Production executes authorized artifacts, not repository state. Signatures go through the KMS key id. There is no --skip-signature-check."
      />
      <div className="space-y-6 p-4 md:p-8">
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">v{rel?.version ?? "—"}</h2>
            <Badge tone={boot.data?.verification.ok ? "ok" : "danger"}>
              {boot.data?.verification.ok ? "verified" : "rejected"}
            </Badge>
          </div>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <Row k="Commit" v={rel?.sourceCommit ?? "—"} />
            <Row k="Digest" v={shortId(rel?.artifactDigest ?? "", 16)} />
            <Row k="Signer" v={rel?.signer ?? "—"} />
            <Row k="KMS key" v={rel?.keyId ?? "—"} />
            <Row k="Algorithm" v={rel?.algorithm ?? "—"} />
            <Row k="Built" v={rel?.builtAt ?? "—"} />
          </dl>
          {boot.data?.loadError ? <p className="mt-3 text-sm text-danger">{boot.data.loadError}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => mut.mutate("current")}>
            Load signed
          </Button>
          <Button variant="secondary" onClick={() => mut.mutate("unsigned")}>
            Load unsigned
          </Button>
          <Button variant="secondary" onClick={() => mut.mutate("tampered")}>
            Load tampered
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.12em] text-subtle">{k}</div>
      <div className="mt-1 font-mono text-xs">{v}</div>
    </div>
  );
}
