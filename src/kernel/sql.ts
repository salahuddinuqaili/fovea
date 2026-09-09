/**
 * Deterministic SQL validators. Tool output and model-authored SQL are untrusted
 * data: they cannot widen policy, touch production catalogs, or smuggle writes
 * through comments / stacked statements.
 *
 * Comments are stripped only in code. Contents of string literals (including
 * `--`, `/*`, `WHERE`, and `;`) stay intact so stacked writes cannot hide
 * behind a fake line comment.
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

type SqlTok = { kind: "code" | "string"; text: string };

export interface SqlScan {
  stripped: string;
  error: string | null;
  tokens: SqlTok[];
}

function dollarTagAt(sql: string, i: number): string | null {
  if (sql[i] !== "$") return null;
  let j = i + 1;
  while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j]!)) j++;
  if (sql[j] === "$") return sql.slice(i, j + 1);
  return null;
}

function tokenizeSql(sql: string): { tokens: SqlTok[]; error: string | null } {
  const tokens: SqlTok[] = [];
  let i = 0;
  let code = "";
  const flushCode = () => {
    if (code) {
      tokens.push({ kind: "code", text: code });
      code = "";
    }
  };

  while (i < sql.length) {
    const c = sql[i]!;
    const n = sql[i + 1];

    if (c === "-" && n === "-") {
      i += 2;
      while (i < sql.length && sql[i] !== "\n") i++;
      code += " ";
      continue;
    }

    if (c === "/" && n === "*") {
      i += 2;
      let nest = 1;
      while (i < sql.length && nest > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          nest++;
          i += 2;
          continue;
        }
        if (sql[i] === "*" && sql[i + 1] === "/") {
          nest--;
          i += 2;
          continue;
        }
        i++;
      }
      if (nest > 0) {
        flushCode();
        return { tokens, error: "Unterminated block comment." };
      }
      code += " ";
      continue;
    }

    const dollar = dollarTagAt(sql, i);
    if (dollar) {
      flushCode();
      const close = sql.indexOf(dollar, i + dollar.length);
      if (close < 0) return { tokens, error: "Unterminated dollar-quoted string." };
      tokens.push({ kind: "string", text: sql.slice(i, close + dollar.length) });
      i = close + dollar.length;
      continue;
    }

    if (c === "'" || c === '"') {
      flushCode();
      let j = i + 1;
      let closed = false;
      while (j < sql.length) {
        if (sql[j] === c) {
          if (sql[j + 1] === c) {
            j += 2;
            continue;
          }
          j++;
          closed = true;
          break;
        }
        j++;
      }
      if (!closed) return { tokens, error: "Unterminated string literal." };
      tokens.push({ kind: "string", text: sql.slice(i, j) });
      i = j;
      continue;
    }

    code += c;
    i++;
  }
  flushCode();
  return { tokens, error: null };
}

function collapseCode(text: string): string {
  return text.replace(/\s+/g, " ");
}

function codeText(tokens: SqlTok[]): string {
  return tokens
    .filter((t) => t.kind === "code")
    .map((t) => t.text)
    .join(" ");
}

function renderStripped(tokens: SqlTok[]): string {
  return tokens
    .map((t) => (t.kind === "code" ? collapseCode(t.text) : t.text))
    .join("")
    .trim();
}

export function scanSql(sql: string): SqlScan {
  const { tokens, error } = tokenizeSql(sql);
  if (error) return { stripped: "", error, tokens };
  return { stripped: renderStripped(tokens), error: null, tokens };
}

export function stripSqlComments(sql: string): string {
  const scan = scanSql(sql);
  if (scan.error) return "";
  return scan.stripped;
}

export function splitStatements(sql: string): string[] {
  const { tokens, error } = tokenizeSql(sql);
  if (error) return [];
  const parts: string[] = [];
  let cur = "";
  const flush = () => {
    const s = cur.trim();
    if (s) parts.push(s);
    cur = "";
  };
  for (const t of tokens) {
    if (t.kind === "string") {
      cur += t.text;
      continue;
    }
    let buf = collapseCode(t.text);
    while (buf.includes(";")) {
      const idx = buf.indexOf(";");
      cur += buf.slice(0, idx);
      flush();
      buf = buf.slice(idx + 1);
    }
    cur += buf;
  }
  flush();
  return parts;
}

function splitOnKeywordOutsideStrings(sql: string, keyword: RegExp): string[] {
  const { tokens, error } = tokenizeSql(sql);
  if (error) return [sql];
  let combined = "";
  const marks: { start: number; end: number; kind: "code" | "string" }[] = [];
  for (const t of tokens) {
    const text = t.kind === "code" ? collapseCode(t.text) : t.text;
    marks.push({ start: combined.length, end: combined.length + text.length, kind: t.kind });
    combined += text;
  }
  const flags = keyword.flags.includes("g") ? keyword.flags : `${keyword.flags}g`;
  const re = new RegExp(keyword.source, flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(combined))) {
    const idx = m.index;
    const mark = marks.find((x) => idx >= x.start && idx < x.end);
    if (mark?.kind === "code") {
      return [combined.slice(0, idx), combined.slice(idx + m[0].length)];
    }
  }
  return [combined];
}

export function tablesInSql(sql: string): string[] {
  const found = new Set<string>();
  const re = /\b((?:analytics|sandbox|finance|raw)\.\w+|fct_\w+|mart_\w+|dim_\w+|stg_\w+)\b/gi;
  const { tokens, error } = tokenizeSql(sql);
  const stripped = error ? sql : codeText(tokens);
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    const raw = m[1]!.toLowerCase();
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
    const schema = table.split(".")[0]!;
    if (!ALLOWED_SCHEMAS.has(schema)) {
      notes.push(`Schema ${schema} is not on the read/write allowlist.`);
    }
    if (table === "raw.customers") notes.push("raw.customers is denylisted.");
  }
  return notes;
}

export function validateReadSql(sql: string): SqlValidation {
  const scan = scanSql(sql);
  if (scan.error) return deny([scan.error]);
  const statements = splitStatements(sql);
  const normalized = statements[0] ?? "";
  if (statements.length === 0) return deny(["Empty SQL."]);
  if (statements.length > 1) {
    return deny(["Multiple statements are not permitted on the read path."], { statements });
  }
  const { tokens } = tokenizeSql(normalized);
  const code = codeText(tokens);
  if (WRITE_KEYWORDS.test(code)) {
    return deny(["Write or DDL keywords are not permitted on the read path."], {
      statements,
      normalized,
    });
  }
  if (!/\bselect\b/i.test(code) || !/^\s*(with\b[\s\S]+)?select\b/i.test(normalized)) {
    return deny(["Only SELECT (optionally WITH) statements are permitted."], {
      statements,
      normalized,
    });
  }
  if (/\binto\b/i.test(code)) {
    return deny(["SELECT INTO, INTO OUTFILE, and related forms are blocked."], {
      statements,
      normalized,
    });
  }
  if (/outfile|dumpfile|load_file|pg_read_file/i.test(code)) {
    return deny(["File and export primitives are blocked."], { statements, normalized });
  }
  const tables = tablesInSql(normalized);
  const catalog = catalogViolations(code, tables);
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
  const scan = scanSql(sql);
  const statements = scan.error ? [] : splitStatements(sql);
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
  if (scan.error) return { ...empty, notes: [scan.error] };
  if (statements.length === 0) return { ...empty, notes: ["Empty SQL."] };
  if (statements.length > 1) {
    return { ...empty, notes: ["Multiple statements are not permitted on the sandbox write path."] };
  }
  const { tokens } = tokenizeSql(normalized);
  const code = codeText(tokens);
  if (/\b(drop|truncate|alter|grant|revoke|create|replace|call|execute|copy|do)\b/i.test(code)) {
    return { ...empty, notes: ["DDL, GRANT, and procedural forms are blocked even in sandbox."] };
  }
  const verbMatch = code.trim().match(/^(insert|update|delete|merge)\b/i);
  if (!verbMatch || !SANDBOX_WRITE_VERBS.test(verbMatch[1]!)) {
    return { ...empty, notes: ["Sandbox writes must be INSERT, UPDATE, or DELETE. MERGE is not implemented."] };
  }
  if (/\binto\s+outfile|\bselect\s+[\s\S]*\binto\b/i.test(code) && !/^\s*insert\b/i.test(code)) {
    return { ...empty, notes: ["SELECT INTO is blocked."] };
  }
  const verb = verbMatch[1]!.toLowerCase();
  if (verb === "update" || verb === "delete") {
    const parts = splitOnKeywordOutsideStrings(normalized, /\bwhere\b/i);
    if (parts.length < 2) {
      return { ...empty, notes: ["UPDATE/DELETE without WHERE is refused. Name the rows."] };
    }
    const whereClause = parts[1] ?? "";
    const whereCode = codeText(tokenizeSql(whereClause).tokens);
    if (/\b(or|in\s*\(|like|between|exists|not\s+in)\b/i.test(whereCode)) {
      return { ...empty, notes: ["Sandbox UPDATE/DELETE WHERE must be a single column equality."] };
    }
    if (!/^\s*[a-z_][\w]*\s*=\s*(?:'[^']*'|"[^"]*"|-?\d+(?:\.\d+)?|true|false|null)\s*$/i.test(whereClause.trim())) {
      return { ...empty, notes: ["Sandbox UPDATE/DELETE WHERE must be `column = value`."] };
    }
  }
  if (verb === "update" && !/\bset\b/i.test(code)) {
    return { ...empty, notes: ["UPDATE requires SET."] };
  }
  const tables = tablesInSql(normalized);
  const catalog = catalogViolations(code, tables);
  if (catalog.length) return { ...empty, notes: catalog, tables };
  const target =
    tables.find((t) => t.startsWith("sandbox.")) ??
    (code.match(/\b(sandbox\.\w+)/i)?.[1]?.toLowerCase() ?? null);
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
    verb,
  };
}

export function isProdTable(table: string) {
  const t = table.toLowerCase();
  return t.startsWith("analytics.") || t.startsWith("raw.") || t.startsWith("finance.");
}

export function looksLikeWriteSql(text: string) {
  const { tokens, error } = tokenizeSql(text);
  if (error) return true;
  return WRITE_KEYWORDS.test(codeText(tokens));
}
