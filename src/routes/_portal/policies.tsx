import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { bootstrapFn } from "@/lib/api";

export const Route = createFileRoute("/_portal/policies")({ component: PoliciesPage });

const BUNDLE = `policy_version: 1.2.0
autonomy:
  default_stage: B
  global_switch: false
  grants:
    shape: per_tool_per_task_per_risk
    wildcards: deny
    execute_write: deny
    self_promote: false
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

function PoliciesPage() {
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => bootstrapFn() });
  const tools = boot.data?.tools ?? [];
  const grants = boot.data?.grants ?? [];
  const warehouses = boot.data?.warehouses ?? [];
  const kms = boot.data?.kms;

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
            <Badge tone={grants.length ? "ok" : "neutral"}>{grants.length} named</Badge>
          </div>
          {grants.length === 0 ? (
            <p className="text-sm text-muted">
              None. A grant must name one principal, one tool, one task, and a risk ceiling. Alex can issue one; Maya
              cannot. Wildcards and writes are denied. A grant never promotes itself.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {grants.map((g) => (
                <li key={g.id} className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3 font-mono text-xs">
                  {g.principalId} · {g.tool} · {g.task} · max T{g.maxRisk}
                </li>
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

function Fact({ k, v, d }: { k: string; v: string; d: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-subtle">{k}</div>
      <div className="mt-2 font-display text-3xl tracking-tight">{v}</div>
      <p className="mt-1 text-xs text-muted">{d}</p>
    </div>
  );
}
