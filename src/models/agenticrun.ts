import {
  K8sModel,
  K8sResourceCommon,
  K8sResourceCondition,
  getGroupVersionKindForModel,
} from '@openshift-console/dynamic-plugin-sdk';
import { AgenticRunSpec, AgenticRunStatus } from './generated/agenticruns';
import { AgenticRunApprovalSpec, AgenticRunApprovalStatus } from './generated/agenticrunapprovals';
import { ApprovalPolicySpec } from './generated/approvalpolicies';
import { AnalysisResultSpec, AnalysisResultStatus } from './generated/analysisresults';

// --- K8s Models ---

export const LightspeedAgenticRunModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'AgenticRun',
  plural: 'agenticruns',
  abbr: 'LSAR',
  namespaced: true,
  label: 'AgenticRun',
  labelPlural: 'AgenticRuns',
};

export const AgenticRunApprovalModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'AgenticRunApproval',
  plural: 'agenticrunapprovals',
  abbr: 'PA',
  namespaced: true,
  label: 'AgenticRunApproval',
  labelPlural: 'AgenticRunApprovals',
};

export const AnalysisResultModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'AnalysisResult',
  plural: 'analysisresults',
  abbr: 'AR',
  namespaced: true,
  label: 'AnalysisResult',
  labelPlural: 'AnalysisResults',
};

export const ApprovalPolicyModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'ApprovalPolicy',
  plural: 'approvalpolicies',
  abbr: 'AP',
  namespaced: false,
  label: 'ApprovalPolicy',
  labelPlural: 'ApprovalPolicies',
};

export const LightspeedAgenticRunGVK = getGroupVersionKindForModel(LightspeedAgenticRunModel);
export const AgenticRunApprovalGVK = getGroupVersionKindForModel(AgenticRunApprovalModel);
export const AnalysisResultGVK = getGroupVersionKindForModel(AnalysisResultModel);
export const ApprovalPolicyGVK = getGroupVersionKindForModel(ApprovalPolicyModel);

// --- Resource Types (composed from generated CRD types + K8sResourceCommon) ---

export type LightspeedAgenticRun = K8sResourceCommon & {
  spec: AgenticRunSpec;
  status?: AgenticRunStatus;
};

export type LightspeedAgenticRunApproval = K8sResourceCommon & {
  spec?: AgenticRunApprovalSpec;
  status?: AgenticRunApprovalStatus;
};

export type LightspeedAnalysisResult = K8sResourceCommon & {
  spec: AnalysisResultSpec;
  status?: AnalysisResultStatus;
};

export type LightspeedApprovalPolicy = K8sResourceCommon & {
  spec: ApprovalPolicySpec;
};

// --- Phase derivation ---
// The CRD has no status.phase field. Derive it from status.conditions.

export type AgenticRunPhase =
  | 'Pending'
  | 'Analyzing'
  | 'Analysed'
  | 'Proposed'
  | 'Approved'
  | 'Denied'
  | 'Executing'
  | 'AwaitingSync'
  | 'Verifying'
  | 'Completed'
  | 'Failed'
  | 'Escalated';

export const ACTIVE_AGENTIC_RUN_PHASES = new Set<AgenticRunPhase>([
  'Analyzing',
  'Analysed',
  'Proposed',
  'Completed',
  'Escalated',
  'Failed',
]);

export const derivePhase = (agenticRun?: LightspeedAgenticRun): AgenticRunPhase => {
  const conditions = agenticRun?.status?.conditions ?? [];
  const find = (type: string) => conditions.find((c: K8sResourceCondition) => c.type === type);

  const escalated = find('Escalated');
  if (escalated?.status === 'True') return 'Escalated';

  const verified = find('Verified');
  const executed = find('Executed');
  const analyzed = find('Analyzed');

  // Analysis-only runs: execution and verification are Skipped
  const executionSkipped = executed?.reason === 'Skipped';
  const verificationSkipped = verified?.reason === 'Skipped';
  if (analyzed?.status === 'True' && executionSkipped && verificationSkipped) {
    return 'Analysed';
  }

  if (verified?.status === 'True') return 'Completed';
  if (verified?.status === 'False') return 'Verifying';

  if (executed?.status === 'True') return 'AwaitingSync';
  if (executed?.status === 'False') return 'Executing';

  const approved = find('Approved');
  if (approved?.status === 'True') return 'Approved';
  if (approved?.status === 'False') return 'Denied';

  if (analyzed?.status === 'True') return 'Proposed';
  if (analyzed?.status === 'False' && analyzed?.reason === 'Failed') return 'Failed';
  if (analyzed?.status === 'False') return 'Analyzing';

  // Check if analysis step has any results (in progress)
  if (agenticRun?.status?.steps?.analysis?.results?.length) return 'Analyzing';

  // If any condition is Unknown, the operator is still reconciling
  if (conditions.some((c: K8sResourceCondition) => c.status === 'Unknown')) return 'Pending';

  return 'Pending';
};

// --- Phase display ---

export type PhaseDisplay = {
  color: 'grey' | 'blue' | 'teal' | 'orange' | 'purple' | 'green' | 'red' | 'orangered';
  label: string;
};

export const getPhaseDisplay = (phase?: AgenticRunPhase | string): PhaseDisplay => {
  switch (phase) {
    case 'Pending':
      return { color: 'grey', label: 'Pending' };
    case 'Analyzing':
      return { color: 'blue', label: 'Analyzing' };
    case 'Analysed':
      return { color: 'teal', label: 'Analysed' };
    case 'Proposed':
      return { color: 'teal', label: 'Proposed' };
    case 'Approved':
      return { color: 'blue', label: 'Approved' };
    case 'Executing':
      return { color: 'purple', label: 'Executing' };
    case 'Verifying':
      return { color: 'blue', label: 'Verifying' };
    case 'Completed':
      return { color: 'green', label: 'Completed' };
    case 'Failed':
      return { color: 'red', label: 'Failed' };
    case 'Denied':
      return { color: 'red', label: 'Denied' };
    case 'AwaitingSync':
      return { color: 'teal', label: 'Awaiting Sync' };
    case 'Escalated':
      return { color: 'orangered', label: 'Escalated' };
    default:
      return { color: 'grey', label: phase || 'Unknown' };
  }
};

export const getRiskColor = (risk?: string): 'green' | 'orange' | 'red' | 'grey' => {
  switch (risk) {
    case 'low':
      return 'green';
    case 'medium':
      return 'orange';
    case 'high':
    case 'critical':
      return 'red';
    default:
      return 'grey';
  }
};

// --- Adapter components (from CVO outputSchema in AnalysisResult) ---

export type AdapterComponent = {
  type: string;
  [key: string]: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnalysisDataPayload = Record<string, any>;

export type AnalysisData = {
  components: AdapterComponent[];
  analysisData?: AnalysisDataPayload;
};

export const getAnalysisDataFromResult = (result?: LightspeedAnalysisResult): AnalysisData => {
  if (!result?.status?.options?.length) {
    return { components: [] };
  }
  const option = result.status.options[0];
  const raw = (option.components as AnalysisDataPayload)?.analysisData;

  // analysisData can be an array of typed components (PR 1379 format)
  // or a flat object (legacy format)
  if (Array.isArray(raw)) {
    return {
      components: raw as AdapterComponent[],
    };
  }

  // Legacy flat object — wrap in components for backward compat
  return {
    components: [],
    analysisData: raw as AnalysisDataPayload | undefined,
  };
};

export const ACTION_TYPES = {
  prerequisite: 'prerequisite',
  upgrade: 'upgrade',
  monitor: 'monitor',
} as const;

export const FINDING_CHECKS = {
  clusterConditions: 'cluster_conditions',
  operatorHealth: 'operator_health',
  apiDeprecations: 'api_deprecations',
  olmOperatorLifecycle: 'olm_operator_lifecycle',
} as const;

export const SEVERITY_COLORS: Record<string, 'red' | 'orange' | 'blue'> = {
  blocker: 'red',
  warning: 'orange',
  info: 'blue',
};

export const SEVERITY_LABELS: Record<string, string> = {
  blocker: 'Blocker',
  warning: 'Warning',
  info: 'Info',
};

export const COMPONENT_TYPES = {
  readinessSummary: 'ota_readiness_summary',
  finding: 'ota_finding',
  olmOperatorStatus: 'ota_olm_operator_status',
} as const;

export type ReadinessCheck = {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'error';
  detail?: string;
};

export type OtaReadinessSummary = AdapterComponent & {
  type: typeof COMPONENT_TYPES.readinessSummary;
  decision: 'recommend' | 'caution' | 'block' | 'escalate';
  checks: ReadinessCheck[];
};

export type OtaFinding = AdapterComponent & {
  type: typeof COMPONENT_TYPES.finding;
  severity: 'blocker' | 'warning' | 'info';
  check: string;
  detail: string;
  affectedResources?: string[];
  prerequisite?: string;
  verifyCommand?: string;
};

export const getReadinessSummary = (
  components: AdapterComponent[],
): OtaReadinessSummary | undefined =>
  components.find((c) => c.type === COMPONENT_TYPES.readinessSummary) as
    | OtaReadinessSummary
    | undefined;

export const getFindings = (components: AdapterComponent[]): OtaFinding[] =>
  components.filter((c) => c.type === COMPONENT_TYPES.finding) as OtaFinding[];

export const SUPPORT_PHASES = {
  fullSupport: 'Full Support',
  maintenance: 'Maintenance Support',
  endOfLife: 'End of life',
} as const;

export type SupportPhase = (typeof SUPPORT_PHASES)[keyof typeof SUPPORT_PHASES];

export type OtaOlmOperatorLifecycle = {
  productName?: string;
  supportPhase?: SupportPhase;
  ocpVersions?: string;
  maintenanceEnds?: string;
};

export type OtaOlmOperator = {
  name: string;
  namespace: string;
  displayName?: string;
  installedVersion?: string;
  channel?: string;
  source?: string;
  installPlanApproval?: 'Automatic' | 'Manual';
  pendingUpgrade?: boolean;
  pendingVersion?: string;
  compatibleWithTarget?: boolean;
  availableChannels?: string[];
  ocpCompat?: { min?: string; max?: string };
  lifecycle?: OtaOlmOperatorLifecycle;
};

export type OtaOlmOperatorStatusSummary = {
  totalOperators: number;
  pendingUpgrades: number;
  manualApproval: number;
  incompatibleWithTarget: number;
};

export type OtaOlmOperatorStatus = AdapterComponent & {
  type: typeof COMPONENT_TYPES.olmOperatorStatus;
  operators: OtaOlmOperator[];
  summary: OtaOlmOperatorStatusSummary;
};

export const getOlmOperatorStatus = (
  components: AdapterComponent[],
): OtaOlmOperatorStatus | undefined =>
  components.find((c) => c.type === COMPONENT_TYPES.olmOperatorStatus) as
    | OtaOlmOperatorStatus
    | undefined;

const SEVERITY_ORDER: Record<string, number> = {
  blocker: 0,
  warning: 1,
  info: 2,
};

export const sortFindings = (findings: OtaFinding[]): OtaFinding[] =>
  [...findings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
  );
