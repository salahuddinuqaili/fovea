import type { EvidencePack, WorkResult } from "./types.ts";
import { AGENT_RELEASE } from "./types.ts";

export function toEvidencePack(result: WorkResult): EvidencePack {
  return {
    resultId: result.provenance?.resultId ?? result.taskId,
    claimClass: result.answer?.claimClass ?? "unsupported",
    claim: result.answer?.text ?? "",
    citations: result.answer?.citations ?? [],
    queryHashes: result.provenance?.queries.map((q) => q.queryHash) ?? [],
    metrics: result.provenance?.metricDefinitions ?? [],
    policyDecisions: result.policy.map((p) => p.decision),
    agentRelease: result.provenance?.agentRelease ?? AGENT_RELEASE,
    outputHash: result.provenance?.outputHash ?? "",
    exportedAt: result.finishedAt,
  };
}

export function evidencePackJson(pack: EvidencePack) {
  return JSON.stringify(pack, null, 2);
}
