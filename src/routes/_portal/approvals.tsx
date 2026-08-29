import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { decideApprovalFn, listApprovalsFn } from "@/lib/api";
import { useFoveaSession } from "@/lib/session";
import { formatUsd, shortId } from "@/lib/utils";

export const Route = createFileRoute("/_portal/approvals")({ component: ApprovalsPage });

function ApprovalsPage() {
  const actorId = useFoveaSession((s) => s.principalId);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["approvals"], queryFn: () => listApprovalsFn() });
  const mut = useMutation({
    mutationFn: (d: { approvalId: string; decision: "approved" | "denied" }) =>
      decideApprovalFn({ data: { ...d, actorId } }),
    onSuccess: (res) => {
      toast.message(res.note);
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        kicker="Operate"
        title="Approvals"
        description="Approvals are objects bound to an exact action hash — not chat confirmations. Switch to Jordan Hale to decide. Stage B still will not execute writes."
      />
      <div className="space-y-3 p-4 md:p-8">
        {(q.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">No approvals. Plan a backfill from Work to create one.</p>
        ) : (
          q.data!.map((a) => (
            <article key={a.approvalId} className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{a.actionSummary}</div>
                  <div className="mt-1 font-mono text-[11px] text-subtle">
                    {a.approvalId} · hash {shortId(a.proposedActionHash, 12)} · {formatUsd(a.estimatedCost)}
                  </div>
                </div>
                <Badge tone={a.decision === "pending" ? "warn" : a.decision === "approved" ? "ok" : "danger"}>
                  {a.decision}
                </Badge>
              </div>
              {a.decision === "pending" ? (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => mut.mutate({ approvalId: a.approvalId, decision: "approved" })}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => mut.mutate({ approvalId: a.approvalId, decision: "denied" })}
                  >
                    Deny
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  Decided by {a.approver ?? "—"}. Execution remains disabled in Stage B.
                </p>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
