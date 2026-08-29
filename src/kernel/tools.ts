import { sha256, uuid } from "./crypto.ts";
import {
  DOCS,
  FILL_RATE,
  REFUND_RATE,
  REPO_FILES,
  TICKETS,
  WAA,
  WEEKLY_REVENUE,
  TOOLS,
} from "./fixtures.ts";
import { tablesInSql, validateReadSql } from "./sql.ts";
import type { JsonValue, QueryJob, ToolCall, ToolRecord } from "./types.ts";

export { tablesInSql, validateReadSql };

export function getTool(id: string): ToolRecord | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function lintSql(sql: string): { ok: boolean; notes: string[] } {
  const v = validateReadSql(sql);
  return { ok: v.ok, notes: v.notes };
}

export function dryRunSql(sql: string): {
  valid: boolean;
  scannedBytes: number;
  estimatedCost: number;
  notes: string[];
  tables: string[];
} {
  const lint = validateReadSql(sql);
  const tables = lint.tables.length ? lint.tables : tablesInSql(sql);
  const scannedBytes = Math.max(8_000_000, tables.length * 42_000_000);
  const estimatedCost = Number(((scannedBytes / 1_000_000_000) * 0.012 + 0.01).toFixed(4));
  return {
    valid: lint.ok,
    scannedBytes,
    estimatedCost,
    notes: lint.notes,
    tables,
  };
}

export function executeReadSql(sql: string): QueryJob {
  const dry = dryRunSql(sql);
  if (!dry.valid) {
    throw new Error(dry.notes.join(" "));
  }
  const rows = matchRows(sql);
  const jobId = `job_${uuid().slice(0, 8)}`;
  return {
    jobId,
    sql,
    queryHash: sha256(sql.trim()),
    tables: dry.tables,
    rows,
    scannedBytes: dry.scannedBytes,
    costUsd: dry.estimatedCost,
    executedAt: new Date().toISOString(),
    dryRun: false,
  };
}

function matchRows(sql: string): Array<Record<string, string | number | boolean | null>> {
  const s = sql.toLowerCase();
  if (s.includes("refund")) {
    return REFUND_RATE.map((r) => ({ ...r }));
  }
  if (s.includes("fill") || s.includes("filled_qty") || s.includes("order_fill")) {
    return FILL_RATE.map((r) => ({ ...r }));
  }
  if (s.includes("fct_sessions") || s.includes("weekly_active") || s.includes("active_accounts")) {
    return WAA.map((r) => ({ ...r }));
  }
  if (
    s.includes("fct_orders") ||
    s.includes("gross_revenue") ||
    s.includes("mart_revenue") ||
    s.includes("northstar") ||
    s.includes("north-star")
  ) {
    return WEEKLY_REVENUE.map((r) => ({ ...r }));
  }
  return WEEKLY_REVENUE.map((r) => ({ week_start: r.week_start, value: r.gross_revenue_usd }));
}

export function readRepo(path: string) {
  const file = REPO_FILES[path] ?? Object.values(REPO_FILES).find((f) => f.path.endsWith(path));
  if (!file) return { ok: false as const, error: `Unknown path ${path}` };
  return { ok: true as const, file, origin: "repository" as const };
}

export function readTicket(id?: string) {
  const items = id ? TICKETS.filter((t) => t.id === id) : TICKETS;
  return { items, origin: "ticket" as const };
}

export function readDoc(id?: string) {
  const items = id ? DOCS.filter((d) => d.id === id) : DOCS;
  return { items, origin: "document" as const };
}

export function wrapToolCall(
  toolId: string,
  input: Record<string, string | number | boolean | null>,
  output: JsonValue,
  extra: Partial<ToolCall>,
): ToolCall {
  return {
    callId: `tc_${uuid().slice(0, 8)}`,
    toolId,
    input,
    output,
    origin: extra.origin ?? "tool_output",
    authorized: extra.authorized ?? true,
    decision: extra.decision ?? "allow",
    durationMs: extra.durationMs ?? 12,
    costUsd: extra.costUsd ?? 0,
    dryRun: extra.dryRun ?? false,
  };
}
