import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bootstrapFn, putGrantFn, retractGrantFn } from "@/lib/api";
import { useFoveaSession } from "@/lib/session";
import type { AutonomyGrant } from "@/kernel/types";

export const Route = createFileRoute("/_portal/policies")({ component: PoliciesPage });

const BUNDLE = `policy_version: 1.7.0
autonomy:
  default_stage: B
  global_switch: false
  grants:
    shape: per_tool_per_task_per_risk
    wildcards: deny
    execute_write: deny
    duplicate_active: deny
    revoke: os_owner_or_security
    ttl_hours: 8
    self_promote: false
    continue_selected_read: true
    chain_across_tasks: false
    desk_visible: true
    issuer_visible: true
desks:
  handoff: named
  ttl_hours: 8
  work_session: this_session
  audit_stream: role_gated
  denied_write: no_queue
  sod: approver_only
  self_approve: deny
control_plane:
  snapshot_align: kernel_wins
  pending_execute: deny
  hydrate_failure: do_not_mark
principles:
  permission_mode: intersection
  abstention_allowed: true
  provenance_required_for_material_results: true
  arbitrary_tool_installation: false
  self_modification: propose_only
writes:
  B:
    default: require_approval
    production_execution: disabled
    sandbox_after_approval: credential_broker
warehouse:
  live:
    registered: true
    default_allow: false
    os_allowlist: false
    writes: disabled
signing:
  kms: required
  skip_signature_check: false
  raw_pem: false
permanent_human_gate:
  - iam.change
  - protected_dataset.delete
  - canonical_metric.change
  - sensitive_export
  - mass_communication
  - agentic_os.security_change
  - eval_gate_weakening
  - signing_authority.change
  - autonomy.global
`;

const GRANT_TASKS = [
  "investigate-metric",
  "investigate-incident",
  "write-and-validate-sql",
  "plan-backfill",
  "session-close",
];
const GRANT_ACTIONS = ["read", "analyze", "plan"] as const;
const FIELD =
  "h-10 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-sm text-fg outline-none focus-visible:border-border-strong";

function grantState(g: AutonomyGrant): "active" | "expired" | "revoked" {
  if (g.revokedAt) return "revoked";
  if (Date.parse(g.expiresAt) <= Date.now()) return "expired";
  return "active";
}

function PoliciesPage() {
  const principalId = useFoveaSession((s) => s.principalId);
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => bootstrapFn() });
  const tools = boot.data?.tools ?? [];
  const grants = boot.data?.grants ?? [];
  const warehouses = boot.data?.warehouses ?? [];
  const kms = boot.data?.kms;
  const actor = boot.data?.principals.find((p) => p.id === principalId);
  const canIssue = Boolean(actor?.roles.includes("os_owner") || actor?.roles.includes("security_owner"));
  const names = Object.fromEntries((boot.data?.principals ?? []).map((p) => [p.id, p.displayName]));
  const active = grants.filter((g) => grantState(g) === "active").length;

  return (
    <div>
      <PageHeader
        kicker="Govern"
        title="Policy"
        description="Lower layers may specialize but never weaken higher layers. There is no global autonomous switch."
      />
      <div className="space-y-8 p-4 md:p-8">
        <div className="grid gap-4 md:grid-cols-3">
          <Fact k="Permission mode" v="Intersection" d="Never union. A grant cannot add a wildcard." />
          <Fact k="KMS runtime" v={kms?.ok ? "Verified" : "Blocked"} d={kms?.attestation?.keyId ?? "unsigned"} />
          <Fact
            k="Live warehouse"
            v={warehouses.find((w) => w.id === "live")?.connected ? "Connected" : "Gated"}
            d="Registered. Not on any Stage B principal. Writes disabled."
          />
        </div>

        <section>
          <h2 className="text-sm font-medium">Per-tool risk</h2>
          <p className="mt-1 text-xs text-muted">Risk is a policy layer, not a suggestion. Tier 4 cannot be granted.</p>
          <div className="mt-3 overflow-x-auto rounded-[var(--radius-md)] border border-border">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
                <tr>
                  <th className="px-3 py-2">Tool</th>
                  <th className="px-3 py-2">Risk</th>
                  <th className="px-3 py-2">Caps</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{t.id}</td>
                    <td className="px-3 py-2">T{t.riskTier}</td>
                    <td className="px-3 py-2 text-xs text-muted">{t.capabilities.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-sm font-medium">Selected Stage D grants</h2>
            <Badge tone={active ? "ok" : "neutral"}>{active} active</Badge>
          </div>
          {canIssue ? (
            <GrantForm
              principals={boot.data?.principals ?? []}
              tools={tools.filter((t) => t.riskTier < 4)}
              actorId={principalId}
              onIssued={() => void qc.invalidateQueries()}
            />
          ) : (
            <p className="mb-4 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 text-sm text-muted">
              Switch the header to <span className="text-fg">Alex Voss</span> (OS owner) or{" "}
              <span className="text-fg">Sam Okonkwo</span> (security) to issue or revoke a named grant. Maya cannot.
              Wildcards, writes, duplicates, and tier 4 stay denied. A grant never promotes itself. An active
              investigate-metric grant continues Maya’s next named read with sibling canonical queries.
            </p>
          )}
          {grants.length === 0 ? (
            <p className="text-sm text-muted">
              None stored. A grant must name one principal, one tool, one task, and a risk ceiling. It expires in eight
              hours unless revoked.
            </p>
          ) : (
            <ul className="space-y-2">
              {grants.map((g) => (
                <GrantCard
                  key={g.id}
                  grant={g}
                  names={names}
                  canRevoke={canIssue}
                  actorId={principalId}
                  onRevoked={() => void qc.invalidateQueries()}
                />
              ))}
            </ul>
          )}
        </section>

        <pre className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-surface p-5 font-mono text-[12px] leading-relaxed text-muted">
          {BUNDLE}
        </pre>
      </div>
    </div>
  );
}

function GrantCard({
  grant,
  names,
  canRevoke,
  actorId,
  onRevoked,
}: {
  grant: AutonomyGrant;
  names: Record<string, string>;
  canRevoke: boolean;
  actorId: string;
  onRevoked: () => void;
}) {
  const status = grantState(grant);
  const mut = useMutation({
    mutationFn: () => retractGrantFn({ data: { actorId, grantId: grant.id } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.reason);
        return;
      }
      toast.success(`Grant ${grant.id} revoked.`);
      onRevoked();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const tone = status === "active" ? "ok" : status === "expired" ? "warn" : "danger";
  return (
    <li className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-fg">
            {names[grant.principalId] ?? grant.principalId}
            <span className="text-muted"> · {grant.tool} · {grant.task}</span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-subtle">
            {grant.id} · {grant.actions.join("+")} · max T{grant.maxRisk} · issued by{" "}
            {names[grant.issuedBy] ?? grant.issuedBy}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {status === "active"
              ? `Expires ${grant.expiresAt.slice(0, 16).replace("T", " ")} UTC`
              : status === "expired"
                ? `Expired ${grant.expiresAt.slice(0, 16).replace("T", " ")} UTC`
                : `Revoked by ${names[grant.revokedBy ?? ""] ?? grant.revokedBy}`}
          </div>
          {status === "active" &&
          grant.tool === "warehouse.query" &&
          grant.task === "investigate-metric" &&
          grant.actions.includes("read") ? (
            <div className="mt-1 text-[11px] text-fg">Continues sibling canonical reads in-task. Not a global switch.</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{status}</Badge>
          {canRevoke && status === "active" ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={mut.isPending}
              onClick={() => mut.mutate()}
            >
              Revoke
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function GrantForm({
  principals,
  tools,
  actorId,
  onIssued,
}: {
  principals: { id: string; displayName: string }[];
  tools: { id: string; riskTier: number }[];
  actorId: string;
  onIssued: () => void;
}) {
  const [principalId, setPrincipalId] = useState("prin_maya");
  const [tool, setTool] = useState("warehouse.query");
  const [task, setTask] = useState("investigate-metric");
  const [actions, setActions] = useState<string[]>(["read"]);
  const [maxRisk, setMaxRisk] = useState<1 | 2 | 3>(2);
  const mut = useMutation({
    mutationFn: () =>
      putGrantFn({
        data: { actorId, principalId, tool, task, actions, maxRisk },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.reason);
        return;
      }
      toast.success(`Named grant ${res.grant.id} stored. Switch to the grantee — Command will show the handoff. Stage D was not promoted.`);
      onIssued();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (action: string) => {
    setActions((cur) => (cur.includes(action) ? cur.filter((a) => a !== action) : [...cur, action]));
  };

  return (
    <form
      className="mb-4 rounded-[var(--radius-md)] border border-border bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!actions.length) {
          toast.error("A grant must name at least one action.");
          return;
        }
        mut.mutate();
      }}
    >
      <p className="text-xs text-muted">
        Issue a named grant. One person, one tool, one task, risk at most T3, eight-hour TTL. Duplicates are denied.
        An investigate-metric grant continues Maya’s next named read with sibling queries. This does not widen policy
        and does not turn on Stage D.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-muted">
          Principal
          <select className={`mt-1 ${FIELD}`} value={principalId} onChange={(e) => setPrincipalId(e.target.value)}>
            {principals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Tool
          <select className={`mt-1 ${FIELD}`} value={tool} onChange={(e) => setTool(e.target.value)}>
            {tools.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} · T{t.riskTier}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Task
          <select className={`mt-1 ${FIELD}`} value={task} onChange={(e) => setTask(e.target.value)}>
            {GRANT_TASKS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Max risk
          <select
            className={`mt-1 ${FIELD}`}
            value={maxRisk}
            onChange={(e) => setMaxRisk(Number(e.target.value) as 1 | 2 | 3)}
          >
            <option value={1}>T1</option>
            <option value={2}>T2</option>
            <option value={3}>T3</option>
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
        {GRANT_ACTIONS.map((a) => (
          <label key={a} className="flex items-center gap-2">
            <input type="checkbox" checked={actions.includes(a)} onChange={() => toggle(a)} />
            {a}
          </label>
        ))}
      </div>
      <div className="mt-4">
        <Button type="submit" size="sm" disabled={mut.isPending || !actions.length}>
          {mut.isPending ? "Issuing…" : "Issue named grant"}
        </Button>
      </div>
    </form>
  );
}

function Fact({ k, v, d }: { k: string; v: string; d: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">{k}</div>
      <div className="mt-2 font-display text-3xl tracking-tight">{v}</div>
      <p className="mt-1 text-xs text-muted">{d}</p>
    </div>
  );
}
