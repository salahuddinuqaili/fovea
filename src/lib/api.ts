import { createServerFn } from "@tanstack/react-start";
import {
  bootstrap,
  executeApproved,
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
  runSimulations,
  setKill,
  submitWork,
  tryLoadRelease,
} from "@/kernel";
import { controlMeta, withControlPlane } from "@/lib/control-persist";
import type { KillSwitchState, SkillManifest } from "@/kernel/types";

export const bootstrapFn = createServerFn({ method: "GET" }).handler(async () =>
  withControlPlane(async () => {
    const meta = await controlMeta();
    return { ...bootstrap(), control: meta };
  }),
);

export const overviewFn = createServerFn({ method: "GET" })
  .validator((d: { principalId: string }) => d)
  .handler(async ({ data }) => withControlPlane(() => getOverview(data.principalId)));

export const submitWorkFn = createServerFn({ method: "POST" })
  .validator((d: { principalId: string; message: string; skillId?: string }) => d)
  .handler(async ({ data }) =>
    withControlPlane(() => submitWork(data.principalId, data.message, data.skillId)),
  );

export const listTasksFn = createServerFn({ method: "GET" })
  .validator((d: { principalId?: string }) => d)
  .handler(async ({ data }) => withControlPlane(() => listTasks(data.principalId)));

export const getTaskFn = createServerFn({ method: "GET" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => withControlPlane(() => getTask(data.id)));

export const listApprovalsFn = createServerFn({ method: "GET" }).handler(async () =>
  withControlPlane(() => listApprovals()),
);

export const decideApprovalFn = createServerFn({ method: "POST" })
  .validator((d: { approvalId: string; actorId: string; decision: "approved" | "denied" }) => d)
  .handler(async ({ data }) =>
    withControlPlane(() => resolveApproval(data.approvalId, data.actorId, data.decision)),
  );

export const executeApprovedFn = createServerFn({ method: "POST" })
  .validator((d: { approvalId: string; actorId: string }) => d)
  .handler(async ({ data }) =>
    withControlPlane(() => executeApproved(data.approvalId, data.actorId)),
  );

export const listAuditFn = createServerFn({ method: "GET" })
  .validator((d: { actorId: string }) => d)
  .handler(async ({ data }) => withControlPlane(() => listAudit(data.actorId)));

export const listMemoryFn = createServerFn({ method: "GET" })
  .validator((d: { actorId: string; scope: "personal" | "team" | "org" }) => d)
  .handler(async ({ data }) => withControlPlane(() => listMemory(data.actorId, data.scope)));

export const listSkillsFn = createServerFn({ method: "GET" })
  .validator((d: { actorId: string }) => d)
  .handler(async ({ data }) => withControlPlane(() => listSkills(data.actorId)));

export const putSkillFn = createServerFn({ method: "POST" })
  .validator((d: { actorId: string; skill: SkillManifest }) => d)
  .handler(async ({ data }) => withControlPlane(() => putSkill(data.actorId, data.skill)));

export const getCostFn = createServerFn({ method: "GET" })
  .validator((d: { principalId?: string }) => d)
  .handler(async ({ data }) => withControlPlane(() => getCost(data.principalId)));

export const improvementsFn = createServerFn({ method: "GET" }).handler(async () =>
  withControlPlane(() => getImprovements()),
);

export const runEvalsFn = createServerFn({ method: "POST" }).handler(async () =>
  withControlPlane(() => runEvals()),
);

export const runSimulationsFn = createServerFn({ method: "POST" }).handler(async () =>
  withControlPlane(() => runSimulations()),
);

export const setKillFn = createServerFn({ method: "POST" })
  .validator((d: { actorId: string; patch: Partial<KillSwitchState> }) => d)
  .handler(async ({ data }) => withControlPlane(() => setKill(data.actorId, data.patch)));

export const tryReleaseFn = createServerFn({ method: "POST" })
  .validator((d: { kind: "current" | "tampered" | "unsigned" }) => d)
  .handler(async ({ data }) => withControlPlane(() => tryLoadRelease(data.kind)));

export const healthFn = createServerFn({ method: "GET" }).handler(async () =>
  withControlPlane(async () => {
    const meta = await controlMeta();
    return { ...health(), control: meta };
  }),
);
