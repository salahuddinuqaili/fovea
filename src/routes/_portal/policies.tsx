import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_portal/policies")({ component: PoliciesPage });

const BUNDLE = `policy_version: 1.1.0
autonomy:
  default_stage: B
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
permanent_human_gate:
  - iam.change
  - protected_dataset.delete
  - canonical_metric.change
  - sensitive_export
  - mass_communication
  - agentic_os.security_change
  - eval_gate_weakening
  - signing_authority.change
backfill:
  production:
    v1: plan_only
memory:
  personal:
    cross_user_access: deny
    admin_default_access: deny
    automatic_promotion: deny
    durable_snapshot: omit
model_judging:
  critical_tasks:
    independent_judge_required: true
`;

function PoliciesPage() {
  return (
    <div>
      <PageHeader
        kicker="Govern"
        title="Policy"
        description="Lower layers may specialize but never weaken higher layers. A model cannot expand this set through reasoning."
      />
      <div className="p-4 md:p-8">
        <pre className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-surface p-5 font-mono text-[12px] leading-relaxed text-muted">
          {BUNDLE}
        </pre>
      </div>
    </div>
  );
}
