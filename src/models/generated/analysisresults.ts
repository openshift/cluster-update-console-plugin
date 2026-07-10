// Auto-generated from CRD — do not edit manually.
// Regenerate with: make generate-types

export type AnalysisResultSpec = {
  /** proposalName is the name of the parent Proposal in the same namespace. */
  proposalName: string;
};

export type AnalysisResultStatus = {
  /** conditions track the lifecycle of this result. */
  conditions?: {
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
  }[];
  /** failureReason is populated when the step failed due to a system error. */
  failureReason?: string;
  /** options contains the remediation options returned by the analysis agent. */
  options?: {
    /** components contains optional adapter-defined structured data whose shape is determined by spec.an... */
    components?: Record<string, unknown>;
    /** diagnosis contains the root cause analysis specific to this option. Present when analysisOutput m... */
    diagnosis?: {
      /** confidence is the agent's self-assessed confidence in its diagnosis. Higher confidence generally ... */
      confidence: 'Low' | 'Medium' | 'High';
      /** rootCause is a concise Markdown-formatted description of the identified root cause (e.g., "OOMKil... */
      rootCause: string;
      /** summary is a Markdown-formatted diagnosis summary explaining the problem, its symptoms, and the a... */
      summary: string;
    };
    /** proposal contains the remediation plan for this option. Present when analysisOutput mode is Defau... */
    proposal?: {
      /** actions is the ordered list of discrete actions the agent proposes. Maximum 50 items. */
      actions: {
        /** description is a Markdown-formatted explanation of what this action will do (e.g., "Increase memo... */
        description: string;
        /** type is the action category (e.g., "patch", "scale", "restart", "create", "delete", "rollout"). F... */
        type: string;
      }[];
      /** description is a Markdown-formatted summary of the overall remediation approach. Maximum 8192 cha... */
      description: string;
      /** estimatedImpact is a Markdown-formatted description of the expected impact of the remediation on ... */
      estimatedImpact: string;
      /** reversible indicates whether the remediation can be rolled back if something goes wrong. See roll... */
      reversible?: 'Reversible' | 'Irreversible' | 'Partial';
      /** risk is the agent's assessment of how risky the remediation is. Critical-risk proposals typically... */
      risk: 'Low' | 'Medium' | 'High' | 'Critical';
      /** rollbackPlan describes how to undo the remediation if execution fails or causes unexpected issues... */
      rollbackPlan?: {
        /** command is the rollback command or steps to execute. Maximum 4096 characters. */
        command?: string;
        /** description is a Markdown-formatted explanation of the rollback strategy. Must be 1-4096 characters. */
        description: string;
      };
    };
    /** rbac contains the RBAC permissions the execution agent will need. The operator's policy engine va... */
    rbac?: {
      /** clusterScoped are rules that will be applied via ClusterRole + ClusterRoleBinding. Used when the ... */
      clusterScoped?: {
        /** apiGroups are the API groups for this rule (e.g., "", "apps", "batch"). The empty string "" repre... */
        apiGroups: string[];
        /** justification is a Markdown-formatted explanation of why this permission is needed for the remedi... */
        justification: string;
        /** namespace is the target namespace for namespace-scoped rules. Must match one of the proposal's ta... */
        namespace?: string;
        /** resourceNames restricts the rule to specific named resources. When empty, the rule applies to all... */
        resourceNames?: string[];
        /** resources are the resource types (e.g., "pods", "deployments"). Maximum 20 items. */
        resources: string[];
        /** verbs are the allowed operations (e.g., "get", "patch", "delete"). Maximum 10 items. */
        verbs: string[];
      }[];
      /** namespaceScoped are rules that will be applied via Role + RoleBinding in the proposal's target na... */
      namespaceScoped?: {
        /** apiGroups are the API groups for this rule (e.g., "", "apps", "batch"). The empty string "" repre... */
        apiGroups: string[];
        /** justification is a Markdown-formatted explanation of why this permission is needed for the remedi... */
        justification: string;
        /** namespace is the target namespace for namespace-scoped rules. Must match one of the proposal's ta... */
        namespace?: string;
        /** resourceNames restricts the rule to specific named resources. When empty, the rule applies to all... */
        resourceNames?: string[];
        /** resources are the resource types (e.g., "pods", "deployments"). Maximum 20 items. */
        resources: string[];
        /** verbs are the allowed operations (e.g., "get", "patch", "delete"). Maximum 10 items. */
        verbs: string[];
      }[];
    };
    /** summary is an optional Markdown-formatted one-line summary for collapsed views in the console UI.... */
    summary?: string;
    /** title is a short Markdown-formatted name for this option (e.g., "Increase memory limit", "Restart... */
    title: string;
    /** verification contains the verification plan. Omitted when verification is skipped in the workflow. */
    verification?: {
      /** description is a Markdown-formatted summary of the verification approach. Maximum 4096 characters. */
      description: string;
      /** steps is the ordered list of verification checks to run. Maximum 20 items. */
      steps?: {
        /** command is the command or API call to run for this check (e.g., "oc get pod -n production -l app=... */
        command?: string;
        /** expected is the expected output or condition (e.g., "Running", "ready=true"). Maximum 1024 charac... */
        expected?: string;
        /** name is a short identifier for this check (e.g., "pod-running"). Must be 1-253 characters. */
        name: string;
        /** type categorizes the check (e.g., "command", "metric", "condition"). Must be 1-256 characters. */
        type: string;
      }[];
    };
  }[];
  /** sandbox tracks the sandbox pod used for this analysis. */
  sandbox?: {
    /** claimName is the name of the SandboxClaim resource that owns the sandbox pod. Maximum 253 charact... */
    claimName: string;
    /** namespace is the namespace where the SandboxClaim and its pod live. Must be a valid RFC 1123 DNS ... */
    namespace: string;
  };
};
