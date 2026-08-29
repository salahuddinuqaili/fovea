import type {
  AutonomyStage,
  DataClass,
  PermissionSet,
  PolicyRequest,
  PolicyResponse,
  Principal,
} from "./types.ts";
import { POLICY_VERSION } from "./types.ts";
import { TOOLS } from "./fixtures.ts";

export const PERMANENT_HUMAN_GATES = new Set([
  "iam.change",
  "protected_dataset.delete",
  "canonical_metric.change",
  "sensitive_export",
  "mass_communication",
  "agentic_os.security_change",
  "eval_gate_weakening",
  "signing_authority.change",
  "tool.install",
  "self_modify.deploy",
  "audit.disable",
  "autonomy.global",
]);

export const WRITE_ACTIONS = new Set([
  "write",
  "execute_write",
  "merge",
  "ticket.update",
  "message.send",
  "dashboard.modify",
  "backfill.execute",
]);

const DATA_RANK: Record<DataClass, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

export function intersectLists(a: string[], b: string[]): string[] {
  if (a.includes("*")) return [...b];
  if (b.includes("*")) return [...a];
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

export function intersectPermissionSets(layers: PermissionSet[]): PermissionSet {
  if (layers.length === 0) {
    return { actions: [], tools: [], dataClasses: [], resources: [] };
  }
  return layers.reduce((acc, layer) => ({
    actions: intersectLists(acc.actions, layer.actions),
    tools: intersectLists(acc.tools, layer.tools),
    dataClasses: intersectLists(acc.dataClasses, layer.dataClasses) as DataClass[],
    resources: intersectLists(acc.resources, layer.resources),
  }));
}

export function assertNoWidening(higher: PermissionSet, lower: PermissionSet): string[] {
  const violations: string[] = [];
  const check = (field: keyof PermissionSet, label: string) => {
    const h = higher[field] as string[];
    const l = lower[field] as string[];
    if (h.includes("*")) return;
    for (const item of l) {
      if (item === "*") {
        violations.push(`${label} attempted to widen to *`);
      }
    }
    const extra = l.filter((x) => x !== "*" && !h.includes(x));
    if (extra.length && !h.includes("*")) {
      violations.push(`${label} attempted to add ${extra.join(", ")}`);
    }
  };
  check("actions", "actions");
  check("tools", "tools");
  check("dataClasses", "dataClasses");
  check("resources", "resources");
  return violations;
}

export function enterpriseSet(): PermissionSet {
  return {
    actions: [
      "read",
      "analyze",
      "plan",
      "propose_write",
      "write",
      "execute_write",
      "approve",
      "memory.read.personal",
      "memory.write.personal",
      "memory.read.team",
      "memory.read.org",
      "eval.run",
      "release.verify",
      "kill_switch",
      "audit.read",
    ],
    tools: ["*"],
    dataClasses: ["public", "internal", "confidential", "restricted"],
    resources: ["*"],
  };
}

export function osPolicySet(): PermissionSet {
  return {
    actions: [
      "read",
      "analyze",
      "plan",
      "propose_write",
      "write",
      "execute_write",
      "approve",
      "memory.read.personal",
      "memory.write.personal",
      "memory.read.team",
      "memory.read.org",
      "eval.run",
      "release.verify",
      "kill_switch",
      "audit.read",
    ],
    tools: [
      "warehouse.query",
      "warehouse.dry_run",
      "repo.read",
      "issues.read",
      "docs.read",
      "observability.read",
      "pipeline.graph",
      "pipeline.dry_run",
      "warehouse.sandbox_write",
      "warehouse.live",
    ],
    dataClasses: ["public", "internal", "confidential", "restricted"],
    resources: ["*"],
  };
}

export function teamSet(): PermissionSet {
  return {
    actions: [
      "read",
      "analyze",
      "plan",
      "propose_write",
      "write",
      "memory.read.personal",
      "memory.write.personal",
      "memory.read.team",
      "memory.read.org",
    ],
    tools: [
      "warehouse.query",
      "warehouse.dry_run",
      "repo.read",
      "issues.read",
      "docs.read",
      "observability.read",
      "pipeline.graph",
      "pipeline.dry_run",
      "warehouse.sandbox_write",
    ],
    dataClasses: ["internal", "confidential"],
    resources: ["dataset/*", "repo/analytics", "issues/*", "docs/*"],
  };
}

export function principalSet(p: Principal): PermissionSet {
  return {
    actions: p.actions,
    tools: p.allowedTools,
    dataClasses: p.dataClasses,
    resources: ["*"],
  };
}

export function agentSet(): PermissionSet {
  return {
    actions: ["read", "analyze", "plan", "propose_write", "memory.read.personal", "memory.read.team", "memory.read.org"],
    tools: [
      "warehouse.query",
      "warehouse.dry_run",
      "repo.read",
      "issues.read",
      "docs.read",
      "observability.read",
      "pipeline.graph",
      "pipeline.dry_run",
      "warehouse.sandbox_write",
    ],
    dataClasses: ["internal", "confidential", "restricted"],
    resources: ["*"],
  };
}

const GOVERNED_TOOLS = [
  "warehouse.query",
  "warehouse.dry_run",
  "repo.read",
  "issues.read",
  "docs.read",
  "observability.read",
  "pipeline.graph",
  "pipeline.dry_run",
  "warehouse.sandbox_write",
];

/** Stage never installs a tool wildcard or a global execute_write. */
export function autonomySet(stage: AutonomyStage): PermissionSet {
  if (stage === "D") {
    return {
      actions: ["read", "analyze", "plan", "propose_write"],
      tools: [...GOVERNED_TOOLS],
      dataClasses: ["public", "internal", "confidential"],
      resources: ["*"],
    };
  }
  if (stage === "C") {
    return {
      actions: ["read", "analyze", "plan", "propose_write"],
      tools: [...GOVERNED_TOOLS],
      dataClasses: ["public", "internal", "confidential"],
      resources: ["*"],
    };
  }
  return {
    actions: ["read", "analyze", "plan", "propose_write"],
    tools: [...GOVERNED_TOOLS],
    dataClasses: ["public", "internal", "confidential", "restricted"],
    resources: ["*"],
  };
}

export function toolRiskSet(toolId: string): PermissionSet {
  const tool = TOOLS.find((t) => t.id === toolId);
  if (!tool) {
    return { actions: [], tools: [], dataClasses: [], resources: [] };
  }
  const actions =
    tool.riskTier >= 4
      ? ["read", "analyze", "plan"]
      : tool.riskTier >= 3
        ? ["read", "analyze", "plan", "propose_write"]
        : ["read", "analyze", "plan", "propose_write", "write"];
  return {
    actions,
    tools: [tool.id],
    dataClasses: ["public", "internal", "confidential", "restricted"],
    resources: ["*"],
  };
}

export function environmentSet(env: string): PermissionSet {
  if (env === "prod") {
    return {
      actions: ["read", "analyze", "plan", "propose_write", "write", "execute_write", "approve"],
      tools: [...GOVERNED_TOOLS, "warehouse.live"],
      dataClasses: ["internal", "confidential", "restricted"],
      resources: ["*"],
    };
  }
  return {
    actions: ["*"],
    tools: ["*"],
    dataClasses: ["public", "internal", "confidential", "restricted"],
    resources: ["*"],
  };
}

export interface PolicyContext {
  principal: Principal;
  killWritePlane: boolean;
  killEntireOs: boolean;
  disabledTools: string[];
  disabledModels: string[];
}

export function evaluatePolicy(req: PolicyRequest, ctx: PolicyContext): PolicyResponse {
  if (ctx.killEntireOs) {
    return deny(emptySet(), [], "Kill switch: entire Agentic OS is disabled.");
  }

  if (req.action === "autonomy.global" || req.task === "autonomy.global" || req.tool === "*") {
    return deny(
      emptySet(),
      [],
      "There is no global autonomous switch. Permissions are per-tool, per-task, and per-risk. A wildcard cannot be granted.",
    );
  }

  const layers: { name: string; set: PermissionSet }[] = [
    { name: "enterprise", set: enterpriseSet() },
    { name: "signed_os_policy", set: osPolicySet() },
    { name: "team", set: teamSet() },
    { name: "principal", set: principalSet(ctx.principal) },
    { name: "agent", set: agentSet() },
    { name: "autonomy", set: autonomySet(req.autonomyStage) },
    { name: "environment", set: environmentSet(req.environment) },
  ];
  if (req.tool && req.tool !== "none") {
    layers.push({ name: "tool_risk", set: toolRiskSet(req.tool) });
  }

  const effective = intersectPermissionSets(layers.map((l) => l.set));

  if (PERMANENT_HUMAN_GATES.has(req.action) || PERMANENT_HUMAN_GATES.has(req.task)) {
    return {
      decision: "deny",
      reason: `Permanently human-gated action: ${req.action}.`,
      policyVersion: POLICY_VERSION,
      effective,
      layers,
    };
  }

  if (req.action === "tool.install" || req.task === "tool.install") {
    return deny(effective, layers, "Arbitrary tool, plugin, or MCP installation is blocked.");
  }

  if (ctx.disabledTools.includes(req.tool)) {
    return deny(effective, layers, `Tool ${req.tool} is disabled by kill switch.`);
  }

  if (req.origin && req.origin !== "signed_policy" && req.origin !== "control_plane" && req.origin !== "user") {
    if (req.action === "policy.override" || req.task === "policy.override") {
      return deny(effective, layers, "Untrusted content cannot alter system policy. Data is not policy.");
    }
  }

  const toolAllowed = effective.tools.includes("*") || effective.tools.includes(req.tool);
  if (req.tool !== "none" && !toolAllowed) {
    return deny(effective, layers, `Tool ${req.tool} is not in the effective allowlist.`);
  }

  const actionAllowed = effective.actions.includes("*") || effective.actions.includes(req.action);
  const maxRank = Math.max(-1, ...effective.dataClasses.map((d) => DATA_RANK[d]));
  const dataAllowed = effective.dataClasses.includes(req.dataClass) || DATA_RANK[req.dataClass] <= maxRank;

  if (WRITE_ACTIONS.has(req.action)) {
    if (ctx.killWritePlane) {
      return deny(effective, layers, "Kill switch: write plane disabled.");
    }
    if (req.autonomyStage === "B") {
      return {
        decision: "require_approval",
        reason:
          "Stage B principals: all writes require human approval. Sandbox execution may proceed only after exact-hash approval and a short-lived credential. Production execution remains disabled.",
        policyVersion: POLICY_VERSION,
        approvalPolicy: "stage_b_all_writes",
        maxTtlSeconds: 900,
        constraints: { no_schema_changes: true, execution: "credential_broker", sandbox_only: true },
        effective,
        layers,
      };
    }
    if (!actionAllowed) {
      return {
        decision: "require_approval",
        reason: "Write is outside the effective autonomous action set.",
        policyVersion: POLICY_VERSION,
        approvalPolicy: "write_outside_autonomy",
        maxTtlSeconds: 900,
        effective,
        layers,
      };
    }
  }

  if (!actionAllowed) {
    return deny(effective, layers, `Action ${req.action} is not in the effective permission set.`);
  }

  if (!dataAllowed) {
    return deny(effective, layers, `Data class ${req.dataClass} exceeds effective clearance.`);
  }

  if (req.estimatedCost > 200 && WRITE_ACTIONS.has(req.action)) {
    return {
      decision: "require_approval",
      reason: "Estimated cost exceeds policy threshold ($200).",
      policyVersion: POLICY_VERSION,
      approvalPolicy: "cost_ceiling",
      constraints: { max_cost: 200 },
      effective,
      layers,
    };
  }

  return {
    decision: "allow",
    reason: "Intersection of all policy layers permits this request.",
    policyVersion: POLICY_VERSION,
    effective,
    layers,
  };
}

function emptySet(): PermissionSet {
  return { actions: [], tools: [], dataClasses: [], resources: [] };
}

function deny(
  effective: PermissionSet,
  layers: { name: string; set: PermissionSet }[],
  reason: string,
): PolicyResponse {
  return {
    decision: "deny",
    reason,
    policyVersion: POLICY_VERSION,
    effective,
    layers,
  };
}

export function personalSkillCannotWiden(skill: PermissionSet, user: PermissionSet) {
  return assertNoWidening(user, skill);
}
