import { MODELS, TOOLS } from "./fixtures.ts";
import { executeApprovedAction } from "./credentials.ts";
import { canReadMemory } from "./memory.ts";
import { listModels, xaiAvailable } from "./models.ts";
import { decideApproval, runWork, savePersonalSkill } from "./orchestrator.ts";
import { evaluatePolicy } from "./policy.ts";
import { listNodes } from "./pipeline.ts";
import { tamper, unsigned, verifyRelease } from "./release.ts";
import { getStore, resetStore, type KernelStore } from "./store.ts";
import { runEvalSuite } from "./evals.ts";
import { runOperatorSimulations } from "./simulations.ts";
import type { KillSwitchState, SkillManifest } from "./types.ts";
import { AGENT_RELEASE, POLICY_VERSION } from "./types.ts";

export function bootstrap() {
  const store = getStore();
  const release = store.state.loadedRelease;
  const verification = release ? verifyRelease(release) : { ok: false, reasons: ["no release"] };
  return {
    agentRelease: AGENT_RELEASE,
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
    skillCount: store.state.skills.length,
    taskCount: store.state.tasks.length,
    pendingApprovals: store.state.approvals.filter((a) => a.decision === "pending").length,
  };
}

export function getOverview(principalId: string) {
  const store = getStore();
  const p = store.principal(principalId);
  const mine = store.state.tasks.filter((t) => t.principalId === principalId);
  const costs = store.state.costs;
  const spent = costs.reduce((s, c) => s + c.amountUsd, 0);
  return {
    principal: p,
    tasks: mine.slice(0, 12),
    allTaskCount: store.state.tasks.length,
    pendingApprovals: store.state.approvals.filter((a) => a.decision === "pending"),
    recentEvents: store.state.events.slice(0, 18),
    spentUsd: spent,
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
  };
}

export async function submitWork(principalId: string, message: string, skillId?: string) {
  return runWork(getStore(), { principalId, message, skillId });
}

export function listTasks(principalId?: string) {
  const store = getStore();
  return principalId ? store.state.tasks.filter((t) => t.principalId === principalId) : store.state.tasks;
}

export function getTask(id: string) {
  return getStore().state.tasks.find((t) => t.taskId === id) ?? null;
}

export function listApprovals() {
  return getStore().state.approvals;
}

export function resolveApproval(approvalId: string, actorId: string, decision: "approved" | "denied") {
  return decideApproval(getStore(), { approvalId, actorId, decision });
}

export function executeApproved(approvalId: string, actorId: string) {
  return executeApprovedAction(getStore(), { approvalId, actorId });
}

export function listAudit(actorId: string) {
  const p = getStore().principal(actorId);
  if (!p?.actions.includes("audit.read") && !p?.roles.includes("auditor") && !p?.roles.includes("security_owner")) {
    return { ok: false as const, error: "Audit view requires auditor or security role." };
  }
  return { ok: true as const, events: getStore().state.events.slice(0, 200) };
}

export function listMemory(actorId: string, scope: "personal" | "team" | "org") {
  const store = getStore();
  const p = store.principal(actorId);
  if (!p) return { ok: false as const, error: "Unknown principal", items: [] };
  const items = store.state.memory.filter((m) => m.scope === scope && canReadMemory(actorId, m, true).ok);
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
  return { items: items.slice(0, 80), byKind, total: items.reduce((s, c) => s + c.amountUsd, 0) };
}

export function getImprovements() {
  return getStore().state.improvements;
}

export async function runEvals() {
  return runEvalSuite("1.1.0");
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
  return {
    os: store.state.kill.entireOs ? "disabled" : "up",
    writePlane: store.state.kill.writePlane ? "disabled" : "gated_sandbox_after_approval",
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
    eventCount: store.state.events.length,
    sandboxWrites: store.state.sandbox.writes.length,
    credentials: store.state.credentials.length,
  };
}

export { AGENT_RELEASE, POLICY_VERSION, evaluatePolicy, getStore, resetStore, runOperatorSimulations };
export type { KernelStore };
