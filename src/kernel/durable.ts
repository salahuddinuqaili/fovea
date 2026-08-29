import { seedSandbox, type SandboxState } from "./sandbox.ts";
import { emptyKill, type KernelState } from "./store.ts";
import type {
  Approval,
  AuditEvent,
  AutonomyGrant,
  CostRecord,
  ImprovementEvent,
  KillSwitchState,
  MemoryItem,
  ReleaseArtifact,
  Session,
  SkillManifest,
  WorkResult,
  WriteCredential,
} from "./types.ts";

/** Control metadata that may live in the unowned (auth-off) snapshot. */
export interface DurableSlice {
  version: 1;
  sessions: Session[];
  tasks: WorkResult[];
  events: AuditEvent[];
  approvals: Approval[];
  costs: CostRecord[];
  improvements: ImprovementEvent[];
  skills: SkillManifest[];
  memory: MemoryItem[];
  kill: KillSwitchState;
  releases: ReleaseArtifact[];
  loadedRelease: ReleaseArtifact | null;
  loadError: string | null;
  credentials: WriteCredential[];
  sandbox: SandboxState;
  grants?: AutonomyGrant[];
}

/**
 * Strip personal memory and personal skills. Unowned Neon/PGLite rows are
 * world-readable — INV-005 forbids putting another user's private notes there.
 */
export function durableSlice(state: KernelState): DurableSlice {
  return {
    version: 1,
    sessions: state.sessions,
    tasks: state.tasks,
    events: state.events,
    approvals: state.approvals,
    costs: state.costs,
    improvements: state.improvements,
    skills: state.skills.filter((s) => s.scope !== "personal"),
    memory: state.memory.filter((m) => m.scope !== "personal"),
    kill: state.kill,
    releases: state.releases,
    loadedRelease: state.loadedRelease,
    loadError: state.loadError,
    credentials: state.credentials,
    sandbox: state.sandbox,
    grants: state.grants ?? [],
  };
}

/**
 * Restore unowned control metadata. The running kernel's signed release wins
 * when the snapshot lags — grants, tasks, and sessions are kept.
 */
export function applyDurableSlice(state: KernelState, slice: DurableSlice): KernelState {
  const personalMemory = state.memory.filter((m) => m.scope === "personal");
  const personalSkills = state.skills.filter((s) => s.scope === "personal");
  const memory = [
    ...slice.memory.filter((m) => m.scope !== "personal"),
    ...personalMemory,
  ];
  const skills = [
    ...slice.skills.filter((s) => s.scope !== "personal"),
    ...personalSkills,
  ];
  const currentRelease = state.loadedRelease;
  const snapRelease = slice.loadedRelease;
  const kernelWins = Boolean(currentRelease) && (!snapRelease || snapRelease.version !== currentRelease?.version);
  const loadedRelease = kernelWins ? currentRelease : (snapRelease ?? currentRelease);
  const releases = mergeReleases([
    ...(kernelWins && currentRelease ? [currentRelease] : []),
    ...(slice.releases ?? state.releases),
  ]);
  return {
    sessions: slice.sessions ?? [],
    tasks: slice.tasks ?? [],
    events: slice.events ?? [],
    approvals: (slice.approvals ?? []).map(normalizeApproval),
    memory,
    costs: slice.costs ?? [],
    improvements: slice.improvements ?? [],
    skills,
    kill: slice.kill ?? emptyKill(),
    releases,
    loadedRelease,
    loadError: kernelWins ? null : (slice.loadError ?? null),
    credentials: slice.credentials ?? [],
    sandbox: slice.sandbox ?? seedSandbox(),
    grants: (slice.grants ?? state.grants ?? []).map(normalizeGrant),
  };
}

export function mergeReleases(list: ReleaseArtifact[]): ReleaseArtifact[] {
  const seen = new Set<string>();
  const out: ReleaseArtifact[] = [];
  for (const r of list) {
    if (!r?.version || seen.has(r.version)) continue;
    seen.add(r.version);
    out.push(r);
  }
  return out;
}

function normalizeGrant(g: AutonomyGrant): AutonomyGrant {
  return {
    ...g,
    revokedAt: g.revokedAt ?? null,
    revokedBy: g.revokedBy ?? null,
  };
}

function normalizeApproval(a: Approval): Approval {
  return {
    ...a,
    executionStatus: a.executionStatus ?? "not_executed",
    executionNote: a.executionNote ?? "",
    credentialId: a.credentialId ?? null,
  };
}
