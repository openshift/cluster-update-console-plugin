// Auto-generated from CRD — do not edit manually.
// Regenerate with: make generate-types


export type ProposalApprovalSpec = {
  /** stages lists the approved (or denied) workflow steps. Each entry is a discriminated union keyed b... */
  stages?: ({
    /** analysis contains approval parameters for the analysis step. Required when type is Analysis. */
    analysis?: {
      /** agent is the Agent CR for this step. Defaults to "default". */
      agent?: string;
    };
    /** decision indicates whether this stage is approved or denied. Denying any stage terminates the ent... */
    decision?: 'Approved' | 'Denied';
    /** escalation contains approval parameters for the escalation step. Required when type is Escalation. */
    escalation?: {
      /** agent is the Agent CR for this step. Defaults to "default". */
      agent?: string;
    };
    /** execution contains approval parameters for the execution step. Required when type is Execution. */
    execution?: {
      /** agent is the Agent CR for this step. Defaults to "default". */
      agent?: string;
      /** maxAttempts is the number of execution retry attempts approved for this proposal. Must not exceed... */
      maxAttempts?: number;
      /** option is the 0-based index into the analysis options array selecting which remediation approach ... */
      option?: number;
    };
    /** type identifies which workflow step this approval is for. */
    type: 'Analysis' | 'Execution' | 'Verification' | 'Escalation';
    /** verification contains approval parameters for the verification step. Required when type is Verifi... */
    verification?: {
      /** agent is the Agent CR for this step. Defaults to "default". */
      agent?: string;
    };
  })[];
};

export type ProposalApprovalStatus = {
  /** stages contains the per-stage approval status set by the controller. */
  stages?: ({
    /** conditions for this approval stage. */
    conditions?: ({
      /** lastTransitionTime is the last time the condition transitioned from one status to another. This s... */
      lastTransitionTime: string;
      /** message is a human readable message indicating details about the transition. This may be an empty... */
      message: string;
      /** observedGeneration represents the .metadata.generation that the condition was set based upon. For... */
      observedGeneration?: number;
      /** reason contains a programmatic identifier indicating the reason for the condition's last transiti... */
      reason: string;
      /** status of the condition, one of True, False, Unknown. */
      status: 'True' | 'False' | 'Unknown';
      /** type of condition in CamelCase or in foo.example.com/CamelCase. */
      type: string;
    })[];
    /** name identifies the workflow step. */
    name: string;
  })[];
};
