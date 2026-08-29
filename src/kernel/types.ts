export type AutonomyStage = "B" | "C" | "D";
export type Environment = "dev" | "staging" | "prod" | "demo";
export type ClientType = "web" | "cli" | "desktop" | "ide" | "notebook" | "other";
export type AuthStrength = "standard" | "step_up";
export type DeviceTrust = "managed" | "unmanaged" | "unknown";
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type DataClass = "public" | "internal" | "confidential" | "restricted";
export type RiskTier = 1 | 2 | 3 | 4;
export type Decision = "allow" | "deny" | "require_approval";
export type ClaimClass =
  | "supported"
  | "derived"
  | "inferred"
  | "unsupported"
  | "abstention"
  | "refusal";
export type MemoryScope = "personal" | "team" | "org";
export type SkillScope = "personal" | "team" | "enterprise";
export type ContentOrigin =
  | "signed_policy"
  | "control_plane"
  | "user"
  | "tool_output"
  | "model_output"
  | "document"
  | "ticket"
  | "repository"
  | "memory"
  | "untrusted";

export type Role =
  | "analyst"
  | "approver"
  | "security_owner"
  | "os_owner"
  | "auditor"
  | "team_maintainer"
  | "platform_owner"
  | "eval_owner";

export interface Principal {
  id: string;
  displayName: string;
  title: string;
  teamId: string;
  teamName: string;
  roles: Role[];
  autonomyStage: AutonomyStage;
  dataClasses: DataClass[];
  allowedTools: string[];
  actions: string[];
}

export interface Session {
  sessionId: string;
  humanPrincipalId: string;
  teamId: string;
  clientType: ClientType;
  authStrength: AuthStrength;
  issuedAt: string;
  expiresAt: string;
  deviceTrust: DeviceTrust;
  requestedAutonomyStage: AutonomyStage;
  environment: Environment;
  costBudgetUsd: number;
  spentUsd: number;
}

export interface PermissionSet {
  actions: string[];
  tools: string[];
  dataClasses: DataClass[];
  resources: string[];
}

/** Named Stage D workflow. Never tool=*, never a global autonomy switch. */
export interface AutonomyGrant {
  id: string;
  principalId: string;
  tool: string;
  task: string;
  actions: string[];
  maxRisk: RiskTier;
  environment: Environment;
  issuedBy: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

export interface PolicyRequest {
  principalId: string;
  agent: string;
  task: string;
  tool: string;
  action: string;
  resource: string;
  dataClass: DataClass;
  estimatedCost: number;
  autonomyStage: AutonomyStage;
  environment: Environment;
  origin?: ContentOrigin;
}

export interface PolicyResponse {
  decision: Decision;
  reason: string;
  policyVersion: string;
  approvalPolicy?: string;
  maxTtlSeconds?: number;
  constraints?: Record<string, string | number | boolean>;
  effective: PermissionSet;
  layers: { name: string; set: PermissionSet }[];
}

export interface ToolRecord {
  id: string;
  owner: string;
  riskTier: RiskTier;
  capabilities: Array<"read" | "write" | "execute">;
  dataClasses: DataClass[];
  authMode: "user_delegation" | "workload";
  networkZone: string;
  maxCallDurationSeconds: number;
  defaultRateLimit: string;
  supportsDryRun: boolean;
  supportsIdempotency: boolean;
  outputTrust: "untrusted_data";
  promptInjectionRisk: "low" | "medium" | "high";
  auditRequired: boolean;
  status: "approved" | "disabled";
  description: string;
}

export interface ToolCall {
  callId: string;
  toolId: string;
  input: Record<string, string | number | boolean | null>;
  output: JsonValue;
  origin: ContentOrigin;
  authorized: boolean;
  decision: Decision;
  durationMs: number;
  costUsd: number;
  dryRun: boolean;
}

export interface ModelRecord {
  alias: string;
  providerClass: string;
  endpointClass: string;
  approvedRegions: string[];
  allowedDataClasses: DataClass[];
  maxContext: number;
  toolSupport: boolean;
  structuredOutput: boolean;
  costPer1kUsd: number;
  evalScores: Record<string, number>;
  status: "approved" | "shadow" | "disabled";
}

export interface WriteCredential {
  credentialId: string;
  approvalId: string;
  actionHash: string;
  mintedForPrincipalId: string;
  mintedBy: string;
  scope: "sandbox";
  allowedResources: string[];
  idempotencyKey: string;
  expiresAt: string;
  mintedAt: string;
  consumedAt: string | null;
  status: "minted" | "consumed" | "expired" | "revoked";
}

export interface Approval {
  approvalId: string;
  taskId: string;
  proposedActionHash: string;
  actionSummary: string;
  affectedResources: string[];
  estimatedCost: number;
  riskTier: RiskTier;
  requestedBy: string;
  requiredRoles: Role[];
  expiresAt: string;
  decision: "pending" | "approved" | "denied" | "expired";
  approver: string | null;
  decidedAt: string | null;
  approvedConstraints: Record<string, string | number | boolean>;
  executionStatus:
    | "not_executed"
    | "sandbox_executed"
    | "sandbox_replayed"
    | "disabled_prod"
    | "blocked_hash_mismatch"
    | "blocked_kill"
    | "blocked_expired"
    | "blocked";
  executionNote: string;
  credentialId: string | null;
}

export interface MemoryItem {
  id: string;
  scope: MemoryScope;
  ownerPrincipalId: string | null;
  teamId: string | null;
  path: string;
  title: string;
  body: string;
  origin: ContentOrigin;
  createdAt: string;
  updatedAt: string;
  encrypted: boolean;
}

export interface MetricDefinition {
  id: string;
  name: string;
  status: "canonical" | "draft" | "deprecated" | "ambiguous";
  owner: string;
  description: string;
  formula: string;
  grains: string[];
  filters: string[];
  sourceTable: string;
  dataClass: DataClass;
}

export interface PipelineNode {
  nodeId: string;
  nodeType:
    | "transformation"
    | "scheduled_query"
    | "workflow_task"
    | "notebook"
    | "python_job"
    | "external";
  name: string;
  codeLocation?: string;
  owner?: string;
  schedule?: string;
  upstream: string[];
  downstream: string[];
  inputResources: string[];
  outputResources: string[];
  partitioning?: Record<string, string>;
  incrementalStrategy?: string;
  runtimeSystem: string;
  dataClass: DataClass;
  sla?: string;
  costProfile?: string;
  lastStatus?: "success" | "failed" | "running" | "stale";
  lastRunAt?: string;
}

export interface PartitionState {
  nodeId: string;
  partition: string;
  status: "current" | "stale" | "failed" | "missing";
  lastSuccessAt: string | null;
  rows: number;
}

export interface RollbackPlan {
  strategy: "time_travel_partition" | "swap_table";
  snapshots: string[];
  haltDownstream: boolean;
}

export interface AdapterRef {
  id: "transform.dbt" | "warehouse.scheduled_query";
  label: string;
  runtime: string;
}

export interface BackfillPlan {
  id: string;
  targetNodes: string[];
  requestedRange: { start: string; end: string };
  resolvedPartitions: string[];
  upstreamRequirements: string[];
  downstreamImpact: string[];
  dependencyOrder: string[];
  overwriteBehavior: "append" | "replace_partition" | "merge" | "other";
  idempotencyStrategy: string;
  expectedRows?: number;
  expectedCost: number;
  expectedDurationMinutes?: number;
  dataQualityChecks: string[];
  businessInvariants: string[];
  rollbackStrategy: string;
  rollback: RollbackPlan;
  monitoringChecks: string[];
  riskTier: RiskTier;
  approvalRequired: boolean;
  planHash: string;
  status: "planned" | "approved" | "blocked" | "execution_disabled";
  adapter: AdapterRef;
  partitionStates: PartitionState[];
  cost: { expectedUsd: number; dryRunUsd: number; variancePct: number };
}

export interface ProvenanceRecord {
  resultId: string;
  taskId: string;
  principalId: string;
  agentRelease: string;
  policyRelease: string;
  skillVersions: string[];
  modelCalls: Array<{
    modelAlias: string;
    modelVersion: string;
    purpose: string;
  }>;
  queries: Array<{
    queryHash: string;
    jobId: string;
    datasets: string[];
    tables: string[];
    partitions: string[];
    executedAt: string;
    sql?: string;
  }>;
  codeSources: Array<{ repositoryId: string; commit: string; paths: string[] }>;
  metricDefinitions: string[];
  toolCalls: string[];
  approvals: string[];
  outputHash: string;
  createdAt: string;
}

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  taskId: string | null;
  sessionId: string | null;
  principalId: string;
  eventType: string;
  agentVersion: string;
  policyVersion: string;
  resourceIds: string[];
  decision?: Decision | string;
  riskTier?: RiskTier;
  cost?: number;
  payloadHash?: string;
  correlationId: string;
  summary: string;
}

export interface CostRecord {
  id: string;
  taskId: string | null;
  principalId: string;
  kind: "model" | "warehouse" | "compute" | "tool";
  amountUsd: number;
  detail: string;
  at: string;
}

export interface SkillManifest {
  id: string;
  version: string;
  scope: SkillScope;
  owner: string;
  description: string;
  allowedTools: string[];
  requestedPermissions: string[];
  dataClasses: DataClass[];
  instructions: string;
}

export interface ImprovementEvent {
  eventId: string;
  category:
    | "skill_gap"
    | "tool_gap"
    | "failure"
    | "friction"
    | "policy_gap"
    | "cost"
    | "latency"
    | "other";
  generalizedProblem: string;
  generalizedContext: string;
  frequencyHint: number;
  proposedSolution?: string;
  agentVersion: string;
  toolVersions: string[];
  privacyScanPassed: boolean;
  sourceUser: null;
  sourceSession: null;
}

export interface KillSwitchState {
  taskIds: string[];
  skills: string[];
  sessions: string[];
  tools: string[];
  writePlane: boolean;
  models: string[];
  teamStages: Record<string, AutonomyStage>;
  release: boolean;
  entireOs: boolean;
}

export interface ReleaseArtifact {
  version: string;
  sourceCommit: string;
  treeHash: string;
  buildId: string;
  builtAt: string;
  policyHash: string;
  evalSuiteHash: string;
  artifactDigest: string;
  signature: string;
  signer: string;
  keyId: string;
  algorithm: "Ed25519";
  revoked: boolean;
}

export interface EvalAssertion {
  name: string;
  passed: boolean;
  detail: string;
}

export interface EvalCaseResult {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium";
  passed: boolean;
  assertions: EvalAssertion[];
  behaviors: string[];
  durationMs: number;
}

export interface EvalReport {
  releaseCandidate: string;
  baseline: string;
  ranAt: string;
  hardGates: Record<string, number>;
  hardGatesPassed: boolean;
  quality: Record<string, number>;
  operational: Record<string, number>;
  cases: EvalCaseResult[];
  recommendation: "eligible_for_review" | "blocked";
}

export interface Citation {
  label: string;
  kind: "query" | "metric" | "policy" | "pipeline" | "document" | "provenance";
  ref: string;
}

export interface WorkAnswer {
  text: string;
  claimClass: ClaimClass;
  citations: Citation[];
}

export interface EvidencePack {
  resultId: string;
  claimClass: ClaimClass;
  claim: string;
  citations: Citation[];
  queryHashes: string[];
  queries?: Array<{ jobId: string; queryHash: string; tables: string[]; metric?: string; sql?: string }>;
  metrics: string[];
  policyDecisions: Decision[];
  agentRelease: string;
  outputHash: string;
  exportedAt: string;
}

export interface NextAction {
  label: string;
  href: string;
  hint: string;
  asPrincipalId?: string;
}

export interface WorkResult {
  taskId: string;
  sessionId: string;
  principalId: string;
  title: string;
  userRequest: string;
  status:
    | "completed"
    | "blocked"
    | "needs_approval"
    | "abstained"
    | "refused"
    | "failed";
  skillId: string | null;
  answer?: WorkAnswer;
  plan?: BackfillPlan;
  sql?: {
    query: string;
    dryRun: { valid: boolean; scannedBytes: number; estimatedCost: number; notes: string[] };
    rows?: Array<Record<string, string | number | boolean | null>>;
    blocked?: string;
  };
  events: AuditEvent[];
  provenance: ProvenanceRecord | null;
  policy: PolicyResponse[];
  cost: { totalUsd: number; items: CostRecord[] };
  behaviors: string[];
  approvals: Approval[];
  toolCalls: ToolCall[];
  nextAction: NextAction | null;
  evidencePack: EvidencePack | null;
  createdAt: string;
  finishedAt: string;
}

export interface QueryJob {
  jobId: string;
  sql: string;
  queryHash: string;
  tables: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  scannedBytes: number;
  costUsd: number;
  executedAt: string;
  dryRun: boolean;
}

export interface CoveringGrant {
  id: string;
  tool: string;
  task: string;
  actions: string[];
  expiresAt: string;
  continuesReads: boolean;
}

export interface ActiveGrantView {
  id: string;
  principalId: string;
  principalName: string;
  tool: string;
  task: string;
  continuesReads: boolean;
  expiresAt: string;
}

export interface DeskHandoff {
  id: string;
  fromPrincipalId: string;
  toPrincipalId: string;
  kind: "work" | "approval" | "policy";
  label: string;
  href: string;
  hint: string;
  taskId: string | null;
  createdAt: string;
  expiresAt: string;
  openedAt: string | null;
}

export interface InboxHandoffView {
  id: string;
  fromName: string;
  kind: DeskHandoff["kind"];
  label: string;
  href: string;
  hint: string;
  expiresAt: string;
}

export interface InboxApprovalView {
  approvalId: string;
  requestedByName: string;
  actionSummary: string;
  hash: string;
  estimatedCost: number;
}

export const KERNEL_VERSION = "9.0.0";
export const AGENT_RELEASE = "fovea-9.0.0";
export const POLICY_VERSION = "1.7.0";
export const AGENT_ID = "analytics-investigator@1.0.0";
