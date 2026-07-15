// Auto-generated from CRD — do not edit manually.
// Regenerate with: make generate-types

export type ApprovalPolicySpec = {
  /** maxAttempts sets the maximum number of execution retry attempts allowed for proposals. When verif... */
  maxAttempts?: number;
  /** maxConcurrentRuns sets the maximum number of agentic runs the operator reconciles concurrently.... */
  maxConcurrentRuns?: number;
  /** stages configures the approval mode for each workflow step. Omitted steps default to Manual. */
  stages?: {
    /** approval controls whether this step auto-approves or requires explicit user approval on the Propo... */
    approval: 'Automatic' | 'Manual';
    /** name is the workflow step this policy applies to. Allowed values: Analysis, Execution, Verificati... */
    name: 'Analysis' | 'Execution' | 'Verification' | 'Escalation';
  }[];
};
