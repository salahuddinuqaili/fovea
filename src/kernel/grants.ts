import { uuid } from "./crypto.ts";
import { TOOLS } from "./fixtures.ts";
import type { AutonomyGrant, Principal, RiskTier } from "./types.ts";

const WILDCARD = (value: string) => value === "*" || value === "all" || value === "any";

const NAMES: Record<string, string> = {
  maya: "prin_maya",
  jordan: "prin_jordan",
  sam: "prin_sam",
  riley: "prin_riley",
  alex: "prin_alex",
};

export type GrantStatus = "active" | "expired" | "revoked";

export function parseGrantRequest(text: string): {
  principalId: string;
  tool: string;
  task: string;
  actions: string[];
  maxRisk: RiskTier;
  wildcard: boolean;
} | null {
  const m = text.trim().match(/^grant\s+([a-z]+)\s+(\S+)\s+for\s+([a-z0-9._*-]+)/i);
  if (!m) return null;
  const principalId = NAMES[m[1].toLowerCase()];
  if (!principalId) return null;
  const tool = m[2];
  const task = m[3].replace(/[.,]$/, "");
  return {
    principalId,
    tool,
    task,
    actions: ["read"],
    maxRisk: 2,
    wildcard: WILDCARD(tool) || WILDCARD(task),
  };
}

export function parseRevokeRequest(text: string): {
  grantId?: string;
  principalId?: string;
  tool?: string;
  task?: string;
} | null {
  const byId = text.trim().match(/^revoke\s+(grant_[a-z0-9]+)/i);
  if (byId) return { grantId: byId[1] };
  const byShape = text.trim().match(/^revoke\s+([a-z]+)\s+(\S+)\s+for\s+([a-z0-9._*-]+)/i);
  if (!byShape) return null;
  const principalId = NAMES[byShape[1].toLowerCase()];
  if (!principalId) return null;
  return { principalId, tool: byShape[2], task: byShape[3].replace(/[.,]$/, "") };
}

export function grantStatus(grant: AutonomyGrant, now = Date.now()): GrantStatus {
  if (grant.revokedAt) return "revoked";
  if (Date.parse(grant.expiresAt) <= now) return "expired";
  return "active";
}

export function isGrantActive(grant: AutonomyGrant, now = Date.now()): boolean {
  return grantStatus(grant, now) === "active";
}

export function matchingGrant(
  grants: AutonomyGrant[],
  query: { principalId: string; tool: string; task: string; action: string },
  now = Date.now(),
): AutonomyGrant | null {
  return (
    grants.find(
      (g) =>
        isGrantActive(g, now) &&
        g.principalId === query.principalId &&
        g.tool === query.tool &&
        g.task === query.task &&
        g.actions.includes(query.action),
    ) ?? null
  );
}

export function findGrant(
  grants: AutonomyGrant[],
  sel: { grantId?: string; principalId?: string; tool?: string; task?: string },
  now = Date.now(),
): AutonomyGrant | undefined {
  if (sel.grantId) return grants.find((g) => g.id === sel.grantId);
  if (!sel.principalId || !sel.tool || !sel.task) return undefined;
  return grants.find(
    (g) => isGrantActive(g, now) && g.principalId === sel.principalId && g.tool === sel.tool && g.task === sel.task,
  );
}

export function shadowStageD(grant: AutonomyGrant): {
  candidateStage: "D";
  eligible: boolean;
  promoted: false;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (WILDCARD(grant.tool) || WILDCARD(grant.task) || grant.actions.some(WILDCARD)) {
    reasons.push("wildcards are not a selected workflow");
  }
  if (grant.actions.includes("execute_write")) reasons.push("execute_write is not grantable in this stage");
  if (grant.maxRisk >= 4) reasons.push("risk tier 4 cannot be granted");
  return {
    candidateStage: "D",
    eligible: reasons.length === 0,
    promoted: false,
    reasons: reasons.length ? reasons : ["selected workflow is named; Stage D is not self-promoting"],
  };
}

export function issueGrant(
  actor: Principal,
  input: {
    principalId: string;
    tool: string;
    task: string;
    actions: string[];
    maxRisk: RiskTier;
    environment?: AutonomyGrant["environment"];
  },
  existing: AutonomyGrant[] = [],
): { ok: true; grant: AutonomyGrant } | { ok: false; reason: string } {
  if (!actor.roles.includes("os_owner") && !actor.roles.includes("security_owner")) {
    return { ok: false, reason: "Only the OS owner or security owner may issue a selected-workflow grant." };
  }
  if (WILDCARD(input.tool) || WILDCARD(input.task) || input.actions.some(WILDCARD)) {
    return {
      ok: false,
      reason: "There is no global autonomous switch. Grants must name one tool, one task, and explicit actions.",
    };
  }
  if (input.actions.includes("execute_write") || input.actions.includes("write")) {
    return { ok: false, reason: "Writes cannot be granted into autonomy. They stay hash-bound." };
  }
  if (input.maxRisk >= 4) {
    return { ok: false, reason: "Risk tier 4 tools cannot be granted." };
  }
  const tool = TOOLS.find((t) => t.id === input.tool);
  if (!tool) return { ok: false, reason: "Unknown tool cannot be granted." };
  if (tool.riskTier >= 4 || input.tool === "warehouse.live") {
    return { ok: false, reason: "Risk tier 4 tools cannot be granted." };
  }
  if (input.actions.length === 0) {
    return { ok: false, reason: "A grant must name at least one action." };
  }
  const dup = existing.find(
    (g) =>
      isGrantActive(g) && g.principalId === input.principalId && g.tool === input.tool && g.task === input.task,
  );
  if (dup) {
    return {
      ok: false,
      reason: `An active grant (${dup.id}) already covers this workflow. Revoke it first.`,
    };
  }
  const grant: AutonomyGrant = {
    id: `grant_${uuid().slice(0, 8)}`,
    principalId: input.principalId,
    tool: input.tool,
    task: input.task,
    actions: [...input.actions],
    maxRisk: input.maxRisk,
    environment: input.environment ?? "demo",
    issuedBy: actor.id,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
    revokedAt: null,
    revokedBy: null,
  };
  const shadow = shadowStageD(grant);
  if (!shadow.eligible) return { ok: false, reason: shadow.reasons.join("; ") };
  return { ok: true, grant };
}

export function revokeGrant(
  actor: Principal,
  grant: AutonomyGrant | undefined,
  now = Date.now(),
): { ok: true; grant: AutonomyGrant } | { ok: false; reason: string } {
  if (!actor.roles.includes("os_owner") && !actor.roles.includes("security_owner")) {
    return { ok: false, reason: "Only the OS owner or security owner may revoke a selected-workflow grant." };
  }
  if (!grant) return { ok: false, reason: "No matching active grant to revoke." };
  const status = grantStatus(grant, now);
  if (status === "revoked") return { ok: false, reason: "That grant is already revoked." };
  if (status === "expired") return { ok: false, reason: "That grant has expired." };
  return {
    ok: true,
    grant: {
      ...grant,
      revokedAt: new Date(now).toISOString(),
      revokedBy: actor.id,
    },
  };
}
