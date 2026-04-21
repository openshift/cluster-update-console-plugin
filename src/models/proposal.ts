import {
  K8sModel,
  K8sResourceCommon,
  K8sResourceCondition,
  getGroupVersionKindForModel,
} from '@openshift-console/dynamic-plugin-sdk';

export const LightspeedProposalModel: K8sModel = {
  apiGroup: 'agentic.openshift.io',
  apiVersion: 'v1alpha1',
  kind: 'Proposal',
  plural: 'proposals',
  abbr: 'LSP',
  namespaced: true,
  label: 'Proposal',
  labelPlural: 'Proposals',
};

export const LightspeedProposalGVK = getGroupVersionKindForModel(LightspeedProposalModel);

export type ProposalPhase =
  | 'Pending'
  | 'Analyzing'
  | 'Proposed'
  | 'Approved'
  | 'Denied'
  | 'Executing'
  | 'AwaitingSync'
  | 'Verifying'
  | 'Completed'
  | 'Failed'
  | 'Escalated';

export type StepPhase = 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Skipped';

export type SandboxInfo = {
  claimName?: string;
  namespace?: string;
  startedAt?: string;
  completedAt?: string;
};

export type PreviousAttempt = {
  attempt: number;
  failedPhase?: string;
  failureReason?: string;
};

export type AgentDiagnosis = {
  summary: string;
  confidence: string;
  rootCause: string;
};

export type AgentAction = {
  type: string;
  description: string;
};

export type AgentProposal = {
  description: string;
  actions: AgentAction[];
  risk: string;
  reversible: boolean;
  estimatedImpact?: string;
};

export type VerificationStep = {
  name: string;
  command: string;
  expected: string;
  type: string;
};

export type AgentRollbackPlan = {
  description: string;
  command: string;
};

export type AgentVerification = {
  description: string;
  steps: VerificationStep[];
  rollbackPlan: AgentRollbackPlan | string;
};

export type PermissionRule = {
  namespace?: string;
  apiGroups: string[];
  resources: string[];
  resourceNames?: string[];
  verbs: string[];
  justification: string;
};

export type AgentRbac = {
  namespaceScoped: PermissionRule[];
  clusterScoped: PermissionRule[];
};

export type AdapterComponent = {
  type: string;
  [key: string]: unknown;
};

export type RemediationOption = {
  title: string;
  summary?: string;
  diagnosis: AgentDiagnosis;
  proposal: AgentProposal;
  verification?: AgentVerification;
  rbac?: AgentRbac;
  components?: AdapterComponent[];
};

export type AnalysisStepStatus = {
  phase?: StepPhase;
  options?: RemediationOption[];
  selectedOption?: number;
  sandbox?: SandboxInfo;
  conditions?: K8sResourceCondition[];
  components?: AdapterComponent[];
};

export type ExecutionActionTaken = {
  type: string;
  description: string;
  success: boolean;
  output?: string;
  error?: string;
};

export type ExecutionVerification = {
  conditionImproved: boolean;
  summary: string;
};

export type ExecutionStepStatus = {
  phase?: StepPhase;
  success?: boolean;
  actionsTaken?: ExecutionActionTaken[];
  verification?: ExecutionVerification;
  sandbox?: SandboxInfo;
  components?: AdapterComponent[];
};

export type VerificationCheck = {
  name: string;
  source: string;
  value: string;
  passed: boolean;
};

export type VerificationStepStatus = {
  phase?: StepPhase;
  success?: boolean;
  checks?: VerificationCheck[];
  summary?: string;
  sandbox?: SandboxInfo;
  components?: AdapterComponent[];
};

export type StepsStatus = {
  analysis?: AnalysisStepStatus;
  execution?: ExecutionStepStatus;
  verification?: VerificationStepStatus;
};

export type LightspeedProposal = K8sResourceCommon & {
  spec: {
    request: string;
    workflow: string;
    targetNamespaces?: string[];
    maxAttempts?: number;
  };
  status?: {
    phase?: ProposalPhase;
    attempt?: number;
    steps?: StepsStatus;
    conditions?: K8sResourceCondition[];
    previousAttempts?: PreviousAttempt[];
  };
};

export type PhaseDisplay = {
  color: 'grey' | 'blue' | 'teal' | 'orange' | 'purple' | 'green' | 'red' | 'orangered';
  label: string;
};

export const getPhaseDisplay = (phase?: ProposalPhase | string): PhaseDisplay => {
  switch (phase) {
    case 'Pending':
      return { color: 'grey', label: 'Pending' };
    case 'Analyzing':
      return { color: 'blue', label: 'Analyzing' };
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

// Shared helper to extract the selected analysis option and its components.
// Uses selectedOption when available, falling back to the first option.
export type AnalysisData = {
  analysis?: AnalysisStepStatus;
  option?: RemediationOption;
  components: AdapterComponent[];
};

export const getAnalysisData = (proposal: LightspeedProposal): AnalysisData => {
  const analysis = proposal.status?.steps?.analysis;
  const optionIndex = analysis?.selectedOption ?? 0;
  const option = analysis?.options?.[optionIndex];
  return {
    analysis,
    option,
    components: option?.components ?? analysis?.components ?? [],
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

// OTA adapter component types (from CVO outputSchema)
export const COMPONENT_TYPES = {
  readinessSummary: 'ota_readiness_summary',
  finding: 'ota_finding',
  olmOperatorStatus: 'ota_olm_operator_status',
} as const;

// Typed shapes for the OTA adapter components

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

// Helpers to extract typed components from the generic AdapterComponent array

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
