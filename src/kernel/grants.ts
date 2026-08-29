import { uuid } from "./crypto.ts";
import type { AutonomyGrant, Principal, RiskTier } from "./types.ts";

const WILDCARD = (value: string) => value === "*" || value === "all" || value === "any";

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
  if (input.actions.length === 0) {
    return { ok: false, reason: "A grant must name at least one action." };
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
  };
  const shadow = shadowStageD(grant);
  if (!shadow.eligible) return { ok: false, reason: shadow.reasons.join("; ") };
  return { ok: true, grant };
}
