import { PIPELINES } from "./fixtures.ts";
import type { AdapterRef, BackfillPlan, PartitionState, RollbackPlan } from "./types.ts";

export interface AdapterDryRun {
  ok: boolean;
  bytesScanned: number;
  durationMs: number;
  actualUsd: number;
  notes: string[];
}

export interface PipelineAdapter {
  id: AdapterRef["id"];
  label: string;
  runtime: string;
  handles: (nodeType: string, runtimeSystem: string) => boolean;
  partitionState: (nodeId: string, partitions: string[]) => PartitionState[];
  dryRun: (plan: Pick<BackfillPlan, "targetNodes" | "resolvedPartitions" | "expectedCost">) => AdapterDryRun;
  rollback: (plan: Pick<BackfillPlan, "targetNodes" | "resolvedPartitions">) => RollbackPlan;
  execute: () => { ok: false; reason: "production_execution_disabled" };
}

function failedPartition(nodeId: string) {
  if (nodeId === "fct_orders") return "2026-08-27";
  return null;
}

function partitionRows(nodeId: string, partition: string) {
  const failed = failedPartition(nodeId);
  if (failed && partition === failed) return 0;
  if (nodeId === "fct_orders") return 3100 + (partition.charCodeAt(9) % 40);
  if (nodeId === "ops_fill_rate") return 860;
  return 1400;
}

function statesFor(nodeId: string, partitions: string[]): PartitionState[] {
  const failed = failedPartition(nodeId);
  return partitions.map((partition) => {
    if (failed && partition === failed) {
      return {
        nodeId,
        partition,
        status: "failed" as const,
        lastSuccessAt: "2026-08-26T10:12:00Z",
        rows: 0,
      };
    }
    return {
      nodeId,
      partition,
      status: "current" as const,
      lastSuccessAt: "2026-08-28T23:05:00Z",
      rows: partitionRows(nodeId, partition),
    };
  });
}

export const dbtAdapter: PipelineAdapter = {
  id: "transform.dbt",
  label: "dbt Core (fixture)",
  runtime: "transform",
  handles: (nodeType, runtime) => nodeType === "transformation" || runtime === "transform",
  partitionState: statesFor,
  dryRun: (plan) => {
    const n = Math.max(1, plan.resolvedPartitions.length);
    const actualUsd = Number((plan.expectedCost * 0.92).toFixed(2));
    return {
      ok: true,
      bytesScanned: n * 48_000_000,
      durationMs: 180 + n * 40,
      actualUsd,
      notes: ["compile ok", "selector respects --select + --exclude", "no --full-refresh"],
    };
  },
  rollback: (plan) => ({
    strategy: "time_travel_partition",
    snapshots: plan.targetNodes.flatMap((n) =>
      plan.resolvedPartitions.map((p) => `${n}@${p}#previous`),
    ),
    haltDownstream: true,
  }),
  execute: () => ({ ok: false, reason: "production_execution_disabled" }),
};

export const scheduledQueryAdapter: PipelineAdapter = {
  id: "warehouse.scheduled_query",
  label: "Warehouse scheduled query (fixture)",
  runtime: "warehouse-sched",
  handles: (nodeType, runtime) => nodeType === "scheduled_query" || runtime === "warehouse-sched",
  partitionState: statesFor,
  dryRun: (plan) => {
    const n = Math.max(1, plan.resolvedPartitions.length);
    const actualUsd = Number((plan.expectedCost * 1.04).toFixed(2));
    return {
      ok: true,
      bytesScanned: n * 22_000_000,
      durationMs: 90 + n * 25,
      actualUsd,
      notes: ["destination table partitioned", "write disposition = WRITE_TRUNCATE on partition"],
    };
  },
  rollback: (plan) => ({
    strategy: "swap_table",
    snapshots: plan.targetNodes.map((n) => `${n}__shadow_prev`),
    haltDownstream: true,
  }),
  execute: () => ({ ok: false, reason: "production_execution_disabled" }),
};

export const ADAPTERS: PipelineAdapter[] = [dbtAdapter, scheduledQueryAdapter];

export function adapterFor(nodeId: string): PipelineAdapter {
  const node = PIPELINES.find((n) => n.nodeId === nodeId);
  if (!node) return dbtAdapter;
  return ADAPTERS.find((a) => a.handles(node.nodeType, node.runtimeSystem)) ?? dbtAdapter;
}

export function listAdapters() {
  return ADAPTERS.map((a) => ({
    id: a.id,
    label: a.label,
    runtime: a.runtime,
    execute: a.execute(),
    nodeCount: PIPELINES.filter((n) => a.handles(n.nodeType, n.runtimeSystem)).length,
  }));
}

export function shadowAutonomy(plan: BackfillPlan): {
  candidateStage: "C";
  eligible: boolean;
  reasons: string[];
  promoted: false;
} {
  const reasons: string[] = [];
  if (plan.resolvedPartitions.length > 3) reasons.push("blast radius exceeds shadow window");
  if (plan.cost.variancePct > 15) reasons.push("dry-run cost variance too high");
  if (plan.partitionStates.some((p) => p.status === "failed") === false) reasons.push("no failed partition to justify write");
  if (plan.downstreamImpact.length > 4) reasons.push("downstream fan-out too wide");
  return {
    candidateStage: "C",
    eligible: reasons.length === 0,
    reasons: reasons.length ? reasons : ["shadow-eligible under current gates"],
    promoted: false,
  };
}
