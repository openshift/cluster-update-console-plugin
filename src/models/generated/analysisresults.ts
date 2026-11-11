// Auto-generated from CRD — do not edit manually.
// Regenerate with: make generate-types

export type AnalysisResultSpec = {
  /** agenticRunName is the name of the parent AgenticRun in the same namespace. */
  agenticRunName: string;
};

export type TokenUsage = {
  /** inputTokens is the number of input (prompt) tokens consumed. */
  inputTokens?: number;
  /** outputTokens is the number of output (completion) tokens consumed. */
  outputTokens?: number;
};

export type ActionRequiredValue = 'True' | 'False';

export type DiagnosisResult = {
  /** summary is a Markdown-formatted diagnosis summary explaining the problem, its symptoms, and the agent's findings. */
  summary: string;
  /** confidence is the agent's self-assessed confidence in its diagnosis. */
  confidence?: 'Low' | 'Medium' | 'High';
  /** rootCause is a concise Markdown-formatted explanation of the causal chain. */
  rootCause: string;
};

export type SandboxInfo = {
  /** claimName is the name of the SandboxClaim resource that owns the sandbox pod. */
  claimName: string;
  /** namespace is the namespace where the SandboxClaim and its pod live. */
  namespace: string;
};

export type AnalysisResultStatus = {
  /** conditions track the lifecycle of this result. */
  conditions?: {
    /** lastTransitionTime is the last time the condition transitioned from one status to another. */
    lastTransitionTime: string;
    /** message is a human readable message indicating details about the transition. */
    message: string;
    /** observedGeneration represents the .metadata.generation that the condition was set based upon. */
    observedGeneration?: number;
    /** reason contains a programmatic identifier indicating the reason for the condition's last transition. */
    reason: string;
    /** status of the condition, one of True, False, Unknown. */
    status: 'True' | 'False' | 'Unknown';
    /** type of condition in CamelCase or in foo.example.com/CamelCase. */
    type: string;
  }[];
  /** actionRequired indicates whether the analysis determined that remediation action is needed. */
  actionRequired?: ActionRequiredValue;
  /** diagnosis is the top-level root cause analysis, populated when actionRequired is "False". */
  diagnosis?: DiagnosisResult;
  /** options contains the remediation options returned by the analysis agent. */
  options?: {
    /** title is a short Markdown-formatted name for this option. */
    title: string;
    /** summary is an optional Markdown-formatted one-line summary for collapsed views in the console UI. */
    summary?: string;
    /** components contains optional adapter-defined structured data. */
    components?: Record<string, unknown>;
    /** diagnosis contains the root cause analysis specific to this option. */
    diagnosis?: DiagnosisResult;
    /** remediationPlan contains the remediation plan for this option. */
    remediationPlan?: {
      /** description is a Markdown-formatted summary of the overall remediation approach. */
      description: string;
      /** actions is the ordered list of discrete actions the agent proposes. */
      actions: {
        /** command is an exact executable kubectl/oc command or MCP tool call. */
        command?: string;
        /** type is the action phase category. */
        type: string;
        /** description is a Markdown-formatted explanation of what this action will do. */
        description: string;
      }[];
      /** risk is the agent's assessment of how risky the remediation is. */
      risk?: 'Low' | 'Medium' | 'High' | 'Critical';
      /** reversible indicates whether the remediation can be rolled back. */
      reversible?: 'Reversible' | 'Irreversible' | 'Partial';
      /** rollbackPlan describes how to undo the remediation. */
      rollbackPlan?: {
        /** description is a Markdown-formatted explanation of the rollback strategy. */
        description: string;
        /** command is the rollback command or steps to execute. */
        command?: string;
      };
    };
    /** verification contains the verification plan. */
    verification?: {
      /** description is a Markdown-formatted summary of the verification approach. */
      description: string;
      /** steps is the ordered list of verification checks to run. */
      steps?: {
        /** name is a short identifier for this check. */
        name: string;
        /** command is the command or API call to run for this check. */
        command?: string;
        /** expected is the expected output or condition. */
        expected?: string;
        /** type categorizes the check. */
        type: string;
      }[];
    };
    /** rbac contains the RBAC permissions the execution agent will need. */
    rbac?: {
      /** namespaceScoped are rules that will be applied via Role + RoleBinding. */
      namespaceScoped?: {
        /** namespace is the target namespace for namespace-scoped rules. */
        namespace?: string;
        /** apiGroups are the API groups for this rule. */
        apiGroups: string[];
        /** resources are the resource types. */
        resources: string[];
        /** resourceNames restricts the rule to specific named resources. */
        resourceNames?: string[];
        /** verbs are the allowed operations. */
        verbs: string[];
        /** justification is a Markdown-formatted explanation of why this permission is needed. */
        justification: string;
      }[];
      /** clusterScoped are rules that will be applied via ClusterRole + ClusterRoleBinding. */
      clusterScoped?: {
        /** namespace is the target namespace for namespace-scoped rules. */
        namespace?: string;
        /** apiGroups are the API groups for this rule. */
        apiGroups: string[];
        /** resources are the resource types. */
        resources: string[];
        /** resourceNames restricts the rule to specific named resources. */
        resourceNames?: string[];
        /** verbs are the allowed operations. */
        verbs: string[];
        /** justification is a Markdown-formatted explanation of why this permission is needed. */
        justification: string;
      }[];
    };
  }[];
  /** sandbox tracks the sandbox pod used for this analysis. */
  sandbox?: SandboxInfo;
  /** tokenUsage records the number of LLM tokens consumed during this step. */
  tokenUsage?: TokenUsage;
  /** failureReason is populated when the step failed due to a system error. */
  failureReason?: string;
};
