import type {
  LightspeedAgenticRun,
  LightspeedAgenticRunApproval,
  LightspeedAnalysisResult,
  RemediationOption,
} from '../models/agenticrun';
import { LABELS, LIGHTSPEED_NAMESPACE } from '../utils/constants';

export type Scenario =
  | 'Pending'
  | 'Analyzing'
  | 'Proposed'
  | 'Executing'
  | 'AwaitingVerification'
  | 'Verifying'
  | 'Completed'
  | 'AnalysisFailed'
  | 'ExecutionFailed'
  | 'VerificationFailed'
  | 'Denied'
  | 'NoAction';

export const runName = 'preview-update-5-0-1';
export const runUid = 'preview-cluster-update';
export const createdAt = new Date(Date.now() - 12 * 60 * 1000).toISOString();

const option: RemediationOption = {
  title: 'Upgrade to OCP 5.0.1',
  summary:
    'All platform readiness checks pass. Update the platform and monitor community operators.',
  diagnosis: {
    rootCause:
      'The cluster is healthy and a recommended patch update from **5.0.0-rc.6 to 5.0.1** is available.',
    summary:
      'All 6 nodes are Ready, etcd is healthy, and no cluster operators are degraded. Two community operators need post-update monitoring.\n\n| Check | Result |\n| --- | --- |\n| Cluster operators | 34 healthy, 0 degraded |\n| Nodes | 6 of 6 Ready |\n| etcd | 3 healthy members |\n| API deprecations | No blockers |\n| Pod disruption budgets | No blocked drains |',
  },
  rbac: {
    namespaceScoped: [
      {
        namespace: 'openshift-monitoring',
        apiGroups: [''],
        resources: ['pods'],
        verbs: ['get', 'list'],
        justification: 'Inspect monitoring health before the update.',
      },
      {
        namespace: 'openshift-monitoring',
        apiGroups: [''],
        resources: ['configmaps'],
        resourceNames: ['cluster-monitoring-config'],
        verbs: ['get'],
        justification: 'Check the current monitoring configuration.',
      },
    ],
    clusterScoped: [
      {
        apiGroups: ['config.openshift.io'],
        resources: ['clusterversions'],
        resourceNames: ['version'],
        verbs: ['get', 'patch'],
        justification: 'Request the approved platform update.',
      },
      {
        apiGroups: ['config.openshift.io'],
        resources: ['clusteroperators'],
        verbs: ['get', 'list', 'watch'],
        justification: 'Monitor operator health during the update.',
      },
    ],
  },
  remediationPlan: {
    description:
      'Run readiness checks, request the platform update, and confirm that the cluster begins progressing.',
    risk: 'Low',
    reversible: 'Irreversible',
    estimatedImpact:
      'Worker nodes drain and reboot one at a time. Applications with multiple replicas should remain available. Estimated duration: 60 minutes.',
    actions: [
      {
        type: 'pre-check',
        description: 'Verify the cluster is not currently updating. Expected output: False.',
        command: `oc get clusterversion version -o jsonpath='{.status.conditions[?(@.type=="Progressing")].status}'`,
      },
      {
        type: 'pre-check',
        description: 'Verify no cluster operators are degraded before initiating the upgrade.',
        command: 'oc get clusteroperators',
      },
      {
        type: 'pre-check',
        description: 'Verify target version 5.0.1 exists in available updates.',
        command: `oc get clusterversion version -o jsonpath='{.status.availableUpdates[*].version}'`,
      },
      {
        type: 'mutation',
        description: 'Initiate the platform upgrade to OCP 5.0.1.',
        command: 'oc adm upgrade --to=5.0.1',
      },
      {
        type: 'post-check',
        description: 'Verify the desired update version is 5.0.1.',
        command: `oc get clusterversion version -o jsonpath='{.spec.desiredUpdate.version}'`,
      },
      {
        type: 'post-check',
        description: 'Verify the upgrade has started.',
        command: 'oc adm upgrade',
      },
    ],
    rollbackPlan: {
      description:
        'A platform downgrade is not supported. Pause and investigate any degraded operators; restore from an etcd backup only as part of a documented disaster recovery procedure.',
    },
  },
  verification: {
    description:
      'After the update, check the desired version, node readiness, and operator health.',
    steps: [
      {
        name: 'Platform version',
        type: 'command',
        command: `oc get clusterversion version -o jsonpath='{.status.history[0].version}'`,
        expected: '5.0.1',
      },
      {
        name: 'Update finished',
        type: 'command',
        command: `oc get clusterversion version -o jsonpath='{.status.conditions[?(@.type=="Progressing")].status}'`,
        expected: 'False',
      },
      {
        name: 'Node readiness',
        type: 'resource',
        command: 'oc get nodes',
        expected: 'All 6 nodes Ready',
      },
      {
        name: 'Operator health',
        type: 'resource',
        command: 'oc get clusteroperators',
        expected: 'Available=True and Degraded=False',
      },
    ],
  },
};

export const resourcesFor = (scenario: Scenario, revision: number) => {
  const analyzed = !['Pending', 'Analyzing', 'AnalysisFailed'].includes(scenario);
  const execution = [
    'Executing',
    'AwaitingVerification',
    'Verifying',
    'Completed',
    'ExecutionFailed',
    'VerificationFailed',
  ].includes(scenario);
  const executionFinished = execution && scenario !== 'Executing';
  const verification = ['Verifying', 'Completed', 'VerificationFailed'].includes(scenario);
  const condition = (
    type: string,
    status: 'True' | 'False' | 'Unknown',
    reason = 'Succeeded',
    message = '',
  ) => ({ type, status, reason, message, lastTransitionTime: createdAt });
  const run: LightspeedAgenticRun = {
    apiVersion: 'agentic.openshift.io/v1alpha1',
    kind: 'AgenticRun',
    metadata: {
      name: runName,
      namespace: LIGHTSPEED_NAMESPACE,
      uid: runUid,
      generation: 1,
      creationTimestamp: createdAt,
      labels: {
        [LABELS.currentVersion]: '5-0-0-rc.6',
        [LABELS.targetVersion]: '5-0-1',
        [LABELS.updateType]: 'Patch',
      },
    },
    spec: {
      analysis: { agent: 'default' },
      execution: { agent: 'default' },
      verification: { agent: 'default' },
      request: 'Assess readiness and plan the update to OCP 5.0.1.',
    },
    status: {
      conditions: [
        ...(scenario === 'Pending'
          ? []
          : [
              condition(
                'Analyzed',
                scenario === 'Analyzing'
                  ? 'Unknown'
                  : scenario === 'AnalysisFailed'
                    ? 'False'
                    : 'True',
                scenario === 'AnalysisFailed'
                  ? 'AgentTimeout'
                  : scenario === 'NoAction'
                    ? 'NoActionRequired'
                    : 'Succeeded',
                scenario === 'AnalysisFailed'
                  ? 'The analysis agent exceeded its execution budget.'
                  : '',
              ),
            ]),
        ...(execution
          ? [
              condition(
                'Executed',
                scenario === 'Executing'
                  ? 'Unknown'
                  : scenario === 'ExecutionFailed'
                    ? 'False'
                    : 'True',
                scenario === 'ExecutionFailed' ? 'CommandFailed' : 'Succeeded',
                scenario === 'ExecutionFailed'
                  ? 'The readiness check found a degraded operator. Execution stopped before the update.'
                  : '',
              ),
            ]
          : []),
        ...(verification
          ? [
              condition(
                'Verified',
                scenario === 'Verifying'
                  ? 'Unknown'
                  : scenario === 'VerificationFailed'
                    ? 'False'
                    : 'True',
                scenario === 'VerificationFailed' ? 'VerificationFailed' : 'Succeeded',
                scenario === 'VerificationFailed'
                  ? 'The target version is not yet observed on all nodes.'
                  : '',
              ),
            ]
          : []),
        ...(scenario === 'Denied' ? [condition('Denied', 'True')] : []),
        ...(scenario === 'NoAction'
          ? [condition('Executed', 'True', 'Skipped'), condition('Verified', 'True', 'Skipped')]
          : []),
      ],
      steps: {
        ...(scenario === 'Pending'
          ? {}
          : {
              analysis: {
                sandbox: { claimName: 'preview-analysis', namespace: LIGHTSPEED_NAMESPACE },
                ...(analyzed
                  ? {
                      results: [{ name: 'preview-analysis-result', outcome: 'Succeeded' as const }],
                    }
                  : {}),
              },
            }),
        ...(execution
          ? {
              execution: {
                sandbox: { claimName: 'preview-execution', namespace: LIGHTSPEED_NAMESPACE },
                ...(executionFinished
                  ? {
                      results: [
                        {
                          name: 'preview-execution-result',
                          outcome:
                            scenario === 'ExecutionFailed'
                              ? ('Failed' as const)
                              : ('Succeeded' as const),
                        },
                      ],
                    }
                  : {}),
              },
            }
          : {}),
        ...(verification
          ? {
              verification: {
                sandbox: { claimName: 'preview-verification', namespace: LIGHTSPEED_NAMESPACE },
              },
            }
          : {}),
      },
    },
  };
  const result: LightspeedAnalysisResult = {
    metadata: {
      name: 'preview-analysis-result',
      uid: 'preview-analysis-result',
      namespace: LIGHTSPEED_NAMESPACE,
    },
    spec: { agenticRunName: runName },
    status:
      scenario === 'NoAction'
        ? {
            actionRequired: 'False',
            diagnosis: {
              rootCause: 'The cluster already meets the requested target.',
              summary: 'No remediation is required.',
            },
          }
        : {
            actionRequired: 'True',
            options: [
              option,
              {
                ...option,
                title: 'Update operators before the platform',
                summary: 'Update the monitoring operator first, then perform the platform upgrade.',
                remediationPlan: {
                  ...option.remediationPlan!,
                  risk: 'Medium',
                  actions: [
                    {
                      type: 'mutation',
                      description:
                        'Switch the operator subscription to the supported stable channel.',
                      command: `oc patch subscription monitoring-operator -n openshift-monitoring --type=merge -p '{"spec":{"channel":"stable"}}'`,
                    },
                    ...option.remediationPlan!.actions,
                  ],
                },
              },
            ],
          },
  };
  const approval: LightspeedAgenticRunApproval = {
    metadata: { name: runName, namespace: LIGHTSPEED_NAMESPACE, resourceVersion: String(revision) },
    spec: {
      stages: [
        ...(scenario === 'Pending'
          ? []
          : [{ type: 'Analysis' as const, decision: 'Approved' as const, analysis: {} }]),
        ...(execution
          ? [
              {
                type: 'Execution' as const,
                decision: 'Approved' as const,
                execution: { option: 0 },
              },
            ]
          : []),
        ...(verification
          ? [{ type: 'Verification' as const, decision: 'Approved' as const, verification: {} }]
          : []),
        ...(scenario === 'Denied'
          ? [{ type: 'Execution' as const, decision: 'Denied' as const, execution: {} }]
          : []),
      ],
    },
  };
  const actions = [
    {
      type: 'pre-check',
      description: 'Verified the cluster is not currently updating.',
      outcome: 'Succeeded' as const,
      output: 'Progressing=False',
    },
    ...(scenario === 'ExecutionFailed'
      ? [
          {
            type: 'pre-check',
            description: 'Checked for degraded cluster operators.',
            outcome: 'Failed' as const,
            output: 'monitoring: Degraded=True',
            error: 'A degraded operator prevents the update. Execution stopped.',
          },
        ]
      : [
          {
            type: 'mutation',
            description: 'Requested the platform update to OCP 5.0.1.',
            outcome: 'Succeeded' as const,
            output: 'Cluster update to 5.0.1 has been initiated.',
          },
          {
            type: 'post-check',
            description: 'Verified the desired version and update progress.',
            outcome: 'Succeeded' as const,
            output: 'desiredUpdate.version=5.0.1; Progressing=True',
          },
        ]),
  ];
  const executionResults = executionFinished
    ? [
        {
          metadata: {
            name: 'preview-execution-result',
            namespace: LIGHTSPEED_NAMESPACE,
          },
          spec: { agenticRunName: runName },
          status: { actionsTaken: actions },
        },
      ]
    : [];
  return { run, results: analyzed ? [result] : [], executionResults, approval };
};

export const logMessages = {
  analysis: [
    'Starting cluster update readiness analysis',
    'Current version: 5.0.0-rc.6; target version: 5.0.1',
    'Checking cluster conditions: Available=True, Failing=False',
    'Checking nodes: 6 of 6 Ready',
    'Checking etcd: 3 healthy members',
    'Checking cluster operators: 34 available, 0 degraded',
    'Checking API deprecations: no removed APIs in use',
    'Checking pod disruption budgets: no blocked drains',
    'Reviewing OLM operator compatibility',
    'Two community operators require post-update monitoring',
    'Building remediation options and scoped permissions',
    'Analysis complete. Awaiting administrator approval.',
  ],
  execution: [
    'Approved remediation plan loaded',
    'Pre-check: cluster is not currently updating',
    'Pre-check: no degraded cluster operators',
    'Pre-check: target version 5.0.1 is available',
    'Executing: oc adm upgrade --to=5.0.1',
    'Requested update to 5.0.1',
    'Post-check: desiredUpdate.version=5.0.1',
    'Post-check: Progressing=True',
    'Monitoring update progress: 2 of 6 nodes updated',
    'Monitoring update progress: 4 of 6 nodes updated',
    'Monitoring update progress: 6 of 6 nodes updated',
    'Execution complete. Ready for verification.',
  ],
  verification: [
    'Starting verification of the approved update plan',
    'Checking target version: 5.0.1',
    'Checking nodes: 6 of 6 Ready',
    'Checking cluster operators: 34 available, 0 degraded',
    'Checking etcd health: 3 healthy members',
    'Verification complete. All checks passed.',
  ],
};
