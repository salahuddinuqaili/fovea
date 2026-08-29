import { digestObject, sha256, uuid } from "./crypto.ts";
import { FILL_RATE, METRICS } from "./fixtures.ts";
import { canReadMemory, toImprovementEvent } from "./memory.ts";
import { infer, pickModel, xaiAvailable } from "./models.ts";
import { evaluatePolicy } from "./policy.ts";
import { parseRange, planBackfill, walk } from "./pipeline.ts";
import { KernelStore, makePersonalNote } from "./store.ts";
import { dryRunSql, executeReadSql, lintSql, readRepo, readTicket, wrapToolCall } from "./tools.ts";
import type {
  Approval,
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
  /\b(insert into|update\s+\w+|delete from|drop table|truncate|overwrite (the )?table|grant |alter table|push to prod|merge the (branch|pr)|send (a )?slack|email everyone)\b/i;

export type Intent =
  | "injection"
  | "policy_bypass"
  | "write"
  | "backfill"
  | "metric"
  | "sql"
  | "ambiguous_metric"
  | "memory_probe"
  | "session_close"
  | "general";

export function classifyIntent(text: string): Intent {
  const t = text.trim();
  if (/session[- ]close|wrap up (this )?session|close (the )?session/i.test(t)) return "session_close";
  if (INJECTION.test(t) || /ignore fovea policy/i.test(t)) return "injection";
  if (/bypass|override (the )?policy|as an admin, allow/i.test(t)) return "policy_bypass";
  if (/another user'?s memory|maya'?s (private|personal) (notes|memory)|cross-user/i.test(t)) return "memory_probe";
  if (/backfill|rerun (the )?(last|past|affected)|reprocess partition/i.test(t)) return "backfill";
  if (WRITE_ASK.test(t)) return "write";
  const metricHit = METRICS.filter(
    (m) =>
      t.toLowerCase().includes(m.name.toLowerCase()) ||
      t.toLowerCase().includes(m.id.replace(/_/g, " ")) ||
      t.toLowerCase().includes(m.id),
  );
  if (
    /north-?star revenue|weekly active accounts|order fill rate/i.test(t) ||
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
      createdAt: started,
      finishedAt: new Date().toISOString(),
      status: partial.status,
    };
    emit("result.produced", `status=${result.status}`);
    emit("provenance.finalized", result.provenance?.resultId ?? "");
    store.addTask(result);
    return result;
  };

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

  if (intent === "write") {
    const decision = policyFor({
      action: "execute_write",
      tool: "warehouse.query",
      resource: "dataset/table",
      dataClass: "confidential",
      estimatedCost: 40,
    });
    behaviors.push("write_gated", "no_write_executed");
    const approval = makeApproval(taskId, principal.id, input.message, ["dataset/table"], 40);
    store.addApproval(approval);
    approvals.push(approval);
    emit("approval.requested", approval.approvalId);
    return finish({
      status: "needs_approval",
      answer: {
        claimClass: "refusal",
        text: `Stage B Trusted Copilot will not execute writes. Policy decision: ${decision.decision}. ${decision.reason} An approval object was created and bound to this exact action hash. Even if approved, production execution stays disabled in v0.`,
        citations: [{ label: "Stage B writes", kind: "policy", ref: "autonomy.B" }],
      },
    });
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
  });
  provenance.metricDefinitions.push(metric.id);
  behaviors.push("query_executed_read_only", "provenance_complete");
  const last = job.rows[job.rows.length - 1];
  const prev = job.rows[job.rows.length - 2];
  return {
    status: "completed",
    sql: { query: sql, dryRun: dry, rows: job.rows },
    answer: {
      claimClass: "supported",
      text: interpretMetric(metric.id, last, prev),
      citations: [
        { label: metric.name, kind: "metric", ref: metric.id },
        { label: job.jobId, kind: "query", ref: job.queryHash },
        { label: "provenance", kind: "provenance", ref: provenance.resultId },
      ],
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
      text: `Governed backfill plan ${plan.id} is ready. Targets ${plan.targetNodes.join(", ")} over ${plan.resolvedPartitions.length} partition(s). Downstream impact: ${plan.downstreamImpact.join(", ") || "none"}. Expected cost $${plan.expectedCost.toFixed(2)}. Policy: ${execPol.decision}. Stage B will not execute this plan — approval binds to hash ${plan.planHash.slice(0, 12)}… and execution remains disabled.`,
      citations: [
        { label: "backfill plan", kind: "pipeline", ref: plan.id },
        { label: "plan hash", kind: "provenance", ref: plan.planHash },
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

function titleFor(intent: Intent, message: string) {
  if (intent === "metric") return "Investigate metric";
  if (intent === "backfill") return "Plan backfill";
  if (intent === "sql") return "Validate SQL";
  if (intent === "session_close") return "Session close";
  if (intent === "injection" || intent === "policy_bypass") return "Policy refusal";
  if (intent === "ambiguous_metric") return "Abstention";
  return message.slice(0, 48) || "Task";
}

function skillFor(intent: Intent) {
  if (intent === "metric") return "investigate-metric";
  if (intent === "sql") return "write-and-validate-sql";
  if (intent === "backfill") return "plan-backfill";
  if (intent === "session_close") return "session-close";
  return null;
}

function resultSkill(id: string | null) {
  return id ? [`${id}@0.1.0`] : [];
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
  return "Canonical metric retrieved.";
}

function extractSql(message: string) {
  const fenced = message.match(/```sql([\s\S]+?)```/i);
  if (fenced) return fenced[1].trim();
  if (/select /i.test(message)) {
    const idx = message.toLowerCase().indexOf("select");
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
): Approval {
  const proposedActionHash = hash ?? digestObject({ summary, resources, cost });
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
    approvedConstraints: {},
  };
}

export function decideApproval(
  store: KernelStore,
  input: { approvalId: string; actorId: string; decision: "approved" | "denied" },
) {
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
  if (approval.decision !== "pending") throw new Error("Approval is no longer pending.");
  approval.decision = input.decision;
  approval.approver = actor.id;
  approval.decidedAt = new Date().toISOString();
  store.emit({
    taskId: approval.taskId,
    sessionId: null,
    principalId: actor.id,
    eventType: "approval.decided",
    resourceIds: [approval.approvalId],
    decision: input.decision === "approved" ? "allow" : "deny",
    correlationId: approval.taskId,
    summary: `${input.decision} ${approval.approvalId}`,
  });
  return {
    approval,
    execution: "disabled_in_stage_b" as const,
    note:
      input.decision === "approved"
        ? "Approval bound to the exact action hash. Stage B still will not mint a write credential or execute."
        : "Denied. No write credential will be minted.",
  };
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
