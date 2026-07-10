// Auto-generated from CRD — do not edit manually.
// Regenerate with: make generate-types

export type AgenticRunSpec = {
  /** analysis defines per-step configuration for the analysis step, including which agent handles it a... */
  analysis: {
    /** agent is the name of the cluster-scoped Agent CR to use for this step. Defaults to "default" when... */
    agent?: string;
    /** tools provides per-step tools that replace the shared spec.tools for this step. Use this when dif... */
    tools?: {
      /** mcpServers defines external MCP (Model Context Protocol) servers the agent can connect to for add... */
      mcpServers?: {
        /** headers to send to the MCP server. Maximum 20 items. */
        headers?: {
          /** name of the header (e.g., "Authorization", "X-API-Key"). Must be at least 1 character, containing... */
          name: string;
          /** valueFrom is the source of the header value. */
          valueFrom: {
            /** secret references a Secret containing the header value. Required when type is "Secret". */
            secret?: {
              /** name of the Secret. Must be a valid RFC 1123 DNS subdomain. */
              name: string;
            };
            /** type specifies the source type for the header value. Allowed values:   - "Secret"     — reads the... */
            type: 'Secret' | 'ServiceAccountToken' | 'Client';
          };
        }[];
        /** name of the MCP server. Must start with a letter and contain only lowercase alphanumeric characte... */
        name: string;
        /** timeoutSeconds is the per-request timeout for calls to this MCP server, in seconds. Default is 5.... */
        timeoutSeconds?: number;
        /** url of the MCP server (HTTP/HTTPS). Must be an HTTP or HTTPS URL, maximum 2048 characters. */
        url: string;
      }[];
      /** requiredSecrets declares Kubernetes Secrets that the sandbox pod needs at runtime. The cluster ad... */
      requiredSecrets?: {
        /** description explains what this secret is used for, helping the cluster admin understand what cred... */
        description?: string;
        /** mountAs specifies how the secret is exposed in the sandbox pod. */
        mountAs: {
          /** envVar configures environment variable injection. Required when type is "EnvVar". */
          envVar?: {
            /** name is the environment variable name (e.g., "GITHUB_TOKEN"). Must be uppercase letters, digits, ... */
            name: string;
          };
          /** filePath configures file mount. Required when type is "FilePath". */
          filePath?: {
            /** path is the absolute file path (e.g., "/etc/secrets/tls.crt"). Must start with a forward slash. */
            path: string;
          };
          /** type specifies how the secret is exposed. Allowed values: "EnvVar", "FilePath".  When set to EnvV... */
          type: 'EnvVar' | 'FilePath';
        };
        /** name of the Secret (must exist in the operator namespace). Must be a valid RFC 1123 DNS subdomain. */
        name: string;
      }[];
      /** skills defines one or more OCI images containing skills to mount in the agent's sandbox pod. The ... */
      skills?: {
        /** image is the OCI image reference containing skills. The operator mounts this as a Kubernetes imag... */
        image: string;
        /** paths specifies which directories from the image are mounted. Each path is mounted as a separate ... */
        paths: string[];
      }[];
    };
  };
  /** analysisOutput configures the analysis step's structured output. The mode field controls which bu... */
  analysisOutput?: {
    /** mode controls which built-in properties the analysis output schema includes. Default includes all... */
    mode?: 'Default' | 'Minimal';
    /** schema is a JSON Schema injected as a required "components" property in each analysis output opti... */
    schema?: Record<string, unknown>;
  };
  /** execution defines per-step configuration for the execution step. Omit to skip execution (advisory... */
  execution?: {
    /** agent is the name of the cluster-scoped Agent CR to use for this step. Defaults to "default" when... */
    agent?: string;
    /** tools provides per-step tools that replace the shared spec.tools for this step. Use this when dif... */
    tools?: {
      /** mcpServers defines external MCP (Model Context Protocol) servers the agent can connect to for add... */
      mcpServers?: {
        /** headers to send to the MCP server. Maximum 20 items. */
        headers?: {
          /** name of the header (e.g., "Authorization", "X-API-Key"). Must be at least 1 character, containing... */
          name: string;
          /** valueFrom is the source of the header value. */
          valueFrom: {
            /** secret references a Secret containing the header value. Required when type is "Secret". */
            secret?: {
              /** name of the Secret. Must be a valid RFC 1123 DNS subdomain. */
              name: string;
            };
            /** type specifies the source type for the header value. Allowed values:   - "Secret"     — reads the... */
            type: 'Secret' | 'ServiceAccountToken' | 'Client';
          };
        }[];
        /** name of the MCP server. Must start with a letter and contain only lowercase alphanumeric characte... */
        name: string;
        /** timeoutSeconds is the per-request timeout for calls to this MCP server, in seconds. Default is 5.... */
        timeoutSeconds?: number;
        /** url of the MCP server (HTTP/HTTPS). Must be an HTTP or HTTPS URL, maximum 2048 characters. */
        url: string;
      }[];
      /** requiredSecrets declares Kubernetes Secrets that the sandbox pod needs at runtime. The cluster ad... */
      requiredSecrets?: {
        /** description explains what this secret is used for, helping the cluster admin understand what cred... */
        description?: string;
        /** mountAs specifies how the secret is exposed in the sandbox pod. */
        mountAs: {
          /** envVar configures environment variable injection. Required when type is "EnvVar". */
          envVar?: {
            /** name is the environment variable name (e.g., "GITHUB_TOKEN"). Must be uppercase letters, digits, ... */
            name: string;
          };
          /** filePath configures file mount. Required when type is "FilePath". */
          filePath?: {
            /** path is the absolute file path (e.g., "/etc/secrets/tls.crt"). Must start with a forward slash. */
            path: string;
          };
          /** type specifies how the secret is exposed. Allowed values: "EnvVar", "FilePath".  When set to EnvV... */
          type: 'EnvVar' | 'FilePath';
        };
        /** name of the Secret (must exist in the operator namespace). Must be a valid RFC 1123 DNS subdomain. */
        name: string;
      }[];
      /** skills defines one or more OCI images containing skills to mount in the agent's sandbox pod. The ... */
      skills?: {
        /** image is the OCI image reference containing skills. The operator mounts this as a Kubernetes imag... */
        image: string;
        /** paths specifies which directories from the image are mounted. Each path is mounted as a separate ... */
        paths: string[];
      }[];
    };
  };
  /** request is the user's original request, alert description, or a description of what triggered thi... */
  request: string;
  /** revisionFeedback is the user's free-text feedback requesting changes to the analysis. Patching th... */
  revisionFeedback?: string;
  /** targetNamespaces are the Kubernetes namespace(s) this proposal operates on. Used for RBAC scoping... */
  targetNamespaces?: string[];
  /** tools defines the default tools for all steps: skills images, MCP servers, and required secrets. ... */
  tools?: {
    /** mcpServers defines external MCP (Model Context Protocol) servers the agent can connect to for add... */
    mcpServers?: {
      /** headers to send to the MCP server. Maximum 20 items. */
      headers?: {
        /** name of the header (e.g., "Authorization", "X-API-Key"). Must be at least 1 character, containing... */
        name: string;
        /** valueFrom is the source of the header value. */
        valueFrom: {
          /** secret references a Secret containing the header value. Required when type is "Secret". */
          secret?: {
            /** name of the Secret. Must be a valid RFC 1123 DNS subdomain. */
            name: string;
          };
          /** type specifies the source type for the header value. Allowed values:   - "Secret"     — reads the... */
          type: 'Secret' | 'ServiceAccountToken' | 'Client';
        };
      }[];
      /** name of the MCP server. Must start with a letter and contain only lowercase alphanumeric characte... */
      name: string;
      /** timeoutSeconds is the per-request timeout for calls to this MCP server, in seconds. Default is 5.... */
      timeoutSeconds?: number;
      /** url of the MCP server (HTTP/HTTPS). Must be an HTTP or HTTPS URL, maximum 2048 characters. */
      url: string;
    }[];
    /** requiredSecrets declares Kubernetes Secrets that the sandbox pod needs at runtime. The cluster ad... */
    requiredSecrets?: {
      /** description explains what this secret is used for, helping the cluster admin understand what cred... */
      description?: string;
      /** mountAs specifies how the secret is exposed in the sandbox pod. */
      mountAs: {
        /** envVar configures environment variable injection. Required when type is "EnvVar". */
        envVar?: {
          /** name is the environment variable name (e.g., "GITHUB_TOKEN"). Must be uppercase letters, digits, ... */
          name: string;
        };
        /** filePath configures file mount. Required when type is "FilePath". */
        filePath?: {
          /** path is the absolute file path (e.g., "/etc/secrets/tls.crt"). Must start with a forward slash. */
          path: string;
        };
        /** type specifies how the secret is exposed. Allowed values: "EnvVar", "FilePath".  When set to EnvV... */
        type: 'EnvVar' | 'FilePath';
      };
      /** name of the Secret (must exist in the operator namespace). Must be a valid RFC 1123 DNS subdomain. */
      name: string;
    }[];
    /** skills defines one or more OCI images containing skills to mount in the agent's sandbox pod. The ... */
    skills?: {
      /** image is the OCI image reference containing skills. The operator mounts this as a Kubernetes imag... */
      image: string;
      /** paths specifies which directories from the image are mounted. Each path is mounted as a separate ... */
      paths: string[];
    }[];
  };
  /** verification defines per-step configuration for the verification step. Omit to skip verification.... */
  verification?: {
    /** agent is the name of the cluster-scoped Agent CR to use for this step. Defaults to "default" when... */
    agent?: string;
    /** tools provides per-step tools that replace the shared spec.tools for this step. Use this when dif... */
    tools?: {
      /** mcpServers defines external MCP (Model Context Protocol) servers the agent can connect to for add... */
      mcpServers?: {
        /** headers to send to the MCP server. Maximum 20 items. */
        headers?: {
          /** name of the header (e.g., "Authorization", "X-API-Key"). Must be at least 1 character, containing... */
          name: string;
          /** valueFrom is the source of the header value. */
          valueFrom: {
            /** secret references a Secret containing the header value. Required when type is "Secret". */
            secret?: {
              /** name of the Secret. Must be a valid RFC 1123 DNS subdomain. */
              name: string;
            };
            /** type specifies the source type for the header value. Allowed values:   - "Secret"     — reads the... */
            type: 'Secret' | 'ServiceAccountToken' | 'Client';
          };
        }[];
        /** name of the MCP server. Must start with a letter and contain only lowercase alphanumeric characte... */
        name: string;
        /** timeoutSeconds is the per-request timeout for calls to this MCP server, in seconds. Default is 5.... */
        timeoutSeconds?: number;
        /** url of the MCP server (HTTP/HTTPS). Must be an HTTP or HTTPS URL, maximum 2048 characters. */
        url: string;
      }[];
      /** requiredSecrets declares Kubernetes Secrets that the sandbox pod needs at runtime. The cluster ad... */
      requiredSecrets?: {
        /** description explains what this secret is used for, helping the cluster admin understand what cred... */
        description?: string;
        /** mountAs specifies how the secret is exposed in the sandbox pod. */
        mountAs: {
          /** envVar configures environment variable injection. Required when type is "EnvVar". */
          envVar?: {
            /** name is the environment variable name (e.g., "GITHUB_TOKEN"). Must be uppercase letters, digits, ... */
            name: string;
          };
          /** filePath configures file mount. Required when type is "FilePath". */
          filePath?: {
            /** path is the absolute file path (e.g., "/etc/secrets/tls.crt"). Must start with a forward slash. */
            path: string;
          };
          /** type specifies how the secret is exposed. Allowed values: "EnvVar", "FilePath".  When set to EnvV... */
          type: 'EnvVar' | 'FilePath';
        };
        /** name of the Secret (must exist in the operator namespace). Must be a valid RFC 1123 DNS subdomain. */
        name: string;
      }[];
      /** skills defines one or more OCI images containing skills to mount in the agent's sandbox pod. The ... */
      skills?: {
        /** image is the OCI image reference containing skills. The operator mounts this as a Kubernetes imag... */
        image: string;
        /** paths specifies which directories from the image are mounted. Each path is mounted as a separate ... */
        paths: string[];
      }[];
    };
  };
};

export type AgenticRunStatus = {
  /** conditions represent the latest available observations using the standard Kubernetes condition pa... */
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
  /** steps contains the per-step observed state (analysis, execution, verification). Each step indepen... */
  steps?: {
    /** analysis is the observed state of the analysis step. */
    analysis?: {
      /** conditions for this step. */
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
      /** results references AnalysisResult CRs, newest last. Each entry corresponds to one analysis attempt. */
      results?: {
        /** name is the name of the result CR. */
        name: string;
        /** outcome indicates the result of this step attempt. Must be one of: Succeeded, Failed. */
        outcome: 'Succeeded' | 'Failed';
      }[];
      /** sandbox tracks the sandbox used. */
      sandbox?: {
        /** claimName is the name of the SandboxClaim resource that owns the sandbox pod. Maximum 253 charact... */
        claimName: string;
        /** namespace is the namespace where the SandboxClaim and its pod live. Must be a valid RFC 1123 DNS ... */
        namespace: string;
      };
    };
    /** escalation is the observed state of the escalation step. */
    escalation?: {
      /** conditions for this step. */
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
      /** results references EscalationResult CRs, newest last. */
      results?: {
        /** name is the name of the result CR. */
        name: string;
        /** outcome indicates the result of this step attempt. Must be one of: Succeeded, Failed. */
        outcome: 'Succeeded' | 'Failed';
      }[];
      /** sandbox tracks the sandbox used. */
      sandbox?: {
        /** claimName is the name of the SandboxClaim resource that owns the sandbox pod. Maximum 253 charact... */
        claimName: string;
        /** namespace is the namespace where the SandboxClaim and its pod live. Must be a valid RFC 1123 DNS ... */
        namespace: string;
      };
    };
    /** execution is the observed state of the execution step. */
    execution?: {
      /** conditions for this step. */
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
      /** results references ExecutionResult CRs, newest last. Each entry corresponds to one execution atte... */
      results?: {
        /** name is the name of the result CR. */
        name: string;
        /** outcome indicates the result of this step attempt. Must be one of: Succeeded, Failed. */
        outcome: 'Succeeded' | 'Failed';
      }[];
      /** retryCount tracks how many times execution+verification has been retried for the current analysis... */
      retryCount?: number;
      /** sandbox tracks the sandbox used. */
      sandbox?: {
        /** claimName is the name of the SandboxClaim resource that owns the sandbox pod. Maximum 253 charact... */
        claimName: string;
        /** namespace is the namespace where the SandboxClaim and its pod live. Must be a valid RFC 1123 DNS ... */
        namespace: string;
      };
    };
    /** verification is the observed state of the verification step. */
    verification?: {
      /** conditions for this step. */
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
      /** results references VerificationResult CRs, newest last. Each entry corresponds to one verificatio... */
      results?: {
        /** name is the name of the result CR. */
        name: string;
        /** outcome indicates the result of this step attempt. Must be one of: Succeeded, Failed. */
        outcome: 'Succeeded' | 'Failed';
      }[];
      /** sandbox tracks the sandbox used. */
      sandbox?: {
        /** claimName is the name of the SandboxClaim resource that owns the sandbox pod. Maximum 253 charact... */
        claimName: string;
        /** namespace is the namespace where the SandboxClaim and its pod live. Must be a valid RFC 1123 DNS ... */
        namespace: string;
      };
    };
  };
};
