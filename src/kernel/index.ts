import { MODELS, TOOLS } from "./fixtures.ts";
import { executeApprovedAction } from "./credentials.ts";
import { canReadMemory, revealMemory } from "./memory.ts";
import { listModels, xaiAvailable } from "./models.ts";
import { decideApproval, runWork, savePersonalSkill, followWrite } from "./orchestrator.ts";
import { evaluatePolicy } from "./policy.ts";
import { listNodes } from "./pipeline.ts";
import { listAdapters } from "./adapters.ts";
import { tamper, unsigned, verifyRelease } from "./release.ts";
import { getStore, resetStore, type KernelStore } from "./store.ts";
import { runEvalSuite } from "./evals.ts";
import { runOperatorSimulations } from "./simulations.ts";
import { issueGrant, revokeGrant, findGrant, isGrantActive, coveringGrants, grantContinuesReads } from "./grants.ts";
import { incomingHandoffs, isHandoffOpen, makeHandoff } from "./handoffs.ts";
import { runtimeVerify } from "./kms.ts";
import { listWarehouseProfiles } from "./warehouse.ts";
import type { AutonomyGrant, KillSwitchState, SkillManifest } from "./types.ts";
import { AGENT_RELEASE, KERNEL_VERSION, POLICY_VERSION } from "./types.ts";

export function bootstrap() {
  const store = getStore();
  const release = store.state.loadedRelease;
  const verification = release ? verifyRelease(release) : { ok: false, reasons: ["no release"] };
  return {
    agentRelease: AGENT_RELEASE,
    kernelVersion: KERNEL_VERSION,
    policyVersion: POLICY_VERSION,
    autonomyStage: "B" as const,
    environment: "demo" as const,
    xaiAvailable: xaiAvailable(),
    principals: store.principals().map((p) => ({
      id: p.id,
      displayName: p.displayName,
      title: p.title,
      roles: p.roles,
      teamName: p.teamName,
    })),
    kill: store.state.kill,
    release,
    verification,
    loadError: store.state.loadError,
    metrics: store.state.memory.filter((m) => m.scope === "org"),
    tools: TOOLS,
    models: listModels(),
    pipelines: listNodes(),
    adapters: listAdapters(),
    warehouses: listWarehouseProfiles(),
    kms: runtimeVerify(),
    grants: store.state.grants,
    activeGrants: store.state.grants.filter((g) => isGrantActive(g)).length,
    activeGrantViews: store.state.grants.filter((g) => isGrantActive(g)).map((g) => ({
      id: g.id,
      principalId: g.principalId,
      principalName: store.principal(g.principalId)?.displayName ?? g.principalId,
      tool: g.tool,
      task: g.task,
      continuesReads: grantContinuesReads(g),
      expiresAt: g.expiresAt,
    })),
    skillCount: store.state.skills.length,
    taskCount: store.state.tasks.length,
    pendingApprovals: store.state.approvals.filter((a) => a.decision === "pending").length,
  };
}

export function getOverview(principalId: string) {
  const store = getStore();
  const p = store.principal(principalId);
  const mine = store.state.tasks.filter((t) => t.principalId === principalId);
  const session = store.state.sessions.find((s) => s.humanPrincipalId === principalId);
  const canAudit =
    Boolean(p?.actions.includes("audit.read")) ||
    Boolean(p?.roles.includes("auditor")) ||
    Boolean(p?.roles.includes("security_owner")) ||
    Boolean(p?.roles.includes("os_owner"));
  const canApprove = Boolean(p?.roles.includes("approver"));
  const pending = store.state.approvals.filter((a) => a.decision === "pending");
  const handoffs = incomingHandoffs(store.state.handoffs ?? [], principalId).map((h) => ({
    id: h.id,
    fromName: store.principal(h.fromPrincipalId)?.displayName ?? h.fromPrincipalId,
    kind: h.kind,
    label: h.label,
    href: h.href,
    hint: h.hint,
    expiresAt: h.expiresAt,
  }));
  return {
    principal: p,
    tasks: mine.slice(0, 12),
    allTaskCount: store.state.tasks.length,
    pendingApprovals: pending,
    inbox: {
      auditScope: canAudit ? ("org" as const) : ("desk" as const),
      handoffs,
      pendingForDesk: canApprove
        ? pending.map((a) => ({
            approvalId: a.approvalId,
            requestedByName: store.principal(a.requestedBy)?.displayName ?? a.requestedBy,
            actionSummary: a.actionSummary,
            hash: a.proposedActionHash,
            estimatedCost: a.estimatedCost,
          }))
        : [],
    },
    recentEvents: canAudit
      ? store.state.events.slice(0, 18)
      : store.state.events.filter((e) => e.principalId === principalId).slice(0, 18),
    spentUsd: session?.spentUsd ?? 0,
    budgetUsd: session?.costBudgetUsd ?? 25,
    budgetRemainingUsd: Math.max(0, (session?.costBudgetUsd ?? 25) - (session?.spentUsd ?? 0)),
    kill: store.state.kill,
    release: store.state.loadedRelease,
    verification: store.state.loadedRelease
      ? verifyRelease(store.state.loadedRelease)
      : { ok: false, reasons: ["none"] },
    evalHint: store.state.improvements.length,
    memoryCounts: {
      org: store.state.memory.filter((m) => m.scope === "org").length,
      team: store.state.memory.filter((m) => m.scope === "team").length,
      personal: store.state.memory.filter((m) => m.scope === "personal" && m.ownerPrincipalId === principalId).length,
    },
    coveringGrants: coveringGrants(store.state.grants, principalId).map((g) => ({
      id: g.id,
      tool: g.tool,
      task: g.task,
      actions: g.actions,
      expiresAt: g.expiresAt,
      continuesReads: grantContinuesReads(g),
    })),
  };
}

export async function submitWork(principalId: string, message: string, skillId?: string) {
  return runWork(getStore(), { principalId, message, skillId });
}

export function openHandoff(actorId: string, handoffId: string) {
  const store = getStore();
  const found = store.state.handoffs.find((h) => h.id === handoffId);
  if (!found) return { ok: false as const, error: "Unknown handoff." };
  if (found.toPrincipalId !== actorId) {
    return { ok: false as const, error: "This handoff is not for this desk." };
  }
  if (!isHandoffOpen(found)) return { ok: true as const, handoff: found };
  found.openedAt = new Date().toISOString();
  store.applyHandoff(found);
  store.emit({
    taskId: found.taskId,
    sessionId: null,
    principalId: actorId,
    eventType: "handoff.opened",
    resourceIds: [found.id, found.toPrincipalId],
    correlationId: found.id,
    summary: `Opened handoff ${found.id} on this desk.`,
  });
  return { ok: true as const, handoff: found };
}

export function listTasks(principalId?: string) {
  const store = getStore();
  const list = principalId ? store.state.tasks.filter((t) => t.principalId === principalId) : store.state.tasks;
  return list.map((t) => followWrite(store, t));
}

export function getTask(id: string) {
  const store = getStore();
  const found = store.state.tasks.find((t) => t.taskId === id);
  return found ? followWrite(store, found) : null;
}

export function listApprovals() {
  const all = getStore().state.approvals;
  const pending = all.filter((a) => a.decision === "pending");
  const rest = all.filter((a) => a.decision !== "pending");
  return [...pending, ...rest];
}

export function resolveApproval(approvalId: string, actorId: string, decision: "approved" | "denied") {
  return decideApproval(getStore(), { approvalId, actorId, decision });
}

export function executeApproved(approvalId: string, actorId: string) {
  return executeApprovedAction(getStore(), { approvalId, actorId });
}

export function listAudit(actorId: string) {
  const p = getStore().principal(actorId);
  if (
    !p?.actions.includes("audit.read") &&
    !p?.roles.includes("auditor") &&
    !p?.roles.includes("security_owner") &&
    !p?.roles.includes("os_owner")
  ) {
    return { ok: false as const, error: "Audit view requires auditor or security role." };
  }
  return { ok: true as const, events: getStore().state.events.slice(0, 200) };
}

export function listMemory(actorId: string, scope: "personal" | "team" | "org") {
  const store = getStore();
  const p = store.principal(actorId);
  if (!p) return { ok: false as const, error: "Unknown principal", items: [] };
  const action =
    scope === "personal" ? "memory.read.personal" : scope === "team" ? "memory.read.team" : "memory.read.org";
  const allowed = p.actions.includes(action);
  const items = store.state.memory
    .filter((m) => m.scope === scope && canReadMemory(actorId, m, allowed).ok)
    .map((m) => revealMemory(actorId, m));
  return { ok: true as const, items };
}

export function listSkills(actorId: string) {
  const store = getStore();
  return store.state.skills.filter((s) => s.scope !== "personal" || s.owner === actorId);
}

export function putSkill(actorId: string, skill: SkillManifest) {
  return savePersonalSkill(getStore(), actorId, skill);
}

export function getCost(principalId?: string) {
  const store = getStore();
  const items = principalId ? store.state.costs.filter((c) => c.principalId === principalId) : store.state.costs;
  const byKind: Record<string, number> = {};
  for (const c of items) byKind[c.kind] = (byKind[c.kind] ?? 0) + c.amountUsd;
  const session = principalId
    ? store.state.sessions.find((s) => s.humanPrincipalId === principalId)
    : store.state.sessions[0];
  const budgetUsd = session?.costBudgetUsd ?? 25;
  const spentUsd = session?.spentUsd ?? 0;
  return {
    items: items.slice(0, 80),
    byKind,
    total: items.reduce((s, c) => s + c.amountUsd, 0),
    budgetUsd,
    spentUsd,
    remainingUsd: Math.max(0, budgetUsd - spentUsd),
  };
}

export function getImprovements() {
  return getStore().state.improvements;
}

export async function runEvals() {
  return runEvalSuite("12.0.0");
}

export async function runSimulations() {
  return runOperatorSimulations();
}

export function setKill(actorId: string, patch: Partial<KillSwitchState>) {
  const store = getStore();
  const p = store.principal(actorId);
  if (!p?.roles.includes("security_owner") && !p?.roles.includes("os_owner")) {
    throw new Error("Kill-switch controls require security owner or OS owner.");
  }
  store.state.kill = { ...store.state.kill, ...patch };
  store.emit({
    taskId: null,
    sessionId: null,
    principalId: actorId,
    eventType: "kill_switch.updated",
    resourceIds: Object.keys(patch),
    correlationId: actorId,
    summary: `Kill switch updated: ${JSON.stringify(patch)}`,
  });
  return store.state.kill;
}

export function tryLoadRelease(kind: "current" | "tampered" | "unsigned") {
  const store = getStore();
  const current = store.state.releases[0];
  const candidate = kind === "tampered" ? tamper(current) : kind === "unsigned" ? unsigned(current) : current;
  const verification = verifyRelease(candidate);
  if (!verification.ok) {
    store.state.loadError = verification.reasons.join(" ");
    store.emit({
      taskId: null,
      sessionId: null,
      principalId: "system",
      eventType: "release.rejected",
      resourceIds: [candidate.version],
      correlationId: candidate.artifactDigest,
      summary: store.state.loadError,
    });
    return { ok: false as const, verification, candidate };
  }
  store.state.loadedRelease = candidate;
  store.state.loadError = null;
  return { ok: true as const, verification, candidate };
}

export function health() {
  const store = getStore();
  const snapshotVersion = store.state.loadedRelease?.version ?? null;
  return {
    os: store.state.kill.entireOs ? "disabled" : "up",
    writePlane: store.state.kill.writePlane ? "disabled" : "gated_sandbox_after_approval",
    kernel: AGENT_RELEASE,
    snapshotVersion,
    aligned: snapshotVersion === KERNEL_VERSION,
    models: MODELS.map((m) => ({
      alias: m.alias,
      status: store.state.kill.models.includes(m.alias) ? "disabled" : m.status,
    })),
    tools: TOOLS.map((t) => ({
      id: t.id,
      status: store.state.kill.tools.includes(t.id) ? "disabled" : t.status,
    })),
    release: store.state.loadedRelease,
    verification: store.state.loadedRelease ? verifyRelease(store.state.loadedRelease) : null,
    pendingApprovals: store.state.approvals.filter((a) => a.decision === "pending").length,
    openHandoffs: (store.state.handoffs ?? []).filter((h) => isHandoffOpen(h)).length,
    eventCount: store.state.events.length,
    sandboxWrites: store.state.sandbox.writes.length,
    credentials: store.state.credentials.length,
    adapters: listAdapters(),
    kms: runtimeVerify(),
    warehouses: listWarehouseProfiles(),
    grants: store.state.grants,
    activeGrants: store.state.grants.filter((g) => isGrantActive(g)).length,
    activeGrantViews: store.state.grants.filter((g) => isGrantActive(g)).map((g) => ({
      id: g.id,
      principalId: g.principalId,
      principalName: store.principal(g.principalId)?.displayName ?? g.principalId,
      tool: g.tool,
      task: g.task,
      continuesReads: grantContinuesReads(g),
      expiresAt: g.expiresAt,
    })),
  };
}

export function putGrant(
  actorId: string,
  input: {
    principalId: string;
    tool: string;
    task: string;
    actions: string[];
    maxRisk: AutonomyGrant["maxRisk"];
  },
) {
  const store = getStore();
  const actor = store.principal(actorId);
  if (!actor) throw new Error("Unknown principal");
  const issued = issueGrant(actor, input, store.state.grants);
  if (!issued.ok) return issued;
  store.addGrant(issued.grant);
  if (issued.grant.principalId !== actorId) {
    store.addHandoff(
      makeHandoff({
        fromPrincipalId: actorId,
        toPrincipalId: issued.grant.principalId,
        kind: "work",
        label: `Named grant from ${actor.displayName.split(" ")[0]}`,
        href: "/work",
        hint: `${issued.grant.tool} / ${issued.grant.task} is on this desk. It does not run as the issuer.`,
      }),
    );
  }
  store.emit({
    taskId: null,
    sessionId: null,
    principalId: actorId,
    eventType: "autonomy.grant.issued",
    resourceIds: [issued.grant.id, issued.grant.tool, issued.grant.task],
    correlationId: issued.grant.id,
    summary: `Selected workflow ${issued.grant.tool}/${issued.grant.task} for ${issued.grant.principalId}. Not promoted.`,
  });
  return issued;
}

export function retractGrant(
  actorId: string,
  selector: { grantId?: string; principalId?: string; tool?: string; task?: string },
) {
  const store = getStore();
  const actor = store.principal(actorId);
  if (!actor) throw new Error("Unknown principal");
  const found = findGrant(store.state.grants, selector);
  const retracted = revokeGrant(actor, found);
  if (!retracted.ok) return retracted;
  store.applyGrant(retracted.grant);
  store.emit({
    taskId: null,
    sessionId: null,
    principalId: actorId,
    eventType: "autonomy.grant.revoked",
    resourceIds: [retracted.grant.id, retracted.grant.tool, retracted.grant.task],
    correlationId: retracted.grant.id,
    summary: `Revoked ${retracted.grant.id}. Stage D was not promoted.`,
  });
  return retracted;
}

export { AGENT_RELEASE, KERNEL_VERSION, POLICY_VERSION, evaluatePolicy, getStore, resetStore, runOperatorSimulations, listAdapters, issueGrant, coveringGrants, grantContinuesReads, incomingHandoffs, followWrite };
export type { KernelStore };
