import { createServerFn } from "@tanstack/react-start";
import {
  bootstrap,
  getCost,
  getImprovements,
  getOverview,
  getTask,
  health,
  listApprovals,
  listAudit,
  listMemory,
  listSkills,
  listTasks,
  putSkill,
  resolveApproval,
  runEvals,
  setKill,
  submitWork,
  tryLoadRelease,
} from "@/kernel";
import type { KillSwitchState, SkillManifest } from "@/kernel/types";

export const bootstrapFn = createServerFn({ method: "GET" }).handler(async () => bootstrap());

export const overviewFn = createServerFn({ method: "GET" })
  .validator((d: { principalId: string }) => d)
  .handler(async ({ data }) => getOverview(data.principalId));

export const submitWorkFn = createServerFn({ method: "POST" })
  .validator((d: { principalId: string; message: string; skillId?: string }) => d)
  .handler(async ({ data }) => submitWork(data.principalId, data.message, data.skillId));

export const listTasksFn = createServerFn({ method: "GET" })
  .validator((d: { principalId?: string }) => d)
  .handler(async ({ data }) => listTasks(data.principalId));

export const getTaskFn = createServerFn({ method: "GET" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => getTask(data.id));

export const listApprovalsFn = createServerFn({ method: "GET" }).handler(async () => listApprovals());

export const decideApprovalFn = createServerFn({ method: "POST" })
  .validator((d: { approvalId: string; actorId: string; decision: "approved" | "denied" }) => d)
  .handler(async ({ data }) => resolveApproval(data.approvalId, data.actorId, data.decision));

export const listAuditFn = createServerFn({ method: "GET" })
  .validator((d: { actorId: string }) => d)
  .handler(async ({ data }) => listAudit(data.actorId));

export const listMemoryFn = createServerFn({ method: "GET" })
  .validator((d: { actorId: string; scope: "personal" | "team" | "org" }) => d)
  .handler(async ({ data }) => listMemory(data.actorId, data.scope));

export const listSkillsFn = createServerFn({ method: "GET" })
  .validator((d: { actorId: string }) => d)
  .handler(async ({ data }) => listSkills(data.actorId));

export const putSkillFn = createServerFn({ method: "POST" })
  .validator((d: { actorId: string; skill: SkillManifest }) => d)
  .handler(async ({ data }) => putSkill(data.actorId, data.skill));

export const getCostFn = createServerFn({ method: "GET" })
  .validator((d: { principalId?: string }) => d)
  .handler(async ({ data }) => getCost(data.principalId));

export const improvementsFn = createServerFn({ method: "GET" }).handler(async () => getImprovements());

export const runEvalsFn = createServerFn({ method: "POST" }).handler(async () => runEvals());

export const setKillFn = createServerFn({ method: "POST" })
  .validator((d: { actorId: string; patch: Partial<KillSwitchState> }) => d)
  .handler(async ({ data }) => setKill(data.actorId, data.patch));

export const tryReleaseFn = createServerFn({ method: "POST" })
  .validator((d: { kind: "current" | "tampered" | "unsigned" }) => d)
  .handler(async ({ data }) => tryLoadRelease(data.kind));

export const healthFn = createServerFn({ method: "GET" }).handler(async () => health());
