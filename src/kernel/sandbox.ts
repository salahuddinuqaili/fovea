import { sha256, uuid } from "./crypto.ts";
import { validateSandboxWriteSql } from "./sql.ts";
import type { JsonValue } from "./types.ts";

export type Scalar = string | number | boolean | null;
export type SandboxRow = Record<string, Scalar>;

export interface SandboxWriteRecord {
  writeId: string;
  approvalId: string;
  credentialId: string;
  table: string;
  sql: string;
  idempotencyKey: string;
  rowsAffected: number;
  row: SandboxRow | null;
  at: string;
  replayed: boolean;
}

export interface SandboxState {
  tables: Record<string, SandboxRow[]>;
  writes: SandboxWriteRecord[];
}

export interface SandboxWriteResult {
  ok: boolean;
  writeId: string;
  table: string;
  rowsAffected: number;
  replayed: boolean;
  idempotencyKey: string;
  row: SandboxRow | null;
  blocked?: string;
}

export function seedSandbox(): SandboxState {
  return {
    tables: {
      "sandbox.metric_scratch": [],
      "sandbox.refund_scratch": [],
    },
    writes: [],
  };
}

function unquote(raw: string): Scalar {
  const t = raw.trim();
  if (/^null$/i.test(t)) return null;
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1).replace(/''/g, "'");
  }
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

function parseInsert(sql: string, table: string): SandboxRow | null {
  const m = sql.match(
    /insert\s+into\s+sandbox\.\w+\s*(?:\(([^)]+)\))?\s*values\s*\(([^)]+)\)/i,
  );
  if (!m) return { _raw: sql, written_at: new Date().toISOString() };
  const cols = m[1]
    ? m[1].split(",").map((c) => c.trim().replace(/["`]/g, "").toLowerCase())
    : ["value"];
  const vals = splitArgs(m[2]);
  const row: SandboxRow = { written_at: new Date().toISOString() };
  cols.forEach((c, i) => {
    row[c] = unquote(vals[i] ?? "null");
  });
  row._table = table;
  return row;
}

function splitArgs(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q: "'" | '"' | null = null;
  for (const ch of s) {
    if (q) {
      cur += ch;
      if (ch === q) q = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      q = ch;
      cur += ch;
      continue;
    }
    if (ch === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function applyDml(state: SandboxState, sql: string, table: string, verb: string): { rowsAffected: number; row: SandboxRow | null } {
  if (!state.tables[table]) state.tables[table] = [];
  if (verb === "insert") {
    const row = parseInsert(sql, table) ?? { written_at: new Date().toISOString() };
    state.tables[table].push(row);
    return { rowsAffected: 1, row };
  }
  if (verb === "delete") {
    const before = state.tables[table].length;
    state.tables[table] = [];
    return { rowsAffected: before, row: null };
  }
  if (verb === "update") {
    const n = state.tables[table].length;
    return { rowsAffected: n, row: state.tables[table][0] ?? null };
  }
  const row = { _raw: sql, written_at: new Date().toISOString() };
  state.tables[table].push(row);
  return { rowsAffected: 1, row };
}

export function executeSandboxWrite(
  state: SandboxState,
  input: { sql: string; approvalId: string; credentialId: string; idempotencyKey: string },
): SandboxWriteResult {
  const prior = state.writes.find((w) => w.idempotencyKey === input.idempotencyKey);
  if (prior) {
    return {
      ok: true,
      writeId: prior.writeId,
      table: prior.table,
      rowsAffected: prior.rowsAffected,
      replayed: true,
      idempotencyKey: prior.idempotencyKey,
      row: prior.row,
    };
  }
  const valid = validateSandboxWriteSql(input.sql);
  if (!valid.ok || !valid.table || !valid.verb) {
    return {
      ok: false,
      writeId: "",
      table: valid.table ?? "",
      rowsAffected: 0,
      replayed: false,
      idempotencyKey: input.idempotencyKey,
      row: null,
      blocked: valid.notes.join(" "),
    };
  }
  if (!valid.table.startsWith("sandbox.")) {
    return {
      ok: false,
      writeId: "",
      table: valid.table,
      rowsAffected: 0,
      replayed: false,
      idempotencyKey: input.idempotencyKey,
      row: null,
      blocked: "Production execution is disabled. Only sandbox.* is writable.",
    };
  }
  const applied = applyDml(state, valid.normalized, valid.table, valid.verb);
  const record: SandboxWriteRecord = {
    writeId: `sw_${uuid().slice(0, 8)}`,
    approvalId: input.approvalId,
    credentialId: input.credentialId,
    table: valid.table,
    sql: valid.normalized,
    idempotencyKey: input.idempotencyKey,
    rowsAffected: applied.rowsAffected,
    row: applied.row,
    at: new Date().toISOString(),
    replayed: false,
  };
  state.writes.unshift(record);
  if (state.writes.length > 400) state.writes.length = 400;
  return {
    ok: true,
    writeId: record.writeId,
    table: record.table,
    rowsAffected: record.rowsAffected,
    replayed: false,
    idempotencyKey: record.idempotencyKey,
    row: record.row,
  };
}

export function sandboxDigest(state: SandboxState) {
  return sha256(JSON.stringify({ tables: Object.keys(state.tables).sort(), writes: state.writes.length }));
}

export type { JsonValue };
