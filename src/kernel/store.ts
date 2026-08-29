import { uuid } from "./crypto.ts";
import { ENTERPRISE_SKILLS, findPrincipal, PRINCIPALS } from "./fixtures.ts";
import { makeMemory, seedMemory } from "./memory.ts";
import { buildRelease, SEED_TREE } from "./release.ts";
import { seedSandbox, type SandboxState } from "./sandbox.ts";
import type {
  Approval,
  AuditEvent,
  AutonomyGrant,
  BackfillPlan,
  CostRecord,
  ImprovementEvent,
  KillSwitchState,
  MemoryItem,
  Principal,
  ReleaseArtifact,
  Session,
  SkillManifest,
  WorkResult,
  WriteCredential,
} from "./types.ts";
import { AGENT_RELEASE, POLICY_VERSION } from "./types.ts";
import { isGrantActive } from "./grants.ts";

export interface KernelState {
  sessions: Session[];
  tasks: WorkResult[];
  events: AuditEvent[];
  approvals: Approval[];
  memory: MemoryItem[];
  costs: CostRecord[];
  improvements: ImprovementEvent[];
  skills: SkillManifest[];
  kill: KillSwitchState;
  releases: ReleaseArtifact[];
  loadedRelease: ReleaseArtifact | null;
  loadError: string | null;
  credentials: WriteCredential[];
  sandbox: SandboxState;
  grants: AutonomyGrant[];
}

export function emptyKill(): KillSwitchState {
  return {
    taskIds: [],
    skills: [],
    sessions: [],
    tools: [],
    writePlane: false,
    models: [],
    teamStages: {},
    release: false,
    entireOs: false,
  };
}

export function seedState(): KernelState {
  const release = buildRelease({
    version: "7.0.0",
    sourceCommit: "v70desk01",
    tree: SEED_TREE,
  });
  return {
    sessions: [],
    tasks: [],
    events: [],
    approvals: [],
    memory: seedMemory(),
    costs: [],
    improvements: [],
    skills: [...ENTERPRISE_SKILLS],
    kill: emptyKill(),
    releases: [release],
    loadedRelease: release,
    loadError: null,
    credentials: [],
    sandbox: seedSandbox(),
    grants: [],
  };
}

function normalizePlan(p: BackfillPlan): BackfillPlan {
  return {
    ...p,
    adapter: p.adapter ?? { id: "transform.dbt", label: "dbt Core (fixture)", runtime: "transform" },
    partitionStates: p.partitionStates ?? [],
    cost: p.cost ?? { expectedUsd: p.expectedCost, dryRunUsd: p.expectedCost, variancePct: 0 },
    rollback: p.rollback ?? { strategy: "time_travel_partition", snapshots: [], haltDownstream: true },
  };
}

function normalizeRelease(r: ReleaseArtifact): ReleaseArtifact {
  return {
    ...r,
    keyId: r.keyId || r.signer || "kms:fovea-release-demo",
    algorithm: r.algorithm ?? "Ed25519",
  };
}

function normalizeState(s: KernelState): KernelState {
  return {
    ...s,
    sessions: s.sessions ?? [],
    tasks: (s.tasks ?? []).map((t) => ({
      ...t,
      nextAction: t.nextAction ?? null,
      evidencePack: t.evidencePack ?? null,
      plan: t.plan ? normalizePlan(t.plan) : t.plan,
    })),
    events: s.events ?? [],
    approvals: s.approvals ?? [],
    memory: s.memory ?? [],
    costs: s.costs ?? [],
    improvements: s.improvements ?? [],
    skills: s.skills ?? [],
    kill: s.kill ?? emptyKill(),
    releases: (s.releases ?? []).map(normalizeRelease),
    loadedRelease: s.loadedRelease ? normalizeRelease(s.loadedRelease) : null,
    loadError: s.loadError ?? null,
    credentials: s.credentials ?? [],
    sandbox: s.sandbox ?? seedSandbox(),
    grants: (s.grants ?? []).map(normalizeGrant),
  };
}

function normalizeGrant(g: AutonomyGrant): AutonomyGrant {
  return {
    ...g,
    revokedAt: g.revokedAt ?? null,
    revokedBy: g.revokedBy ?? null,
  };
}

export class KernelStore {
  state: KernelState;

  constructor(state?: KernelState) {
    this.state = normalizeState(state ?? seedState());
  }

  snapshot(): KernelState {
    return this.state;
  }

  principal(id: string): Principal | null {
    return findPrincipal(id);
  }

  principals(): Principal[] {
    return PRINCIPALS;
  }

  emit(event: Omit<AuditEvent, "eventId" | "timestamp" | "agentVersion" | "policyVersion">): AuditEvent {
    const full: AuditEvent = {
      eventId: `evt_${uuid().slice(0, 10)}`,
      timestamp: new Date().toISOString(),
      agentVersion: AGENT_RELEASE,
      policyVersion: POLICY_VERSION,
      ...event,
    };
    this.state.events.unshift(full);
    if (this.state.events.length > 2000) this.state.events.length = 2000;
    return full;
  }

  addCost(record: Omit<CostRecord, "id" | "at"> & { at?: string }): CostRecord {
    const full: CostRecord = {
      id: `cost_${uuid().slice(0, 8)}`,
      at: record.at ?? new Date().toISOString(),
      ...record,
    };
    this.state.costs.unshift(full);
    const session = this.state.sessions.find((s) => s.humanPrincipalId === full.principalId);
    if (session) session.spentUsd = Number((session.spentUsd + full.amountUsd).toFixed(6));
    return full;
  }

  getOrCreateSession(principalId: string): Session {
    const existing = this.state.sessions.find(
      (s) => s.humanPrincipalId === principalId && new Date(s.expiresAt).getTime() > Date.now(),
    );
    if (existing) return existing;
    const p = findPrincipal(principalId);
    if (!p) throw new Error("Unknown principal");
    const now = Date.now();
    const session: Session = {
      sessionId: `session_${uuid()}`,
      humanPrincipalId: principalId,
      teamId: p.teamId,
      clientType: "web",
      authStrength: "standard",
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 8 * 3600_000).toISOString(),
      deviceTrust: "managed",
      requestedAutonomyStage: p.autonomyStage,
      environment: "demo",
      costBudgetUsd: 25,
      spentUsd: 0,
    };
    this.state.sessions.unshift(session);
    this.emit({
      taskId: null,
      sessionId: session.sessionId,
      principalId,
      eventType: "session.created",
      resourceIds: [],
      correlationId: session.sessionId,
      summary: `Session opened for ${p.displayName}`,
    });
    return session;
  }

  addTask(task: WorkResult) {
    const idx = this.state.tasks.findIndex((t) => t.taskId === task.taskId);
    if (idx >= 0) this.state.tasks[idx] = task;
    else this.state.tasks.unshift(task);
    if (this.state.tasks.length > 400) this.state.tasks.length = 400;
  }

  addApproval(a: Approval) {
    this.state.approvals.unshift(a);
  }

  addMemory(item: MemoryItem) {
    this.state.memory.unshift(item);
  }

  addSkill(skill: SkillManifest) {
    this.state.skills = this.state.skills.filter((s) => !(s.id === skill.id && s.owner === skill.owner));
    this.state.skills.unshift(skill);
  }

  addImprovement(e: ImprovementEvent) {
    this.state.improvements.unshift(e);
  }

  addGrant(grant: AutonomyGrant) {
    this.state.grants = this.state.grants.filter(
      (g) => !(isGrantActive(g) && g.principalId === grant.principalId && g.tool === grant.tool && g.task === grant.task),
    );
    this.state.grants.unshift(grant);
  }

  applyGrant(grant: AutonomyGrant) {
    const i = this.state.grants.findIndex((g) => g.id === grant.id);
    if (i >= 0) this.state.grants[i] = grant;
    else this.state.grants.unshift(grant);
  }
}

const g = globalThis as typeof globalThis & {
  __foveaStore?: KernelStore;
  __foveaHydrated?: boolean;
};

export function getStore(): KernelStore {
  if (!g.__foveaStore) g.__foveaStore = new KernelStore();
  g.__foveaStore.state = normalizeState(g.__foveaStore.state);
  return g.__foveaStore;
}

export function resetStore() {
  g.__foveaStore = new KernelStore();
  g.__foveaHydrated = false;
  return g.__foveaStore;
}

export function markHydrated(value = true) {
  g.__foveaHydrated = value;
}

export function isHydrated() {
  return Boolean(g.__foveaHydrated);
}

export function makePersonalNote(principalId: string, title: string, body: string) {
  return makeMemory({
    scope: "personal",
    ownerPrincipalId: principalId,
    teamId: findPrincipal(principalId)?.teamId ?? null,
    path: `/personal/${principalId}/working-memory/${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    body,
    origin: "memory",
    encrypted: true,
  });
}
