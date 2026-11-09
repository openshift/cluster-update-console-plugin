import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import { discoverExecutionPod, hasExecution } from '../utils/execution';
import { LightspeedAgenticRun } from '../models/agenticrun';

const fetchMock = consoleFetch as jest.Mock;
const run = {
  metadata: { uid: 'run-uid', namespace: 'ns' },
  status: { steps: { execution: { sandbox: { claimName: 'claim', namespace: 'ns' } } } },
} as LightspeedAgenticRun;
const pod = {
  metadata: {
    name: 'different-pod',
    uid: 'pod-uid',
    creationTimestamp: '2026-10-27T01:00:00Z',
    ownerReferences: [
      { apiVersion: 'agents.x-k8s.io/v1beta1', kind: 'Sandbox', uid: 'sandbox-uid' },
    ],
  },
  spec: { containers: [{ name: 'agent' }, { name: 'sidecar' }] },
  status: { startTime: '2026-10-27T01:01:00Z' },
};
const response = (body: unknown, status = 200) => ({
  ok: status === 200,
  status,
  json: async () => body,
});
const claimResponses = (pods: unknown[] = [pod]) => {
  fetchMock
    .mockResolvedValueOnce(response({ items: [] }))
    .mockResolvedValueOnce(response({ metadata: { uid: 'claim-uid' } }))
    .mockResolvedValueOnce(
      response({
        items: [
          {
            metadata: {
              uid: 'sandbox-uid',
              ownerReferences: [
                {
                  kind: 'SandboxClaim',
                  uid: 'claim-uid',
                  apiVersion: 'extensions.agents.x-k8s.io/v1beta1',
                },
              ],
            },
          },
        ],
      }),
    )
    .mockResolvedValueOnce(response({ items: pods }));
};

beforeEach(() => fetchMock.mockReset());

it('resolves a differently named pod through exact owner UIDs and uses workload container/start', async () => {
  claimResponses();
  await expect(discoverExecutionPod(run, new AbortController().signal)).resolves.toEqual({
    namespace: 'ns',
    podName: 'different-pod',
    podUid: 'pod-uid',
    container: 'agent',
    sinceTime: '2026-10-27T01:01:00Z',
  });
  expect(fetchMock.mock.calls[1][0]).toContain('/sandboxclaims/claim');
});

it('does not select an unrelated pod with the same owner name but wrong UID', async () => {
  claimResponses([
    {
      ...pod,
      metadata: {
        ...pod.metadata,
        ownerReferences: [
          { kind: 'Sandbox', apiVersion: 'agents.x-k8s.io/v1beta1', uid: 'wrong-uid' },
        ],
      },
    },
  ]);
  await expect(discoverExecutionPod(run, new AbortController().signal)).resolves.toBeUndefined();
});

it('uses positively identified bare-pod labels without requiring claim permissions', async () => {
  fetchMock.mockResolvedValueOnce(
    response({
      items: [
        {
          ...pod,
          metadata: {
            name: 'claim',
            uid: 'bare-uid',
            labels: {
              'agentic.openshift.io/run': 'run-uid',
              'agentic.openshift.io/step': 'execution',
            },
          },
        },
      ],
    }),
  );
  expect((await discoverExecutionPod(run, new AbortController().signal))?.podName).toBe('claim');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('refuses ambiguous pods instead of selecting the first', async () => {
  claimResponses([pod, { ...pod, metadata: { ...pod.metadata, name: 'second', uid: 'other' } }]);
  await expect(discoverExecutionPod(run, new AbortController().signal)).rejects.toThrow(
    'Ambiguous',
  );
});

it('does not treat forbidden claims as bare-pod fallback', async () => {
  fetchMock.mockResolvedValueOnce(response({ items: [] })).mockResolvedValueOnce(response({}, 403));
  await expect(discoverExecutionPod(run, new AbortController().signal)).rejects.toThrow('HTTP 403');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('handles missing claims without inventing pod names', async () => {
  fetchMock.mockResolvedValueOnce(response({ items: [] })).mockResolvedValueOnce(response({}, 404));
  await expect(discoverExecutionPod(run, new AbortController().signal)).resolves.toBeUndefined();
});

it('handles SDK rejected HttpError responses for absent and forbidden claims', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ items: [] }))
    .mockRejectedValueOnce(Object.assign(new Error('Not Found'), { code: 404 }));
  await expect(discoverExecutionPod(run, new AbortController().signal)).resolves.toBeUndefined();
  fetchMock
    .mockResolvedValueOnce(response({ items: [] }))
    .mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { code: 403 }));
  await expect(discoverExecutionPod(run, new AbortController().signal)).rejects.toThrow('HTTP 403');
});

it('prefers valid Started and otherwise immutable execution pod creation time', async () => {
  claimResponses();
  const started = '2026-10-27T01:00:30Z';
  const withStart = {
    ...run,
    status: {
      steps: {
        execution: {
          ...run.status?.steps?.execution,
          conditions: [
            {
              type: 'Started',
              status: 'True',
              lastTransitionTime: started,
              reason: 'Started',
              message: '',
            },
          ],
        },
      },
    },
  } as LightspeedAgenticRun;
  expect((await discoverExecutionPod(withStart, new AbortController().signal))?.sinceTime).toBe(
    started,
  );
  claimResponses([{ ...pod, status: {} }]);
  expect((await discoverExecutionPod(run, new AbortController().signal))?.sinceTime).toBe(
    pod.metadata.creationTimestamp,
  );
});

it('does not issue requests without an execution claim and run UID', async () => {
  await expect(
    discoverExecutionPod({ metadata: {} } as LightspeedAgenticRun, new AbortController().signal),
  ).resolves.toBeUndefined();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('waits for a pending workload instead of issuing a permanently failing log request', async () => {
  claimResponses([{ ...pod, status: { ...pod.status, phase: 'Pending' } }]);
  await expect(discoverExecutionPod(run, new AbortController().signal)).resolves.toBeUndefined();
  claimResponses([
    {
      ...pod,
      status: {
        ...pod.status,
        phase: 'Running',
        containerStatuses: [{ name: 'agent', state: { waiting: { reason: 'ContainerCreating' } } }],
      },
    },
  ]);
  await expect(discoverExecutionPod(run, new AbortController().signal)).resolves.toBeUndefined();
});

it.each([
  ['Pending', []],
  ['Analyzing', [{ type: 'Analyzed', status: 'Unknown' }]],
  [
    'Analysed',
    [
      { type: 'Analyzed', status: 'True' },
      { type: 'Executed', status: 'True', reason: 'Skipped' },
      { type: 'Verified', status: 'True', reason: 'Skipped' },
    ],
  ],
  ['Proposed', [{ type: 'Analyzed', status: 'True' }]],
  ['Approved', [{ type: 'Approved', status: 'True' }]],
  ['Denied', [{ type: 'Denied', status: 'True' }]],
])('does not invent execution from pre-execution %s', (_phase, conditions) => {
  expect(
    hasExecution({
      status: { conditions },
    } as LightspeedAgenticRun),
  ).toBe(false);
});

it.each(['Unknown', 'True', 'False'])(
  'retains execution evidence for Executed=%s regardless of later phases',
  (status) => {
    expect(
      hasExecution({
        status: {
          conditions: [
            { type: 'Executed', status },
            { type: 'Verified', status: 'False' },
            { type: 'Escalated', status: 'Unknown' },
          ],
        },
      } as LightspeedAgenticRun),
    ).toBe(true);
  },
);

it.each([
  { evidence: 'sandbox', step: { sandbox: { claimName: 'execution-claim' } } },
  { evidence: 'results', step: { results: [{ name: 'execution-result' }] } },
  {
    evidence: 'step condition',
    step: { conditions: [{ type: 'Started', status: 'True', reason: 'Started' }] },
  },
])('recognizes $evidence evidence without a top-level Executed condition', ({ step }) => {
  expect(hasExecution({ status: { steps: { execution: step } } } as LightspeedAgenticRun)).toBe(
    true,
  );
});

it('does not treat a Skipped-only execution step as execution evidence', () => {
  expect(
    hasExecution({
      status: {
        steps: {
          execution: {
            conditions: [{ type: 'Started', status: 'False', reason: 'Skipped' }],
          },
        },
      },
    } as LightspeedAgenticRun),
  ).toBe(false);
});
