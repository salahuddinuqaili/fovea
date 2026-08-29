/**
 * Deterministic SQL validators. Tool output and model-authored SQL are untrusted
 * data: they cannot widen policy, touch production catalogs, or smuggle writes
 * through comments / stacked statements.
 */

const WRITE_KEYWORDS =
  /\b(insert|update|delete|merge|drop|truncate|alter|grant|revoke|copy|create|replace|call|execute|do)\b/i;

const ALLOWED_SCHEMAS = new Set(["analytics", "sandbox", "finance"]);
const SANDBOX_WRITE_VERBS = /^(insert|update|delete)$/i;
const DENY_OBJECTS = [
  /\bpg_catalog\b/i,
  /\binformation_schema\b/i,
  /\bpg_read_file\b/i,
  /\bpg_ls_dir\b/i,
  /\blo_import\b/i,
  /\blo_export\b/i,
  /\bdblink\b/i,
  /\bfile_fdw\b/i,
  /\braw\.customers\b/i,
  /\bpg_\w+/i,
];

export function stripSqlComments(sql: string): string {
  let s = sql.replace(/\/\*[\s\S]*?\*\//g, " ");
  s = s.replace(/--[^\n]*/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

export function splitStatements(sql: string): string[] {
  const stripped = stripSqlComments(sql).replace(/;+\s*$/, "");
  if (!stripped) return [];
  return stripped
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function tablesInSql(sql: string): string[] {
  const found = new Set<string>();
  const re = /\b((?:analytics|sandbox|finance|raw)\.\w+|fct_\w+|mart_\w+|dim_\w+|stg_\w+)\b/gi;
  const stripped = stripSqlComments(sql);
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    const raw = m[1].toLowerCase();
    if (raw.includes(".")) found.add(raw);
    else found.add(`analytics.${raw}`);
  }
  return [...found];
}

export interface SqlValidation {
  ok: boolean;
  notes: string[];
  tables: string[];
  statements: string[];
  normalized: string;
}

function deny(notes: string[], extra?: Partial<SqlValidation>): SqlValidation {
  return {
    ok: false,
    notes,
    tables: extra?.tables ?? [],
    statements: extra?.statements ?? [],
    normalized: extra?.normalized ?? "",
  };
}

function catalogViolations(sql: string, tables: string[]): string[] {
  const notes: string[] = [];
  for (const rule of DENY_OBJECTS) {
    if (rule.test(sql)) notes.push(`Denied catalog or object: ${rule.source}`);
  }
  for (const table of tables) {
    const schema = table.split(".")[0];
    if (!ALLOWED_SCHEMAS.has(schema)) {
      notes.push(`Schema ${schema} is not on the read/write allowlist.`);
    }
    if (table === "raw.customers") notes.push("raw.customers is denylisted.");
  }
  return notes;
}

export function validateReadSql(sql: string): SqlValidation {
  const statements = splitStatements(sql);
  const normalized = statements[0] ?? "";
  if (statements.length === 0) return deny(["Empty SQL."]);
  if (statements.length > 1) {
    return deny(["Multiple statements are not permitted on the read path."], { statements });
  }
  if (WRITE_KEYWORDS.test(normalized)) {
    return deny(["Write or DDL keywords are not permitted on the read path."], {
      statements,
      normalized,
    });
  }
  if (!/^\s*(with\b[\s\S]+)?select\b/i.test(normalized)) {
    return deny(["Only SELECT (optionally WITH) statements are permitted."], {
      statements,
      normalized,
    });
  }
  if (/\binto\b/i.test(normalized)) {
    return deny(["SELECT INTO, INTO OUTFILE, and related forms are blocked."], {
      statements,
      normalized,
    });
  }
  if (/outfile|dumpfile|load_file|pg_read_file/i.test(normalized)) {
    return deny(["File and export primitives are blocked."], { statements, normalized });
  }
  const tables = tablesInSql(normalized);
  const catalog = catalogViolations(normalized, tables);
  if (catalog.length) return deny(catalog, { statements, normalized, tables });
  return {
    ok: true,
    notes: ["Parser: SELECT-only after comment strip.", "Single statement.", "Allowlisted schemas."],
    tables,
    statements,
    normalized,
  };
}

export interface SandboxWriteValidation extends SqlValidation {
  table: string | null;
  verb: string | null;
}

export function validateSandboxWriteSql(sql: string): SandboxWriteValidation {
  const statements = splitStatements(sql);
  const normalized = statements[0] ?? "";
  const empty: SandboxWriteValidation = {
    ok: false,
    notes: [],
    tables: [],
    statements,
    normalized,
    table: null,
    verb: null,
  };
  if (statements.length === 0) return { ...empty, notes: ["Empty SQL."] };
  if (statements.length > 1) {
    return { ...empty, notes: ["Multiple statements are not permitted on the sandbox write path."] };
  }
  if (/\b(drop|truncate|alter|grant|revoke|create|replace|call|execute|copy|do)\b/i.test(normalized)) {
    return { ...empty, notes: ["DDL, GRANT, and procedural forms are blocked even in sandbox."] };
  }
  const verbMatch = normalized.match(/^\s*(insert|update|delete|merge)\b/i);
  if (!verbMatch || !SANDBOX_WRITE_VERBS.test(verbMatch[1])) {
    return { ...empty, notes: ["Sandbox writes must be INSERT, UPDATE, or DELETE. MERGE is not implemented."] };
  }
  if (/\binto\s+outfile|\bselect\s+[\s\S]*\binto\b/i.test(normalized) && !/^\s*insert\b/i.test(normalized)) {
    return { ...empty, notes: ["SELECT INTO is blocked."] };
  }
  const verb = verbMatch[1].toLowerCase();
  if (verb === "update" || verb === "delete") {
    if (!/\bwhere\b/i.test(normalized)) {
      return { ...empty, notes: ["UPDATE/DELETE without WHERE is refused. Name the rows."] };
    }
    const whereClause = normalized.split(/\bwhere\b/i)[1] ?? "";
    if (/\b(or|in\s*\(|like|between|exists|not\s+in)\b/i.test(whereClause)) {
      return { ...empty, notes: ["Sandbox UPDATE/DELETE WHERE must be a single column equality."] };
    }
    if (!/^\s*[a-z_][\w]*\s*=\s*(?:'[^']*'|"[^"]*"|-?\d+(?:\.\d+)?|true|false|null)\s*$/i.test(whereClause.trim())) {
      return { ...empty, notes: ["Sandbox UPDATE/DELETE WHERE must be `column = value`."] };
    }
  }
  if (verb === "update" && !/\bset\b/i.test(normalized)) {
    return { ...empty, notes: ["UPDATE requires SET."] };
  }
  const tables = tablesInSql(normalized);
  const catalog = catalogViolations(normalized, tables);
  if (catalog.length) return { ...empty, notes: catalog, tables };
  const target =
    tables.find((t) => t.startsWith("sandbox.")) ??
    (normalized.match(/\b(sandbox\.\w+)/i)?.[1]?.toLowerCase() ?? null);
  if (!target) {
    return { ...empty, notes: ["Sandbox writes must target a sandbox.* table."], tables };
  }
  const prod = tables.filter((t) => !t.startsWith("sandbox."));
  if (prod.length) {
    return {
      ...empty,
      notes: [`Production or non-sandbox tables are blocked: ${prod.join(", ")}`],
      tables,
    };
  }
  return {
    ok: true,
    notes: ["Sandbox write validator: single DML, sandbox.* only, no DDL."],
    tables,
    statements,
    normalized,
    table: target,
    verb: verbMatch[1].toLowerCase(),
  };
}

export function isProdTable(table: string) {
  const t = table.toLowerCase();
  return t.startsWith("analytics.") || t.startsWith("raw.") || t.startsWith("finance.");
}

export function looksLikeWriteSql(text: string) {
  return WRITE_KEYWORDS.test(stripSqlComments(text));
}
