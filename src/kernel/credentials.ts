import { digestObject, uuid } from "./crypto.ts";
import { executeSandboxWrite, type SandboxWriteResult } from "./sandbox.ts";
import { isProdTable, validateSandboxWriteSql } from "./sql.ts";
import type { KernelStore } from "./store.ts";
import type { Approval, WriteCredential } from "./types.ts";

export type ExecutionOutcome =
  | "sandbox_executed"
  | "sandbox_replayed"
  | "disabled_prod"
  | "blocked_hash_mismatch"
  | "blocked_kill"
  | "blocked_expired"
  | "blocked"
  | "denied";

export interface ExecutionReport {
  approval: Approval;
  execution: ExecutionOutcome;
  credential: WriteCredential | null;
  sandbox: SandboxWriteResult | null;
  note: string;
}

export function proposedActionFrom(approval: Approval): Record<string, string | number | boolean | null> {
  const c = approval.approvedConstraints;
  return {
    kind: String(c.kind ?? ""),
    sql: String(c.sql ?? ""),
    table: String(c.table ?? ""),
    idempotencyKey: String(c.idempotencyKey ?? ""),
    planHash: String(c.planHash ?? ""),
  };
}

export function hashProposedAction(approval: Approval): string {
  const kind = String(approval.approvedConstraints.kind ?? "");
  if (kind === "backfill") {
    return String(approval.approvedConstraints.planHash ?? approval.proposedActionHash);
  }
  if (kind === "sandbox_write") {
    return digestObject({
      kind: "sandbox_write",
      sql: String(approval.approvedConstraints.sql ?? ""),
      table: String(approval.approvedConstraints.table ?? ""),
      idempotencyKey: String(approval.approvedConstraints.idempotencyKey ?? ""),
    });
  }
  return digestObject({
    kind: kind || "prod_write",
    sql: String(approval.approvedConstraints.sql ?? ""),
    table: String(approval.approvedConstraints.table ?? ""),
    summary: approval.actionSummary,
    resources: approval.affectedResources,
    cost: approval.estimatedCost,
  });
}

export function mintCredential(
  store: KernelStore,
  input: {
    approval: Approval;
    mintedBy: string;
    ttlSeconds?: number;
  },
): WriteCredential {
  const ttl = input.ttlSeconds ?? 900;
  const cred: WriteCredential = {
    credentialId: `cred_${uuid().slice(0, 10)}`,
    approvalId: input.approval.approvalId,
    actionHash: input.approval.proposedActionHash,
    mintedForPrincipalId: input.approval.requestedBy,
    mintedBy: input.mintedBy,
    scope: "sandbox",
    allowedResources: input.approval.affectedResources.filter((r) => r.startsWith("sandbox.")),
    idempotencyKey: String(input.approval.approvedConstraints.idempotencyKey ?? input.approval.approvalId),
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    mintedAt: new Date().toISOString(),
    consumedAt: null,
    status: "minted",
  };
  store.state.credentials.unshift(cred);
  return cred;
}

export function executeApprovedAction(
  store: KernelStore,
  input: { approvalId: string; actorId: string },
): ExecutionReport {
  const approval = store.state.approvals.find((a) => a.approvalId === input.approvalId);
  if (!approval) {
    throw new Error("Unknown approval");
  }
  const reconstructed = hashProposedAction(approval);
  if (reconstructed !== approval.proposedActionHash) {
    approval.executionStatus = "blocked_hash_mismatch";
    approval.executionNote = "Action hash does not match the bound proposal. No credential minted.";
    return {
      approval,
      execution: "blocked_hash_mismatch",
      credential: null,
      sandbox: null,
      note: approval.executionNote,
    };
  }

  if (approval.decision !== "approved") {
    approval.executionNote = "Refused. A pending or denied approval cannot mint a credential or execute.";
    return {
      approval,
      execution: "denied",
      credential: null,
      sandbox: null,
      note: approval.executionNote,
    };
  }

  const kind = String(approval.approvedConstraints.kind ?? "");
  if (kind !== "sandbox_write") {
    approval.executionStatus = "disabled_prod";
    approval.executionNote =
      "Approval is bound to the exact action hash. Production and backfill execution remain disabled in v1. Stage C sandbox writes are the only executable path.";
    return {
      approval,
      execution: "disabled_prod",
      credential: null,
      sandbox: null,
      note: approval.executionNote,
    };
  }

  if (store.state.kill.writePlane || store.state.kill.entireOs) {
    approval.executionStatus = "blocked_kill";
    approval.executionNote = "Kill switch blocked credential minting and sandbox execution.";
    return {
      approval,
      execution: "blocked_kill",
      credential: null,
      sandbox: null,
      note: approval.executionNote,
    };
  }

  const table = String(approval.approvedConstraints.table ?? "");
  const sql = String(approval.approvedConstraints.sql ?? "");
  if (!table.startsWith("sandbox.") || isProdTable(table)) {
    approval.executionStatus = "disabled_prod";
    approval.executionNote = "Refused. Production tables cannot receive a write credential.";
    return {
      approval,
      execution: "disabled_prod",
      credential: null,
      sandbox: null,
      note: approval.executionNote,
    };
  }
  const valid = validateSandboxWriteSql(sql);
  if (!valid.ok) {
    approval.executionStatus = "blocked";
    approval.executionNote = valid.notes.join(" ");
    return {
      approval,
      execution: "blocked",
      credential: null,
      sandbox: null,
      note: approval.executionNote,
    };
  }

  let cred = store.state.credentials.find(
    (c) => c.approvalId === approval.approvalId && (c.status === "minted" || c.status === "consumed"),
  );
  if (!cred) {
    cred = mintCredential(store, { approval, mintedBy: input.actorId });
    store.emit({
      taskId: approval.taskId,
      sessionId: null,
      principalId: input.actorId,
      eventType: "credential.minted",
      resourceIds: [cred.credentialId, table],
      correlationId: approval.taskId,
      summary: `Short-lived sandbox credential ${cred.credentialId} bound to hash ${approval.proposedActionHash.slice(0, 12)}`,
    });
  }

  if (new Date(cred.expiresAt).getTime() < Date.now() && cred.status !== "consumed") {
    cred.status = "expired";
    approval.executionStatus = "blocked_expired";
    approval.executionNote = "Sandbox credential expired. Re-approval required.";
    return {
      approval,
      execution: "blocked_expired",
      credential: cred,
      sandbox: null,
      note: approval.executionNote,
    };
  }

  const result = executeSandboxWrite(store.state.sandbox, {
    sql,
    approvalId: approval.approvalId,
    credentialId: cred.credentialId,
    idempotencyKey: cred.idempotencyKey,
  });
  if (!result.ok) {
    approval.executionStatus = "blocked";
    approval.executionNote = result.blocked ?? "Sandbox write blocked.";
    return {
      approval,
      execution: "blocked",
      credential: cred,
      sandbox: result,
      note: approval.executionNote,
    };
  }

  if (!result.replayed) {
    cred.status = "consumed";
    cred.consumedAt = new Date().toISOString();
  }
  const outcome: ExecutionOutcome = result.replayed ? "sandbox_replayed" : "sandbox_executed";
  approval.executionStatus = outcome;
  approval.credentialId = cred.credentialId;
  approval.executionNote = result.replayed
    ? `Idempotent replay of ${result.writeId} on ${result.table}. No additional rows written.`
    : `Sandbox write ${result.writeId} executed on ${result.table} (${result.rowsAffected} row). Production was not touched.`;

  const task = store.state.tasks.find((t) => t.taskId === approval.taskId);
  if (task && !result.replayed) {
    task.status = "completed";
    task.behaviors = [...task.behaviors, "sandbox_write_executed", "credential_consumed"];
    if (task.answer) {
      task.answer = {
        ...task.answer,
        text: `${task.answer.text}\n\n${approval.executionNote}`,
      };
    }
  }

  store.emit({
    taskId: approval.taskId,
    sessionId: null,
    principalId: input.actorId,
    eventType: result.replayed ? "sandbox.write_replayed" : "sandbox.write_executed",
    resourceIds: [result.table, cred.credentialId],
    correlationId: approval.taskId,
    summary: approval.executionNote,
  });

  return {
    approval,
    execution: outcome,
    credential: cred,
    sandbox: result,
    note: approval.executionNote,
  };
}
