import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { decideApprovalFn, executeApprovedFn, listApprovalsFn } from "@/lib/api";
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
  const replay = useMutation({
    mutationFn: (approvalId: string) => executeApprovedFn({ data: { approvalId, actorId } }),
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
        description="Approvals bind to an exact action hash. Switch to Jordan Hale to decide. Sandbox writes mint a short-lived credential and execute. Production stays disabled."
      />
      <div className="space-y-3 p-4 md:p-8">
        {(q.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">
            No approvals. Act as Maya Chen, propose a sandbox write from Work, then switch to Jordan Hale to decide
            the exact hash.
          </p>
        ) : (
          q.data!.map((a) => (
            <article key={a.approvalId} className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{a.actionSummary}</div>
                  <div className="mt-1 font-mono text-[11px] text-subtle">
                    {a.approvalId} · hash {shortId(a.proposedActionHash, 12)} · {formatUsd(a.estimatedCost)}
                  </div>
                  <div className="mt-1 text-[11px] text-subtle">
                    {String(a.approvedConstraints.kind ?? "action")}
                    {a.approvedConstraints.table ? ` · ${String(a.approvedConstraints.table)}` : ""}
                    {a.credentialId ? ` · cred ${shortId(a.credentialId, 10)}` : ""}
                  </div>
                </div>
                <Badge tone={a.decision === "pending" ? "warn" : a.decision === "approved" ? "ok" : "danger"}>
                  {a.decision}
                </Badge>
              </div>
              {a.decision === "pending" ? (
                <div className="mt-4 flex flex-wrap gap-2">
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
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted">
                    Decided by {a.approver ?? "—"}. {a.executionNote || executionCopy(a.executionStatus)}
                  </p>
                  {a.decision === "approved" && String(a.approvedConstraints.kind) === "sandbox_write" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => replay.mutate(a.approvalId)}
                    >
                      Replay sandbox write
                    </Button>
                  ) : null}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function executionCopy(status: string) {
  if (status === "sandbox_executed") return "Executed in sandbox after credential mint.";
  if (status === "sandbox_replayed") return "Idempotent replay — no additional rows.";
  if (status === "disabled_prod") return "Production execution remains disabled.";
  if (status === "blocked_hash_mismatch") return "Hash mismatch. No credential minted.";
  return "No write executed.";
}
