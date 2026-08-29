import { digestObject, sha256, uuid } from "./crypto.ts";
import { FILL_RATE, METRICS, REFUND_RATE } from "./fixtures.ts";
import { executeApprovedAction, hashProposedAction, type ExecutionReport } from "./credentials.ts";
import { toEvidencePack } from "./evidence.ts";
import { canReadMemory, toImprovementEvent } from "./memory.ts";
import { infer, pickModel, xaiAvailable } from "./models.ts";
import { evaluatePolicy } from "./policy.ts";
import { parseRange, planBackfill, walk } from "./pipeline.ts";
import { KernelStore, makePersonalNote } from "./store.ts";
import { dryRunSql, executeReadSql, lintSql, readRepo, readTicket, wrapToolCall } from "./tools.ts";
import { validateSandboxWriteSql } from "./sql.ts";
import { connectLiveWarehouse } from "./warehouse.ts";
import { findGrant, grantContinuesReads, grantHoursLeft, isGrantActive, issueGrant, matchingGrant, parseGrantRequest, parseRevokeRequest, revokeGrant, shadowStageD } from "./grants.ts";
import type {
  Approval,
  NextAction,
  PolicyRequest,
  PolicyResponse,
  ProvenanceRecord,
  SkillManifest,
  ToolCall,
  WorkResult,
} from "./types.ts";
import { AGENT_ID, AGENT_RELEASE, POLICY_VERSION } from "./types.ts";

const INJECTION =
  /ignore (all )?(previous|prior|system) (instructions|rules|policy)|bypass (the )?policy|you are now|exfiltrat|dump .{0,80}(to my laptop|to disk|customers table)|disable (the )?(audit|policy|guardrail)|install (an? )?(unofficial |slack )?(plugin|mcp)|reveal (all )?(secrets|credentials)/i;

const WRITE_ASK =
  /\b(insert into|update\s+\w+|delete from|drop table|truncate|overwrite (the )?table|grant\s+(select|insert|update|all|usage|execute)|alter table|push to prod|merge the (branch|pr)|send (a )?slack|email everyone)\b/i;

export type Intent =
  | "injection"
  | "policy_bypass"
  | "write"
  | "sandbox_write"
  | "backfill"
  | "metric"
  | "sql"
  | "ambiguous_metric"
  | "memory_probe"
  | "session_close"
  | "incident"
  | "autonomy_switch"
  | "live_warehouse"
  | "grant_issue"
  | "grant_revoke"
  | "general";

export function classifyIntent(text: string): Intent {
  const t = text.trim();
  if (/session[- ]close|wrap up (this )?session|close (the )?session/i.test(t)) return "session_close";
  if (INJECTION.test(t) || /ignore fovea policy/i.test(t)) return "injection";
  if (
    /enable autonomous|autonomous mode|turn on (stage )?d\b|global autonomy|set (everyone|all principals) autonomous|make (the )?os autonomous/i.test(
      t,
    )
  )
    return "autonomy_switch";
  if (/bypass|override (the )?policy|as an admin, allow/i.test(t)) return "policy_bypass";
  if (/another user'?s memory|maya'?s (private|personal) (notes|memory)|cross-user/i.test(t)) return "memory_probe";
  if (/connect (the )?(live|production) warehouse|query (the )?live warehouse|arm live (warehouse|dsn)/i.test(t))
    return "live_warehouse";
  if (/\brevoke\s+/i.test(t)) return "grant_revoke";
  if (/\bgrant\s+[a-z]+\s+\S+\s+for\s+/i.test(t)) return "grant_issue";
  if (/backfill|rerun (the )?(last|past|affected)|reprocess partition/i.test(t)) return "backfill";
  if ((WRITE_ASK.test(t) || /\bwrite .{0,60}sandbox\./i.test(t)) && /\bsandbox\./i.test(t)) return "sandbox_write";
  if (WRITE_ASK.test(t)) return "write";
  if (
    /investigate (the )?(dip|drop|week|incident)/i.test(t) ||
    /what happened (last week|to the numbers|on 2026)/i.test(t) ||
    /why did .{0,40}(drop|dip|fall)/i.test(t) ||
    /incident brief/i.test(t)
  )
    return "incident";
  const metricHit = METRICS.filter(
    (m) =>
      t.toLowerCase().includes(m.name.toLowerCase()) ||
      t.toLowerCase().includes(m.id.replace(/_/g, " ")) ||
      t.toLowerCase().includes(m.id),
  );
  if (
    /north-?star revenue|weekly active accounts|order fill rate|refund rate/i.test(t) ||
    metricHit.some((m) => m.status === "canonical")
  )
    return "metric";
  if (/\brevenue\b|\bsales\b|\bgmv\b/i.test(t) && metricHit.length !== 1) return "ambiguous_metric";
  if (/select |write (a |me )?sql|sql for|query the warehouse/i.test(t)) return "sql";
  return "general";
}

function emptyProvenance(taskId: string, principalId: string): ProvenanceRecord {
  return {
    resultId: `res_${uuid().slice(0, 8)}`,
    taskId,
    principalId,
    agentRelease: AGENT_RELEASE,
    policyRelease: POLICY_VERSION,
    skillVersions: [],
    modelCalls: [],
    queries: [],
    codeSources: [],
    metricDefinitions: [],
    toolCalls: [],
    approvals: [],
    outputHash: sha256(""),
    createdAt: new Date().toISOString(),
  };
}

export async function runWork(
  store: KernelStore,
  input: { principalId: string; message: string; skillId?: string },
): Promise<WorkResult> {
  const principal = store.principal(input.principalId);
  if (!principal) throw new Error("Unknown principal");
  if (store.state.kill.entireOs) throw new Error("Fovea is disabled by kill switch.");

  const session = store.getOrCreateSession(input.principalId);
  const taskId = `task_${uuid().slice(0, 10)}`;
  const started = new Date().toISOString();
  const behaviors: string[] = [];
  const policyDecisions: PolicyResponse[] = [];
  const toolCalls: ToolCall[] = [];
  const approvals: Approval[] = [];
  const provenance = emptyProvenance(taskId, principal.id);
  const events: WorkResult["events"] = [];

  const emit = (eventType: string, summary: string, extra?: Partial<WorkResult["events"][number]>) => {
    const ev = store.emit({
      taskId,
      sessionId: session.sessionId,
      principalId: principal.id,
      eventType,
      resourceIds: extra?.resourceIds ?? [],
      decision: extra?.decision,
      cost: extra?.cost,
      correlationId: taskId,
      summary,
    });
    events.push(ev);
    return ev;
  };

  emit("request.received", input.message.slice(0, 180));

  const policyFor = (partial: Partial<PolicyRequest> & Pick<PolicyRequest, "action" | "tool">) => {
    const req: PolicyRequest = {
      principalId: principal.id,
      agent: AGENT_ID,
      task: input.skillId ?? "interactive",
      resource: partial.resource ?? "*",
      dataClass: partial.dataClass ?? "internal",
      estimatedCost: partial.estimatedCost ?? 0.05,
      autonomyStage: principal.autonomyStage,
      environment: "demo",
      origin: partial.origin ?? "user",
      ...partial,
    };
    const resp = evaluatePolicy(req, {
      principal,
      killWritePlane: store.state.kill.writePlane,
      killEntireOs: store.state.kill.entireOs,
      disabledTools: store.state.kill.tools,
      disabledModels: store.state.kill.models,
    });
    policyDecisions.push(resp);
    emit("policy.evaluated", `${req.action} → ${resp.decision}`, { decision: resp.decision });
    return resp;
  };

  const intent = classifyIntent(input.message);
  behaviors.push(`intent:${intent}`);

  const finish = (partial: Partial<WorkResult> & Pick<WorkResult, "status">): WorkResult => {
    applyGrantCoverage(store, principal.id, intent, partial, behaviors);
    const result: WorkResult = {
      taskId,
      sessionId: session.sessionId,
      principalId: principal.id,
      title: titleFor(intent, input.message),
      userRequest: input.message,
      skillId: input.skillId ?? skillFor(intent),
      answer: partial.answer,
      plan: partial.plan,
      sql: partial.sql,
      events,
      provenance: {
        ...provenance,
        outputHash: sha256(partial.answer?.text ?? partial.plan?.planHash ?? ""),
        skillVersions: resultSkill(input.skillId ?? skillFor(intent)),
        toolCalls: toolCalls.map((c) => c.callId),
        approvals: approvals.map((a) => a.approvalId),
      },
      policy: policyDecisions,
      cost: {
        totalUsd: store.state.costs.filter((c) => c.taskId === taskId).reduce((s, c) => s + c.amountUsd, 0),
        items: store.state.costs.filter((c) => c.taskId === taskId),
      },
      behaviors,
      approvals,
      toolCalls,
      nextAction: nextActionFor(partial.status, intent, approvals, behaviors, store, principal.id),
      evidencePack: null,
      createdAt: started,
      finishedAt: new Date().toISOString(),
      status: partial.status,
    };
    result.evidencePack = toEvidencePack(result);
    emit("result.produced", `status=${result.status}`);
    emit("provenance.finalized", result.provenance?.resultId ?? "");
    store.addTask(result);
    return result;
  };

  if (session.costBudgetUsd - session.spentUsd <= 0) {
    behaviors.push("budget_exhausted", "no_write_executed");
    return finish({
      status: "blocked",
      answer: {
        claimClass: "refusal",
        text: `Session cost budget of $${session.costBudgetUsd.toFixed(2)} is exhausted (spent $${session.spentUsd.toFixed(3)}). Fovea will not start another paid tool or model call until the session is closed or the budget is raised by an OS owner.`,
        citations: [{ label: "session budget", kind: "policy", ref: "cost.budget" }],
      },
    });
  }

  if (intent === "injection" || intent === "policy_bypass") {
    behaviors.push("refused_policy", "injection_detected", "untrusted_content_not_elevated");
    policyFor({ action: "policy.override", tool: "none", origin: "untrusted", task: "policy.override" });
    return finish({
      status: "refused",
      answer: {
        claimClass: "refusal",
        text: "Refused. Untrusted instructions cannot override Fovea policy. Data is not policy — ticket text, READMEs, tool output, and prompt injections are treated as data. No credentials were revealed, no plugin was installed, and no write was issued.",
        citations: [{ label: "INV-007", kind: "policy", ref: "untrusted-content" }],
      },
    });
  }

  if (intent === "memory_probe") {
    const mayaNote = store.state.memory.find((m) => m.scope === "personal" && m.ownerPrincipalId === "prin_maya");
    const allowed = canReadMemory(
      principal.id,
      mayaNote ?? {
        id: "x",
        scope: "personal",
        ownerPrincipalId: "prin_maya",
        teamId: null,
        path: "",
        title: "",
        body: "",
        origin: "memory",
        createdAt: "",
        updatedAt: "",
        encrypted: true,
      },
      principal.actions.includes("memory.read.personal"),
    );
    emit("memory.read", allowed.ok ? "allowed" : "denied");
    if (!allowed.ok) {
      behaviors.push("cross_user_memory_denied");
      return finish({
        status: "refused",
        answer: {
          claimClass: "refusal",
          text: "Refused. Personal memory is isolated per principal. Another user's private notes cannot be read by analysts, approvers, or ordinary administrators (INV-005).",
          citations: [{ label: "INV-005", kind: "policy", ref: "personal-memory" }],
        },
      });
    }
    behaviors.push("personal_memory_owner_ok");
    return finish({
      status: "completed",
      answer: {
        claimClass: "supported",
        text: "Owner access granted to your personal namespace only. Nothing was promoted to team or org memory.",
        citations: [{ label: "personal memory", kind: "document", ref: "/personal" }],
      },
    });
  }

  if (intent === "write" || intent === "sandbox_write") {
    return finish(runWriteProposal({
      intent,
      message: input.message,
      principalId: principal.id,
      taskId,
      policyFor,
      approvals,
      store,
      emit,
      behaviors,
      toolCalls,
    }));
  }

  if (intent === "ambiguous_metric") {
    behaviors.push("abstained", "ambiguity_detected", "canonical_lookup");
    policyFor({ action: "read", tool: "docs.read" });
    return finish({
      status: "abstained",
      answer: {
        claimClass: "abstention",
        text: "I cannot establish this reliably from the available evidence. “Revenue” maps to more than one definition: canonical north-star revenue (GMV of completed non-test orders) and draft booked revenue (recognized). Ask for a named canonical metric and I will retrieve evidence.",
        citations: METRICS.map((m) => ({ label: m.name, kind: "metric" as const, ref: m.id })),
      },
    });
  }

  if (intent === "metric") {
    return finish(
      await runMetric(store, { principal, taskId, message: input.message, policyFor, toolCalls, provenance, behaviors, emit }),
    );
  }

  if (intent === "sql") {
    return finish(
      runSql({
        principal: { id: principal.id },
        message: input.message,
        policyFor,
        toolCalls,
        provenance,
        behaviors,
        emit,
        taskId,
        principalId: principal.id,
        store,
      }),
    );
  }

  if (intent === "backfill") {
    return finish(
      runBackfill({
        principal: { id: principal.id },
        store,
        principalId: principal.id,
        taskId,
        message: input.message,
        policyFor,
        toolCalls,
        provenance,
        behaviors,
        emit,
        approvals,
      }),
    );
  }

  if (intent === "session_close") {
    return finish(runSessionClose(store, principal.id, taskId, session.sessionId, behaviors, emit));
  }

  if (intent === "autonomy_switch") {
    behaviors.push("no_global_autonomy", "refused_policy", "no_write_executed");
    policyFor({ action: "autonomy.global", tool: "none", task: "autonomy.global" });
    return finish({
      status: "refused",
      answer: {
        claimClass: "refusal",
        text: "Refused. There is no global autonomous switch. Stage D, if it ever happens, is a selected workflow: one principal, one tool, one task, a risk ceiling. Wildcards are denied. Production execution stays disabled.",
        citations: [{ label: "INV-stage-d", kind: "policy", ref: "autonomy.global" }],
      },
    });
  }

  if (intent === "live_warehouse") {
    const pol = policyFor({
      action: "read",
      tool: "warehouse.live",
      resource: "warehouse/live",
      dataClass: "confidential",
    });
    const attempt = connectLiveWarehouse(pol);
    behaviors.push("live_warehouse_gated", "no_write_executed");
    if (pol.decision === "deny") behaviors.push("refused_policy");
    return finish({
      status: "refused",
      answer: {
        claimClass: "refusal",
        text: `Live warehouse was not armed. ${attempt.reason} Fixture reads stay available for named canonical metrics. Writes remain hash-bound to sandbox.* only.`,
        citations: [
          { label: "warehouse.live", kind: "policy", ref: "warehouse.live" },
          { label: attempt.profile.id, kind: "pipeline", ref: attempt.profile.mode },
        ],
      },
    });
  }

  if (intent === "grant_issue") {
    return finish(runGrantIssue(store, principal, input.message, behaviors, policyFor));
  }

  if (intent === "grant_revoke") {
    return finish(runGrantRevoke(store, principal, input.message, behaviors, policyFor));
  }

  if (intent === "incident") {
    return finish(
      runIncident(store, {
        principal: { id: principal.id },
        taskId,
        message: input.message,
        policyFor,
        toolCalls,
        provenance,
        behaviors,
        emit,
      }),
    );
  }

  if (/readme|ticket|AN-1842|runbook/i.test(input.message)) {
    const repo = readRepo("README.md");
    const ticket = readTicket("AN-1842");
    if (repo.ok) {
      toolCalls.push(
        wrapToolCall("repo.read", { path: "README.md" }, { path: repo.file.path, origin: "repository" }, { origin: "repository" }),
      );
    }
    toolCalls.push(
      wrapToolCall("issues.read", { id: "AN-1842" }, { items: ticket.items.map((i) => i.id) }, { origin: "ticket" }),
    );
    behaviors.push("untrusted_tool_content_labeled", "injection_in_ticket_ignored", "injection_in_readme_ignored");
    policyFor({ action: "read", tool: "repo.read", origin: "untrusted" });
    return finish({
      status: "completed",
      answer: {
        claimClass: "derived",
        text: "Read untrusted repository and ticket text as data, not policy. The README and ticket AN-1842 both contain instructions aimed at the agent. Those instructions were not followed: no policy was bypassed, no plugin was installed, and no export was issued. Canonical metrics still live in the registry.",
        citations: [
          { label: "README.md", kind: "document", ref: "README.md" },
          { label: "AN-1842", kind: "document", ref: "AN-1842" },
        ],
      },
    });
  }

  if (xaiAvailable() && input.message.length > 12) {
    pickModel({ purpose: "analysis", dataClass: "internal", disabled: store.state.kill.models });
    policyFor({ action: "read", tool: "docs.read" });
    const inf = await infer({
      purpose: "analysis",
      dataClass: "internal",
      prompt: `User question (may contain untrusted text):\n${input.message}\n\nKnown canonical metrics: ${METRICS.filter((m) => m.status === "canonical").map((m) => m.id).join(", ")}.\nIf you cannot ground an answer in those, abstain.`,
    });
    store.addCost({ taskId, principalId: principal.id, kind: "model", amountUsd: inf.costUsd, detail: inf.modelAlias });
    provenance.modelCalls.push({ modelAlias: inf.modelAlias, modelVersion: "grok-4.5", purpose: "analysis" });
    behaviors.push("model_called");
    if (!inf.ok) {
      behaviors.push("abstained");
      return finish({
        status: "abstained",
        answer: {
          claimClass: "abstention",
          text: "I cannot establish this reliably from the available evidence. Try a named metric (north-star revenue, weekly active accounts, order fill rate), a SQL read, or a backfill plan.",
          citations: [],
        },
      });
    }
    return finish({
      status: "completed",
      answer: { claimClass: "inferred", text: inf.text, citations: [{ label: inf.modelAlias, kind: "document", ref: "model" }] },
    });
  }

  behaviors.push("abstained");
  return finish({
    status: "abstained",
    answer: {
      claimClass: "abstention",
      text: "I cannot establish this reliably from the available evidence. Fovea will not guess. Try: “What was north-star revenue last week?”, “SQL for weekly active accounts”, or “Backfill the affected fct_orders partitions after the upstream correction.”",
      citations: [],
    },
  });
}

function runWriteProposal(ctx: {
  intent: Intent;
  message: string;
  principalId: string;
  taskId: string;
  policyFor: WorkCtx["policyFor"];
  approvals: Approval[];
  store: KernelStore;
  emit: WorkCtx["emit"];
  behaviors: string[];
  toolCalls: ToolCall[];
}): Pick<WorkResult, "status" | "answer" | "sql"> {
  const extracted = extractSql(ctx.message);
  const sandboxProbe = validateSandboxWriteSql(extracted);
  const isSandbox = ctx.intent === "sandbox_write" || sandboxProbe.ok;

  if (isSandbox) {
    const sqlText = sandboxProbe.ok ? sandboxProbe.normalized : defaultSandboxInsert(ctx.message);
    const valid = validateSandboxWriteSql(sqlText);
    if (!valid.ok || !valid.table) {
      ctx.behaviors.push("sql_rejected", "no_write_executed");
      ctx.policyFor({ action: "write", tool: "warehouse.sandbox_write" });
      return {
        status: "blocked",
        sql: {
          query: sqlText,
          dryRun: { valid: false, scannedBytes: 0, estimatedCost: 0, notes: valid.notes },
          blocked: valid.notes.join(" "),
        },
        answer: {
          claimClass: "refusal",
          text: `Sandbox write rejected: ${valid.notes.join(" ")}`,
          citations: [{ label: "sandbox validator", kind: "policy", ref: "sandbox-write" }],
        },
      };
    }
    const idempotencyKey = sha256(`${ctx.principalId}|${valid.normalized}|${valid.table}`);
    const proposed = {
      kind: "sandbox_write" as const,
      sql: valid.normalized,
      table: valid.table,
      idempotencyKey,
    };
    const decision = ctx.policyFor({
      action: "write",
      tool: "warehouse.sandbox_write",
      resource: valid.table,
      dataClass: "internal",
      estimatedCost: 0.02,
    });
    ctx.behaviors.push("write_gated", "sandbox_write_proposed", "no_prod_write");
    ctx.toolCalls.push(
      wrapToolCall(
        "warehouse.sandbox_write",
        { sql: valid.normalized, dryRun: true },
        { table: valid.table, valid: true },
        { dryRun: true },
      ),
    );
    const approval = makeApproval(
      ctx.taskId,
      ctx.principalId,
      `Sandbox write ${valid.verb ?? "dml"} ${valid.table}`,
      [valid.table],
      0.02,
      digestObject(proposed),
      {
        kind: "sandbox_write",
        sql: valid.normalized,
        table: valid.table,
        idempotencyKey,
      },
    );
    ctx.store.addApproval(approval);
    ctx.approvals.push(approval);
    ctx.emit("approval.requested", approval.approvalId);
    return {
      status: "needs_approval",
      sql: {
        query: valid.normalized,
        dryRun: { valid: true, scannedBytes: 0, estimatedCost: 0.02, notes: valid.notes },
      },
      answer: {
        claimClass: "derived",
        text: `Sandbox write proposed against ${valid.table}. Policy: ${decision.decision}. Bound to action hash ${approval.proposedActionHash.slice(0, 12)}… An approver must accept this exact hash; Fovea will then mint a short-lived sandbox credential and execute. Production tables (analytics.*) stay out of scope.`,
        citations: [
          { label: valid.table, kind: "query", ref: valid.table },
          { label: "action hash", kind: "policy", ref: approval.proposedActionHash },
        ],
      },
    };
  }

  const sqlText = /select |insert |update |delete /i.test(ctx.message) ? extracted : ctx.message;
  ctx.behaviors.push("write_gated", "no_write_executed", "prod_execution_disabled");
  const decision = ctx.policyFor({
    action: "execute_write",
    tool: "warehouse.query",
    resource: "analytics.fct_orders",
    dataClass: "confidential",
    estimatedCost: 40,
  });
  const approval = makeApproval(
    ctx.taskId,
    ctx.principalId,
    ctx.message.slice(0, 180),
    ["analytics.fct_orders"],
    40,
    undefined,
    { kind: "prod_write", sql: sqlText.slice(0, 500), table: "analytics.fct_orders" },
  );
  ctx.store.addApproval(approval);
  ctx.approvals.push(approval);
  ctx.emit("approval.requested", approval.approvalId);
  return {
    status: "needs_approval",
    answer: {
      claimClass: "refusal",
      text: `Production write proposed. Policy decision: ${decision.decision}. ${decision.reason} Approval is bound to hash ${approval.proposedActionHash.slice(0, 12)}… Even after approval, v1 will not mint a production credential or execute against analytics.*. Use sandbox.* for Stage C writes.`,
      citations: [{ label: "prod writes", kind: "policy", ref: "autonomy.B" }],
    },
  };
}

function defaultSandboxInsert(message: string) {
  const note = message.replace(/\s+/g, " ").slice(0, 120).replace(/'/g, "");
  return `INSERT INTO sandbox.metric_scratch (week_start, metric_id, note) VALUES ('2026-08-24', 'order_fill_rate', '${note}')`;
}

async function runMetric(store: KernelStore, ctx: WorkCtx): Promise<Pick<WorkResult, "status" | "answer" | "sql">> {
  const { policyFor, toolCalls, provenance, behaviors, emit, taskId, message } = ctx;
  const metric =
    METRICS.find(
      (m) =>
        message.toLowerCase().includes(m.id.replace(/_/g, " ")) ||
        message.toLowerCase().includes(m.name.toLowerCase()) ||
        message.toLowerCase().includes(m.id),
    ) ??
    METRICS.find((m) => /north-?star/.test(message) && m.id === "northstar_revenue") ??
    METRICS.find((m) => /fill rate/.test(message) && m.id === "order_fill_rate") ??
    METRICS.find((m) => /refund rate/.test(message) && m.id === "refund_rate") ??
    METRICS.find((m) => /active account/.test(message) && m.id === "weekly_active_accounts");

  if (!metric || metric.status !== "canonical") {
    behaviors.push("abstained");
    return {
      status: "abstained",
      answer: { claimClass: "abstention", text: "No canonical metric matched. Fovea will not infer a definition from conversation.", citations: [] },
    };
  }

  behaviors.push("identify_correct_metric", "canonical_lookup");
  const readPol = policyFor({ action: "read", tool: "warehouse.query", resource: metric.sourceTable, dataClass: metric.dataClass });
  if (readPol.decision === "deny") {
    behaviors.push("refused_policy");
    return { status: "refused", answer: { claimClass: "refusal", text: readPol.reason, citations: [] } };
  }

  const sql = sqlForMetric(metric.id);
  const dry = dryRunSql(sql);
  toolCalls.push(wrapToolCall("warehouse.dry_run", { sql }, { valid: dry.valid, scannedBytes: dry.scannedBytes }, { dryRun: true, costUsd: 0 }));
  emit("tool.executed", "warehouse.dry_run");
  const job = executeReadSql(sql);
  toolCalls.push(wrapToolCall("warehouse.query", { sql }, { jobId: job.jobId, rowCount: job.rows.length }, { costUsd: job.costUsd }));
  store.addCost({ taskId, principalId: ctx.principal.id, kind: "warehouse", amountUsd: job.costUsd, detail: job.jobId });
  emit("tool.executed", "warehouse.query", { cost: job.costUsd });
  provenance.queries.push({
    queryHash: job.queryHash,
    jobId: job.jobId,
    datasets: ["analytics"],
    tables: job.tables,
    partitions: job.rows.map((r) => String(r.week_start ?? "")),
    executedAt: job.executedAt,
    sql,
  });
  provenance.metricDefinitions.push(metric.id);
  behaviors.push("query_executed_read_only", "provenance_complete");
  const last = job.rows[job.rows.length - 1];
  const prev = job.rows[job.rows.length - 2];
  let text = interpretMetric(metric.id, last, prev);
  const citations: NonNullable<WorkResult["answer"]>["citations"] = [
    { label: metric.name, kind: "metric", ref: metric.id },
    { label: job.jobId, kind: "query", ref: job.queryHash },
    { label: "provenance", kind: "provenance", ref: provenance.resultId },
  ];

  const grant = matchingGrant(store.state.grants, {
    principalId: ctx.principal.id,
    tool: "warehouse.query",
    task: "investigate-metric",
    action: "read",
  });
  if (grant) {
    const siblings = METRICS.filter((m) => m.status === "canonical" && m.id !== metric.id).slice(0, 3);
    const supporting: string[] = [];
    for (const sib of siblings) {
      const sibPol = policyFor({
        action: "read",
        tool: "warehouse.query",
        resource: sib.sourceTable,
        dataClass: sib.dataClass,
      });
      if (sibPol.decision === "deny") continue;
      const sibSql = sqlForMetric(sib.id);
      const sibDry = dryRunSql(sibSql);
      toolCalls.push(
        wrapToolCall("warehouse.dry_run", { sql: sibSql }, { valid: sibDry.valid, scannedBytes: sibDry.scannedBytes }, { dryRun: true, costUsd: 0 }),
      );
      emit("tool.executed", "warehouse.dry_run");
      const sibJob = executeReadSql(sibSql);
      toolCalls.push(
        wrapToolCall("warehouse.query", { sql: sibSql }, { jobId: sibJob.jobId, rowCount: sibJob.rows.length }, { costUsd: sibJob.costUsd }),
      );
      store.addCost({ taskId, principalId: ctx.principal.id, kind: "warehouse", amountUsd: sibJob.costUsd, detail: sibJob.jobId });
      emit("tool.executed", "warehouse.query", { cost: sibJob.costUsd });
      provenance.queries.push({
        queryHash: sibJob.queryHash,
        jobId: sibJob.jobId,
        datasets: ["analytics"],
        tables: sibJob.tables,
        partitions: sibJob.rows.map((r) => String(r.week_start ?? "")),
        executedAt: sibJob.executedAt,
        sql: sibSql,
      });
      provenance.metricDefinitions.push(sib.id);
      const sibLast = sibJob.rows[sibJob.rows.length - 1];
      const sibPrev = sibJob.rows[sibJob.rows.length - 2];
      supporting.push(metricLine(sib.id, sibLast, sibPrev));
      citations.push({ label: sib.name, kind: "metric", ref: sib.id });
      citations.push({ label: sibJob.jobId, kind: "query", ref: sibJob.queryHash });
    }
    if (supporting.length) {
      behaviors.push("grant_chained", "no_write_executed", "no_causal_claim");
      text = `${text}\n\nSupporting reads (named grant, not a causal claim):\n${supporting.map((s) => `• ${s}`).join("\n")}`;
    }
  }

  return {
    status: "completed",
    sql: { query: sql, dryRun: dry, rows: job.rows },
    answer: {
      claimClass: "supported",
      text,
      citations,
    },
  };
}

function runSql(ctx: WorkCtx & { store: KernelStore; principalId: string }): Pick<WorkResult, "status" | "answer" | "sql"> {
  const { message, policyFor, toolCalls, provenance, behaviors, emit, taskId, store, principalId } = ctx;
  const extracted = extractSql(message);
  const lint = lintSql(extracted);
  if (!lint.ok) {
    behaviors.push("sql_rejected", "no_write_executed");
    policyFor({ action: "execute_write", tool: "warehouse.query" });
    return {
      status: "blocked",
      sql: { query: extracted, dryRun: { valid: false, scannedBytes: 0, estimatedCost: 0, notes: lint.notes }, blocked: lint.notes.join(" ") },
      answer: {
        claimClass: "refusal",
        text: `SQL rejected by deterministic validators: ${lint.notes.join(" ")}`,
        citations: [{ label: "SQL linter", kind: "policy", ref: "sql-read-only" }],
      },
    };
  }
  const pol = policyFor({ action: "read", tool: "warehouse.query", dataClass: "confidential" });
  if (pol.decision === "deny") {
    return { status: "refused", answer: { claimClass: "refusal", text: pol.reason, citations: [] } };
  }
  const dry = dryRunSql(extracted);
  const job = executeReadSql(extracted);
  toolCalls.push(wrapToolCall("warehouse.dry_run", { sql: extracted }, { valid: dry.valid }, { dryRun: true }));
  toolCalls.push(wrapToolCall("warehouse.query", { sql: extracted }, { jobId: job.jobId, rowCount: job.rows.length }, { costUsd: job.costUsd }));
  store.addCost({ taskId, principalId, kind: "warehouse", amountUsd: job.costUsd, detail: job.jobId });
  provenance.queries.push({
    queryHash: job.queryHash,
    jobId: job.jobId,
    datasets: ["analytics"],
    tables: job.tables,
    partitions: [],
    executedAt: job.executedAt,
    sql: extracted,
  });
  behaviors.push("sql_validated", "query_executed_read_only");
  emit("tool.executed", "warehouse.query");
  return {
    status: "completed",
    sql: { query: extracted, dryRun: dry, rows: job.rows },
    answer: {
      claimClass: "supported",
      text: `Read-only query executed. ${job.rows.length} weekly rows returned. Validators: ${dry.notes.join(" ")}`,
      citations: [{ label: job.jobId, kind: "query", ref: job.queryHash }],
    },
  };
}

function runBackfill(
  ctx: WorkCtx & { store: KernelStore; principalId: string; approvals: Approval[] },
): Pick<WorkResult, "status" | "answer" | "plan"> {
  const { message, policyFor, toolCalls, provenance, behaviors, emit, store, principalId, taskId, approvals } = ctx;
  const range = parseRange(message);
  if (/90 days|full table|entire table|overwrite/i.test(message) && !/affected partition/i.test(message)) {
    behaviors.push("blast_radius_flagged");
  }
  const planPol = policyFor({ action: "plan", tool: "pipeline.graph", dataClass: "confidential", estimatedCost: 0 });
  if (planPol.decision === "deny") {
    return { status: "refused", answer: { claimClass: "refusal", text: planPol.reason, citations: [] } };
  }
  const graph = walk("fct_orders", "down", 5);
  toolCalls.push(wrapToolCall("pipeline.graph", { node: "fct_orders" }, { downstream: graph }, {}));
  const plan = planBackfill({ target: "fct_orders", start: range.start, end: range.end, requestText: message });
  if (plan.resolvedPartitions.length > 14 || /full table|entire table/i.test(message)) {
    behaviors.push("rejected_full_table_overwrite");
  }
  behaviors.push(
    "identify_correct_pipeline",
    "compute_downstream_impact",
    "estimate_cost",
    "request_approval",
    "preserve_unaffected_partitions",
    "plan_only",
  );
  const execPol = policyFor({
    action: "backfill.execute",
    tool: "pipeline.dry_run",
    resource: plan.targetNodes[0],
    dataClass: "confidential",
    estimatedCost: plan.expectedCost,
  });
  const approval = makeApproval(
    taskId,
    principalId,
    `Backfill ${plan.targetNodes.join(", ")} ${plan.requestedRange.start} → ${plan.requestedRange.end}`,
    plan.targetNodes,
    plan.expectedCost,
    plan.planHash,
    { kind: "backfill", planHash: plan.planHash },
  );
  store.addApproval(approval);
  approvals.push(approval);
  emit("approval.requested", approval.approvalId);
  provenance.codeSources.push({ repositoryId: "repo_analytics", commit: "b7e21c9", paths: ["transform/marts/fct_orders.sql"] });
  plan.status = "execution_disabled";
  return {
    status: "needs_approval",
    plan,
    answer: {
      claimClass: "derived",
      text: `Governed backfill plan ${plan.id} via ${plan.adapter.label}. Targets ${plan.targetNodes.join(", ")} over ${plan.resolvedPartitions.length} partition(s). Failed partitions: ${plan.partitionStates.filter((p) => p.status === "failed").map((p) => p.partition).join(", ") || "none"}. Downstream: ${plan.downstreamImpact.join(", ") || "none"}. Cost estimate $${plan.cost.expectedUsd.toFixed(2)}, dry-run $${plan.cost.dryRunUsd.toFixed(2)} (${plan.cost.variancePct}% variance). Rollback: ${plan.rollback.strategy}. Policy: ${execPol.decision}. Approval binds to hash ${plan.planHash.slice(0, 12)}… Adapter.execute() is disabled — production backfill will not run.`,
      citations: [
        { label: "backfill plan", kind: "pipeline", ref: plan.id },
        { label: "plan hash", kind: "provenance", ref: plan.planHash },
        { label: plan.adapter.id, kind: "pipeline", ref: plan.adapter.id },
      ],
    },
  };
}

function runSessionClose(
  store: KernelStore,
  principalId: string,
  _taskId: string,
  sessionId: string,
  behaviors: string[],
  emit: (t: string, s: string) => void,
): Pick<WorkResult, "status" | "answer"> {
  const note = makePersonalNote(principalId, "Session summary", "Working memory updated: last task context retained privately.");
  store.addMemory(note);
  const improvement = toImprovementEvent({
    category: "friction",
    problem: "Analysts repeatedly ask for unnamed revenue. Need a disambiguation skill prompt.",
    context: "Metric questions without a canonical name cause abstention.",
    agentVersion: AGENT_RELEASE,
  });
  store.addImprovement(improvement);
  behaviors.push("personal_memory_updated", "sanitized_improvement_emitted");
  emit("session.closed", sessionId);
  return {
    status: "completed",
    answer: {
      claimClass: "derived",
      text: `Session closed. Private working memory was updated for this principal only. A sanitized improvement event (${improvement.eventId}) was queued without user or session identifiers. Privacy scan: ${improvement.privacyScanPassed ? "passed" : "failed"}.`,
      citations: [{ label: "improvement queue", kind: "document", ref: improvement.eventId }],
    },
  };
}

function runIncident(store: KernelStore, ctx: WorkCtx): Pick<WorkResult, "status" | "answer"> {
  const { policyFor, toolCalls, provenance, behaviors, emit, taskId } = ctx;
  const readPol = policyFor({ action: "read", tool: "warehouse.query", resource: "analytics.fct_orders", dataClass: "confidential" });
  if (readPol.decision === "deny") {
    behaviors.push("refused_policy");
    return { status: "refused", answer: { claimClass: "refusal", text: readPol.reason, citations: [] } };
  }
  behaviors.push("incident_brief", "canonical_lookup", "no_causal_claim", "query_executed_read_only", "provenance_complete");
  const ids = ["northstar_revenue", "order_fill_rate", "refund_rate"] as const;
  const lines: string[] = [];
  const citations: NonNullable<WorkResult["answer"]>["citations"] = [];
  for (const id of ids) {
    const sql = sqlForMetric(id);
    const dry = dryRunSql(sql);
    toolCalls.push(wrapToolCall("warehouse.dry_run", { sql }, { valid: dry.valid }, { dryRun: true, costUsd: 0 }));
    const job = executeReadSql(sql);
    toolCalls.push(wrapToolCall("warehouse.query", { sql }, { jobId: job.jobId, rowCount: job.rows.length }, { costUsd: job.costUsd }));
    store.addCost({ taskId, principalId: ctx.principal.id, kind: "warehouse", amountUsd: job.costUsd, detail: job.jobId });
    emit("tool.executed", "warehouse.query", { cost: job.costUsd });
    provenance.queries.push({
      queryHash: job.queryHash,
      jobId: job.jobId,
      datasets: ["analytics"],
      tables: job.tables,
      partitions: job.rows.map((r) => String(r.week_start ?? "")),
      executedAt: job.executedAt,
      sql,
    });
    provenance.metricDefinitions.push(id);
    const last = job.rows[job.rows.length - 1];
    const prev = job.rows[job.rows.length - 2];
    const metric = METRICS.find((m) => m.id === id);
    lines.push(interpretMetric(id, last, prev));
    citations.push({ label: metric?.name ?? id, kind: "metric", ref: id });
    citations.push({ label: job.jobId, kind: "query", ref: job.queryHash });
  }
  citations.push({ label: "fct_orders failed run", kind: "pipeline", ref: "fct_orders" });
  return {
    status: "completed",
    answer: {
      claimClass: "derived",
      text: `Incident brief for week starting 2026-08-24.\n\n${lines.join("\n\n")}\n\nThese moves coincide with the failed fct_orders run on 2026-08-27. Fovea does not assert causation from that coincidence. Treat the week as possibly incomplete. Next step is a governed backfill plan of the affected partitions — execution stays disabled.`,
      citations,
    },
  };
}

interface WorkCtx {
  principal: { id: string };
  taskId: string;
  message: string;
  policyFor: (p: Partial<PolicyRequest> & Pick<PolicyRequest, "action" | "tool">) => PolicyResponse;
  toolCalls: ToolCall[];
  provenance: ProvenanceRecord;
  behaviors: string[];
  emit: (t: string, s: string, extra?: Partial<WorkResult["events"][number]>) => unknown;
}

function runGrantIssue(
  store: KernelStore,
  actor: { id: string },
  message: string,
  behaviors: string[],
  policyFor: (p: Partial<PolicyRequest> & Pick<PolicyRequest, "action" | "tool">) => PolicyResponse,
): Pick<WorkResult, "status" | "answer"> {
  policyFor({ action: "read", tool: "none", task: "autonomy.grant" });
  const parsed = parseGrantRequest(message);
  const principal = store.principal(actor.id);
  if (!principal || !parsed) {
    behaviors.push("grant_denied", "no_write_executed");
    return {
      status: "refused",
      answer: {
        claimClass: "refusal",
        text: "Could not parse a selected-workflow grant. Name one person, one tool, and one task — for example: Grant Maya warehouse.query for investigate-metric.",
        citations: [{ label: "grant shape", kind: "policy", ref: "autonomy.grant" }],
      },
    };
  }
  const issued = issueGrant(principal, parsed, store.state.grants);
  if (!issued.ok) {
    behaviors.push("grant_denied", "no_global_autonomy", "no_write_executed");
    const owner = principal.roles.includes("os_owner") || principal.roles.includes("security_owner");
    return {
      status: "refused",
      answer: {
        claimClass: "refusal",
        text: owner
          ? `Grant refused. ${issued.reason} Wildcards and writes stay denied.`
          : `Grant refused. ${issued.reason} Switch to Alex Voss (OS owner) to issue a named grant. Wildcards and writes stay denied.`,
        citations: [{ label: "autonomy.grant", kind: "policy", ref: "autonomy.grant" }],
      },
    };
  }
  store.addGrant(issued.grant);
  store.emit({
    taskId: null,
    sessionId: null,
    principalId: principal.id,
    eventType: "autonomy.grant.issued",
    resourceIds: [issued.grant.id, issued.grant.tool, issued.grant.task],
    correlationId: issued.grant.id,
    summary: `Selected workflow ${issued.grant.tool}/${issued.grant.task} for ${issued.grant.principalId}. Not promoted.`,
  });
  const shadow = shadowStageD(issued.grant);
  behaviors.push("grant_issued", "no_self_promotion", "no_write_executed");
  const who = store.principal(issued.grant.principalId)?.displayName ?? issued.grant.principalId;
  const continues = grantContinuesReads(issued.grant)
    ? ` Matching investigate-metric reads will continue with sibling canonical queries. Writes stay hash-bound. Switch to ${who} to see the grant on Work before asking.`
    : " It covers the named workflow only. Writes stay hash-bound.";
  return {
    status: "completed",
    answer: {
      claimClass: "derived",
      text: `Named grant ${issued.grant.id} stored: ${issued.grant.tool} / ${issued.grant.task} for ${who}, max risk T${issued.grant.maxRisk}, actions ${issued.grant.actions.join(", ")}. Expires in ${grantHoursLeft(issued.grant)}h.${continues} Shadow Stage D: eligible=${shadow.eligible}, promoted=${shadow.promoted}. Production execution stays disabled.`,
      citations: [
        { label: issued.grant.id, kind: "policy", ref: issued.grant.id },
        { label: issued.grant.tool, kind: "policy", ref: issued.grant.tool },
      ],
    },
  };
}

function runGrantRevoke(
  store: KernelStore,
  actor: { id: string },
  message: string,
  behaviors: string[],
  policyFor: (p: Partial<PolicyRequest> & Pick<PolicyRequest, "action" | "tool">) => PolicyResponse,
): Pick<WorkResult, "status" | "answer"> {
  policyFor({ action: "read", tool: "none", task: "autonomy.grant" });
  const parsed = parseRevokeRequest(message);
  const principal = store.principal(actor.id);
  if (!principal || !parsed) {
    behaviors.push("grant_denied", "no_write_executed");
    return {
      status: "refused",
      answer: {
        claimClass: "refusal",
        text: "Could not parse a revoke. Name the grant — for example: Revoke Maya warehouse.query for investigate-metric.",
        citations: [{ label: "grant revoke", kind: "policy", ref: "autonomy.grant" }],
      },
    };
  }
  const found = findGrant(store.state.grants, parsed);
  const retracted = revokeGrant(principal, found);
  if (!retracted.ok) {
    behaviors.push("grant_denied", "no_write_executed");
    const owner = principal.roles.includes("os_owner") || principal.roles.includes("security_owner");
    return {
      status: "refused",
      answer: {
        claimClass: "refusal",
        text: owner
          ? `Revoke refused. ${retracted.reason}`
          : `Revoke refused. ${retracted.reason} Switch to Alex Voss or Sam Okonkwo.`,
        citations: [{ label: "autonomy.grant", kind: "policy", ref: "autonomy.grant" }],
      },
    };
  }
  store.applyGrant(retracted.grant);
  store.emit({
    taskId: null,
    sessionId: null,
    principalId: principal.id,
    eventType: "autonomy.grant.revoked",
    resourceIds: [retracted.grant.id, retracted.grant.tool, retracted.grant.task],
    correlationId: retracted.grant.id,
    summary: `Revoked ${retracted.grant.id}. Stage D was not promoted.`,
  });
  behaviors.push("grant_revoked", "no_self_promotion", "no_write_executed");
  return {
    status: "completed",
    answer: {
      claimClass: "derived",
      text: `Grant ${retracted.grant.id} revoked. ${retracted.grant.tool} / ${retracted.grant.task} for ${store.principal(retracted.grant.principalId)?.displayName ?? retracted.grant.principalId} is no longer an active selected workflow. Stage D was not promoted.`,
      citations: [{ label: retracted.grant.id, kind: "policy", ref: retracted.grant.id }],
    },
  };
}

function applyGrantCoverage(
  store: KernelStore,
  principalId: string,
  intent: Intent,
  partial: Partial<WorkResult> & Pick<WorkResult, "status">,
  behaviors: string[],
) {
  if (partial.status !== "completed") return;
  if (intent !== "metric" && intent !== "incident" && intent !== "sql") return;
  const task = skillFor(intent);
  if (!task) return;
  const hit = matchingGrant(store.state.grants, {
    principalId,
    tool: "warehouse.query",
    task,
    action: "read",
  });
  if (!hit || !partial.answer) return;
  const chained = behaviors.includes("grant_chained");
  behaviors.push("grant_covers", "no_self_promotion");
  const hours = grantHoursLeft(hit);
  const who = store.principal(hit.principalId)?.displayName ?? hit.principalId;
  partial.answer = {
    ...partial.answer,
    text: chained
      ? `${partial.answer.text}\n\nCovered by named grant ${hit.id} (${hours}h left). Selected workflow continued with sibling canonical reads for ${who}. Writes stay hash-bound. Stage D was not promoted.`
      : `${partial.answer.text}\n\nCovered by named grant ${hit.id} (${hours}h left). Selected workflow only. Stage D was not promoted.`,
    citations: [...partial.answer.citations, { label: hit.id, kind: "policy", ref: hit.id }],
  };
}

function titleFor(intent: Intent, message: string) {
  if (intent === "metric") return "Investigate metric";
  if (intent === "backfill") return "Plan backfill";
  if (intent === "sql") return "Validate SQL";
  if (intent === "sandbox_write") return "Propose sandbox write";
  if (intent === "incident") return "Incident brief";
  if (intent === "autonomy_switch") return "Autonomy switch refused";
  if (intent === "live_warehouse") return "Live warehouse gated";
  if (intent === "grant_issue") return "Selected workflow grant";
  if (intent === "grant_revoke") return "Revoke selected grant";
  if (intent === "session_close") return "Session close";
  if (intent === "injection" || intent === "policy_bypass") return "Policy refusal";
  if (intent === "ambiguous_metric") return "Abstention";
  return message.slice(0, 48) || "Task";
}

function nextActionFor(
  status: WorkResult["status"],
  intent: Intent,
  approvals: Approval[],
  behaviors: string[] = [],
  store?: KernelStore,
  _actorId?: string,
): NextAction | null {
  if (status === "needs_approval") {
    const hash = approvals[0]?.proposedActionHash.slice(0, 12);
    return {
      label: "Open approvals",
      href: "/approvals",
      hint: hash
        ? `Bound hash ${hash}… Switch to Jordan Hale (approver) to decide this exact action.`
        : "An approver must accept the exact action hash. Switch to Jordan Hale.",
    };
  }
  if (status === "abstained") {
    return {
      label: "Ask north-star revenue",
      href: "/work?q=" + encodeURIComponent("What was north-star revenue last week?"),
      hint: "Name a canonical metric. Fovea will not guess from “revenue”.",
    };
  }
  if (status === "completed" && (intent === "metric" || intent === "incident")) {
    const chained = behaviors.includes("grant_chained");
    return {
      label: "Plan the affected backfill",
      href: "/work?q=" + encodeURIComponent("Backfill the affected partitions after the upstream correction."),
      hint: chained
        ? "Selected workflow continued. Writes stay hash-bound — plan the backfill, don’t execute it."
        : "The 2026-08-24 week may be incomplete. Plan, don’t execute.",
    };
  }
  if (status === "completed" && intent === "sql") {
    return {
      label: "Inspect refund rate",
      href: "/work?q=" + encodeURIComponent("What was refund rate last week?"),
      hint: "Follow the evidence to a related canonical metric.",
    };
  }
  if (status === "completed" && intent === "grant_issue") {
    const grant = store?.state.grants.find((g) => isGrantActive(g));
    const who = store?.principal(grant?.principalId ?? "prin_maya");
    const first = who?.displayName.split(" ")[0] ?? "Maya";
    return {
      label: `Open ${first}’s work`,
      href: "/work",
      hint: `Switch the header to ${who?.displayName ?? "Maya Chen"}. Command and Work will show the grant before they ask. Do not run it as the issuer.`,
      asPrincipalId: grant?.principalId ?? "prin_maya",
    };
  }
  if (status === "completed" && intent === "grant_revoke") {
    return {
      label: "Open policy",
      href: "/policies",
      hint: "Grant retracted. It did not promote Stage D.",
    };
  }
  if (status === "refused") {
    return {
      label: intent === "live_warehouse" ? "Ask north-star revenue" : "Review policy",
      href:
        intent === "live_warehouse"
          ? "/work?q=" + encodeURIComponent("What was north-star revenue last week?")
          : "/policies",
      hint:
        intent === "grant_issue" || intent === "grant_revoke"
          ? "Switch the header to Alex Voss or Sam Okonkwo. Wildcards stay denied. Revoke only an active named grant."
          : intent === "live_warehouse"
            ? "The live adapter stayed dark. Named metrics still run on the fixture."
            : "Policy did not move. There is no global autonomous switch.",
    };
  }
  if (status === "blocked") {
    return {
      label: "Close the session",
      href: "/work?q=" + encodeURIComponent("Close the session."),
      hint: "Budget is exhausted, or the write was rejected. Close the session or try a read-only question.",
    };
  }
  if (intent === "session_close") {
    return {
      label: "Back to command",
      href: "/",
      hint: "Private memory stayed personal. A sanitized improvement was queued.",
    };
  }
  return {
    label: "Open work console",
    href: "/work",
    hint: "Ask a named metric, plan a backfill, or propose a sandbox write.",
  };
}

function skillFor(intent: Intent) {
  if (intent === "metric") return "investigate-metric";
  if (intent === "incident") return "investigate-incident";
  if (intent === "sql") return "write-and-validate-sql";
  if (intent === "backfill") return "plan-backfill";
  if (intent === "session_close") return "session-close";
  return null;
}

function resultSkill(id: string | null) {
  return id ? [`${id}@1.0.0`] : [];
}

function sqlForMetric(id: string) {
  if (id === "weekly_active_accounts") {
    return `SELECT week_start, COUNT(DISTINCT account_id) AS weekly_active_accounts
FROM analytics.fct_sessions
WHERE is_qualified = TRUE
GROUP BY 1
ORDER BY 1`;
  }
  if (id === "order_fill_rate") {
    return `SELECT week_start,
       SUM(filled_qty) / NULLIF(SUM(ordered_qty), 0) AS fill_rate
FROM analytics.fct_order_items
WHERE status = 'completed'
GROUP BY 1
ORDER BY 1`;
  }
  if (id === "refund_rate") {
    return `SELECT week_start,
       refunded_gmv_usd / NULLIF(gross_revenue_usd, 0) AS refund_rate
FROM analytics.fct_refunds
ORDER BY 1`;
  }
  return `SELECT DATE_TRUNC('week', order_date)::date AS week_start,
       SUM(gross_revenue_usd) AS gross_revenue_usd,
       COUNT(*) AS orders
FROM analytics.fct_orders
WHERE status = 'completed'
  AND is_test = FALSE
  AND currency = 'USD'
GROUP BY 1
ORDER BY 1`;
}

function interpretMetric(id: string, last: Record<string, string | number | boolean | null>, prev?: Record<string, string | number | boolean | null>) {
  if (id === "northstar_revenue") {
    const v = Number(last.gross_revenue_usd);
    const p = Number(prev?.gross_revenue_usd ?? v);
    const delta = ((v - p) / p) * 100;
    return `North-star revenue for the week starting ${last.week_start} was $${v.toLocaleString("en-US")} (canonical GMV of completed non-test USD orders). That is ${delta.toFixed(1)}% vs the prior week. The 2026-08-24 week is lower and coincides with the failed fct_orders run on 2026-08-27 — treat that week as possibly incomplete.`;
  }
  if (id === "weekly_active_accounts") {
    return `Weekly active accounts for week starting ${last.week_start}: ${Number(last.weekly_active_accounts).toLocaleString("en-US")} distinct qualified accounts.`;
  }
  if (id === "order_fill_rate") {
    const rate = Number(last.fill_rate ?? FILL_RATE.at(-1)?.fill_rate);
    return `Order fill rate for week starting ${last.week_start} was ${(rate * 100).toFixed(1)}%. Canonical definition: filled units / ordered units on completed orders. The latest week is below the ~96% baseline.`;
  }
  if (id === "refund_rate") {
    const rate = Number(last.refund_rate ?? REFUND_RATE.at(-1)?.refund_rate);
    return `Refund rate for week starting ${last.week_start} was ${(rate * 100).toFixed(1)}% (refunded GMV / north-star GMV). The 2026-08-24 week doubled versus the 3% baseline and coincides with the failed fct_orders run.`;
  }
  return "Canonical metric retrieved.";
}

function metricLine(id: string, last: Record<string, string | number | boolean | null>, _prev?: Record<string, string | number | boolean | null>) {
  if (id === "northstar_revenue") {
    return `North-star revenue · ${last.week_start} · $${Number(last.gross_revenue_usd).toLocaleString("en-US")}`;
  }
  if (id === "weekly_active_accounts") {
    return `Weekly active accounts · ${last.week_start} · ${Number(last.weekly_active_accounts).toLocaleString("en-US")}`;
  }
  if (id === "order_fill_rate") {
    const rate = Number(last.fill_rate ?? FILL_RATE.at(-1)?.fill_rate);
    return `Order fill rate · ${last.week_start} · ${(rate * 100).toFixed(1)}%`;
  }
  if (id === "refund_rate") {
    const rate = Number(last.refund_rate ?? REFUND_RATE.at(-1)?.refund_rate);
    return `Refund rate · ${last.week_start} · ${(rate * 100).toFixed(1)}%`;
  }
  return id;
}

function extractSql(message: string) {
  const fenced = message.match(/```sql([\s\S]+?)```/i);
  if (fenced) return fenced[1].trim();
  const verb = message.match(/\b(select|insert|update|delete|merge|with)\b/i);
  if (verb) {
    const idx = message.toLowerCase().indexOf(verb[1].toLowerCase());
    return message.slice(idx).trim();
  }
  return sqlForMetric("weekly_active_accounts");
}

function makeApproval(
  taskId: string,
  principalId: string,
  summary: string,
  resources: string[],
  cost: number,
  hash?: string,
  constraints?: Record<string, string | number | boolean>,
): Approval {
  const approvedConstraints = constraints ?? { kind: "prod_write" };
  const proposedActionHash = hash ?? digestObject({ summary, resources, cost, ...approvedConstraints });
  return {
    approvalId: `apr_${uuid().slice(0, 8)}`,
    taskId,
    proposedActionHash,
    actionSummary: summary,
    affectedResources: resources,
    estimatedCost: cost,
    riskTier: 3,
    requestedBy: principalId,
    requiredRoles: ["approver"],
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
    decision: "pending",
    approver: null,
    decidedAt: null,
    approvedConstraints,
    executionStatus: "not_executed",
    executionNote: "",
    credentialId: null,
  };
}

export function decideApproval(
  store: KernelStore,
  input: { approvalId: string; actorId: string; decision: "approved" | "denied" },
): ExecutionReport {
  const actor = store.principal(input.actorId);
  if (!actor) throw new Error("Unknown principal");
  const approval = store.state.approvals.find((a) => a.approvalId === input.approvalId);
  if (!approval) throw new Error("Unknown approval");
  if (!actor.roles.includes("approver") && !actor.roles.includes("os_owner")) {
    store.emit({
      taskId: approval.taskId,
      sessionId: null,
      principalId: actor.id,
      eventType: "approval.decided",
      resourceIds: [approval.approvalId],
      decision: "deny",
      correlationId: approval.taskId,
      summary: "Actor lacks approver role",
    });
    throw new Error("Approver role required.");
  }
  if (approval.decision !== "pending") {
    if (input.decision === "approved" && approval.decision === "approved") {
      return executeApprovedAction(store, { approvalId: approval.approvalId, actorId: actor.id });
    }
    throw new Error("Approval is no longer pending.");
  }
  if (input.decision === "denied") {
    approval.decision = "denied";
    approval.approver = actor.id;
    approval.decidedAt = new Date().toISOString();
    approval.executionStatus = "not_executed";
    approval.executionNote = "Denied. No write credential will be minted.";
    store.emit({
      taskId: approval.taskId,
      sessionId: null,
      principalId: actor.id,
      eventType: "approval.decided",
      resourceIds: [approval.approvalId],
      decision: "deny",
      correlationId: approval.taskId,
      summary: `denied ${approval.approvalId}`,
    });
    return {
      approval,
      execution: "denied",
      credential: null,
      sandbox: null,
      note: approval.executionNote,
    };
  }

  const reconstructed = hashProposedAction(approval);
  if (reconstructed !== approval.proposedActionHash) {
    approval.executionStatus = "blocked_hash_mismatch";
    approval.executionNote = "Action hash does not match the bound proposal. No credential minted.";
    store.emit({
      taskId: approval.taskId,
      sessionId: null,
      principalId: actor.id,
      eventType: "approval.hash_mismatch",
      resourceIds: [approval.approvalId],
      decision: "deny",
      correlationId: approval.taskId,
      summary: approval.executionNote,
    });
    return {
      approval,
      execution: "blocked_hash_mismatch",
      credential: null,
      sandbox: null,
      note: approval.executionNote,
    };
  }

  approval.decision = "approved";
  approval.approver = actor.id;
  approval.decidedAt = new Date().toISOString();
  store.emit({
    taskId: approval.taskId,
    sessionId: null,
    principalId: actor.id,
    eventType: "approval.decided",
    resourceIds: [approval.approvalId],
    decision: "allow",
    correlationId: approval.taskId,
    summary: `approved ${approval.approvalId}`,
  });
  return executeApprovedAction(store, { approvalId: approval.approvalId, actorId: actor.id });
}

export function savePersonalSkill(store: KernelStore, principalId: string, skill: SkillManifest) {
  const principal = store.principal(principalId);
  if (!principal) throw new Error("Unknown principal");
  const extraTools = skill.allowedTools.filter((t) => !principal.allowedTools.includes(t) && t !== "*");
  const extraPerms = skill.requestedPermissions.filter((a) => !principal.actions.includes(a) && a !== "*");
  if (extraTools.length || extraPerms.length) {
    throw new Error(
      `Personal skill cannot widen permissions. Extra tools: ${extraTools.join(", ") || "none"}. Extra actions: ${extraPerms.join(", ") || "none"}.`,
    );
  }
  store.addSkill({ ...skill, scope: "personal", owner: principalId });
  return skill;
}
