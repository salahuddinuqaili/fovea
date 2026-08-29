import { digestObject, uuid } from "./crypto.ts";
import { PIPELINES } from "./fixtures.ts";
import { adapterFor } from "./adapters.ts";
import type { BackfillPlan, PipelineNode, RiskTier } from "./types.ts";

export function getNode(id: string) {
  return PIPELINES.find((n) => n.nodeId === id) ?? null;
}

export function listNodes() {
  return PIPELINES;
}

export function walk(start: string, dir: "up" | "down", depth = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  function rec(id: string, d: number) {
    if (d < 0 || seen.has(id)) return;
    seen.add(id);
    const node = getNode(id);
    if (!node) return;
    out.push(id);
    const next = dir === "up" ? node.upstream : node.downstream;
    for (const n of next) rec(n, d - 1);
  }
  rec(start, depth);
  return out;
}

export function topologicalOrder(ids: string[]): string[] {
  const set = new Set(ids);
  const inDeg = new Map<string, number>();
  for (const id of ids) inDeg.set(id, 0);
  for (const id of ids) {
    const node = getNode(id);
    if (!node) continue;
    for (const up of node.upstream) {
      if (set.has(up)) inDeg.set(id, (inDeg.get(id) ?? 0) + 1);
    }
  }
  const q = ids.filter((id) => (inDeg.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (q.length) {
    const n = q.shift()!;
    order.push(n);
    const node = getNode(n);
    if (!node) continue;
    for (const down of node.downstream) {
      if (!set.has(down)) continue;
      inDeg.set(down, (inDeg.get(down) ?? 0) - 1);
      if ((inDeg.get(down) ?? 0) === 0) q.push(down);
    }
  }
  for (const id of ids) if (!order.includes(id)) order.push(id);
  return order;
}

export function planBackfill(input: {
  target: string;
  start: string;
  end: string;
  requestText: string;
}): BackfillPlan {
  const target = resolveTarget(input.target, input.requestText);
  const node = getNode(target);
  const upstream = walk(target, "up", 8).filter((id) => id !== target);
  const downstream = walk(target, "down", 8).filter((id) => id !== target);
  const all = [target, ...upstream, ...downstream];
  const order = topologicalOrder([...new Set(all)]);
  const partitions = enumerateDays(input.start, input.end);
  const expectedRows = partitions.length * (target === "fct_orders" ? 3200 : 1800);
  const expectedCost = Number((partitions.length * 4.8 + downstream.length * 6).toFixed(2));
  const riskTier: RiskTier = expectedCost > 80 || partitions.length > 14 ? 3 : 2;
  const adapter = adapterFor(target);
  const partitionStates = adapter.partitionState(target, partitions);
  const dry = adapter.dryRun({
    targetNodes: [target],
    resolvedPartitions: partitions,
    expectedCost,
  });
  const rollback = adapter.rollback({ targetNodes: [target], resolvedPartitions: partitions });
  const variancePct = expectedCost === 0 ? 0 : Number((Math.abs(dry.actualUsd - expectedCost) / expectedCost * 100).toFixed(1));
  const draft: Omit<BackfillPlan, "planHash"> = {
    id: `bf_${uuid().slice(0, 8)}`,
    targetNodes: [target],
    requestedRange: { start: input.start, end: input.end },
    resolvedPartitions: partitions,
    upstreamRequirements: upstream,
    downstreamImpact: downstream,
    dependencyOrder: order,
    overwriteBehavior: "replace_partition",
    idempotencyStrategy: "partition-replace keyed by node_id+partition",
    expectedRows,
    expectedCost,
    expectedDurationMinutes: Math.max(25, partitions.length * 6),
    dataQualityChecks: [
      "row_count within 8% of expected",
      "null_rate(currency) < 0.1%",
      "unique(order_id)",
      "gross_revenue_usd >= 0",
      "no time-series discontinuity > 25% vs prior week",
    ],
    businessInvariants: [
      "unaffected partitions remain untouched",
      "no schema changes",
      "test orders remain excluded from north-star revenue",
    ],
    rollbackStrategy: `${rollback.strategy}; halt downstream on invariant fail`,
    rollback,
    monitoringChecks: ["run_status", "bytes_scanned", "failed_tests", "sla_drift"],
    riskTier,
    approvalRequired: true,
    status: "planned",
    adapter: { id: adapter.id, label: adapter.label, runtime: adapter.runtime },
    partitionStates,
    cost: { expectedUsd: expectedCost, dryRunUsd: dry.actualUsd, variancePct },
  };
  const planHash = digestObject({
    target: draft.targetNodes,
    range: draft.requestedRange,
    partitions: draft.resolvedPartitions,
    order: draft.dependencyOrder,
    overwrite: draft.overwriteBehavior,
    adapter: draft.adapter.id,
  });
  return { ...draft, planHash };
}

function resolveTarget(target: string, requestText: string): string {
  const t = `${target} ${requestText}`.toLowerCase();
  if (t.includes("fct_orders") || t.includes("orders")) return "fct_orders";
  if (t.includes("session")) return "fct_sessions";
  if (t.includes("revenue")) return "mart_revenue_weekly";
  if (getNode(target)) return target;
  return "fct_orders";
}

export function enumerateDays(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) {
    return ["2026-08-27"];
  }
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
    if (out.length > 90) break;
  }
  return out;
}

export function parseRange(text: string): { start: string; end: string } {
  const days = text.match(/last (\d+) days/i);
  const explicit = text.match(/(\d{4}-\d{2}-\d{2}).+(\d{4}-\d{2}-\d{2})/);
  if (explicit) return { start: explicit[1], end: explicit[2] };
  if (days) {
    const n = Math.min(90, Number(days[1]));
    return { start: "2026-08-27", end: "2026-08-28" }; // demo clock: failed partition window
  }
  if (/affected partition/i.test(text) || /after the (upstream )?correction/i.test(text)) {
    return { start: "2026-08-27", end: "2026-08-27" };
  }
  if (/90 days/.test(text)) return { start: "2026-05-31", end: "2026-08-28" };
  return { start: "2026-08-27", end: "2026-08-27" };
}

export function nodeSummary(id: string): PipelineNode | null {
  return getNode(id);
}
