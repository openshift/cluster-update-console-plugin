import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import { LightspeedAgenticRun } from '../models/agenticrun';
import { discoverStepPod } from '../utils/execution';
import { getStepLogIdentity, hasStepLogs, isLogStreaming } from '../utils/logPhase';
import { parseRetainedLogsPage } from '../utils/retainedLogs';

const fetchMock = consoleFetch as jest.Mock;
const run = (status = 'Unknown') =>
  ({
    metadata: { uid: 'run', namespace: 'ns', generation: 2 },
    spec: { analysis: {} },
    status: {
      conditions: [{ type: 'Analyzed', status, lastTransitionTime: '2026-10-27T02:00:00Z' }],
      steps: { analysis: { sandbox: { claimName: 'analysis-claim', namespace: 'ns' } } },
    },
  }) as LightspeedAgenticRun;
const response = (body: unknown, status = 200) => ({
  ok: status === 200,
  status,
  json: async () => body,
});
const pod = {
  metadata: {
    name: 'actual-analysis-pod',
    uid: 'pod',
    ownerReferences: [{ kind: 'Sandbox', uid: 'sandbox', apiVersion: 'agents.x-k8s.io/v1beta1' }],
  },
  spec: { containers: [{ name: 'analysis-agent' }] },
  status: { startTime: '2026-10-27T01:00:00Z' },
};

beforeEach(() => fetchMock.mockReset());

it.each([
  ['2026-10-27T03:00:00Z', '2026-10-27T02:00:00Z', '2026-10-27T03:00:00Z'],
  ['2026-10-27T01:00:00Z', 'invalid', '2026-10-27T01:00:00Z'],
  [undefined, undefined, undefined],
])('uses valid analysis/pod boundaries (%s, %s)', async (podStart, activeStart, expected) => {
  const current = run();
  current.status!.conditions![0].lastTransitionTime = activeStart as string;
  fetchMock.mockResolvedValueOnce(
    response({
      items: [
        {
          ...pod,
          metadata: {
            ...pod.metadata,
            name: 'analysis-claim',
            ownerReferences: [],
            labels: {
              'agentic.openshift.io/run': 'run',
              'agentic.openshift.io/step': 'analysis',
            },
          },
          status: { startTime: podStart },
        },
      ],
    }),
  );
  expect(
    (await discoverStepPod(current, new AbortController().signal, 'analysis'))?.sinceTime,
  ).toBe(expected);
});

it('makes analysis logs available independently of execution evidence, even while waiting', () => {
  const waiting = run();
  waiting.status = {};
  expect(hasStepLogs(waiting, 'analysis')).toBe(true);
  expect(hasStepLogs(waiting, 'execution')).toBe(false);
});

it.each(['True', 'False'])(
  'keeps completed or failed analysis visible (%s) without execution',
  (status) => {
    expect(hasStepLogs(run(status), 'analysis')).toBe(true);
    expect(isLogStreaming(run(status), 'analysis')).toBe(false);
  },
);

it('streams only active analysis and does not follow it while execution runs or after denial', () => {
  expect(isLogStreaming(run(), 'analysis')).toBe(true);
  const executing = run('True');
  executing.status!.conditions!.push({
    type: 'Executed',
    status: 'Unknown',
    lastTransitionTime: '2026-10-27T03:00:00Z',
    message: '',
    reason: 'InProgress',
  });
  expect(isLogStreaming(executing, 'analysis')).toBe(false);
  expect(isLogStreaming(executing, 'execution')).toBe(true);
  const denied = run();
  denied.status!.conditions!.push({
    type: 'Denied',
    status: 'True',
    lastTransitionTime: '2026-10-27T03:00:00Z',
    message: '',
    reason: 'Denied',
  });
  expect(isLogStreaming(denied, 'analysis')).toBe(false);
});

it('isolates generation, phase and sandbox identity without resetting for completion alone', () => {
  expect(getStepLogIdentity(run(), 'analysis')).toBe(getStepLogIdentity(run('True'), 'analysis'));
  const revised = run();
  revised.metadata!.generation = 3;
  expect(getStepLogIdentity(revised, 'analysis')).not.toBe(getStepLogIdentity(run(), 'analysis'));
  expect(getStepLogIdentity(run(), 'analysis')).not.toBe(getStepLogIdentity(run(), 'execution'));
});

it('resolves an analysis claim through owner UIDs and scopes old-pod reads to analysis start', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ items: [] }))
    .mockResolvedValueOnce(response({ metadata: { uid: 'claim-uid' } }))
    .mockResolvedValueOnce(
      response({
        items: [
          {
            metadata: {
              uid: 'sandbox',
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
    .mockResolvedValueOnce(
      response({
        items: [
          pod,
          { ...pod, metadata: { ...pod.metadata, name: 'unrelated', ownerReferences: [] } },
        ],
      }),
    );
  await expect(
    discoverStepPod(run(), new AbortController().signal, 'analysis'),
  ).resolves.toMatchObject({
    podName: 'actual-analysis-pod',
    podUid: 'pod',
    container: 'analysis-agent',
    sinceTime: '2026-10-27T02:00:00Z',
  });
  expect(fetchMock.mock.calls[0][0]).toContain('step%3Danalysis');
  expect(fetchMock.mock.calls[1][0]).toContain('/sandboxclaims/analysis-claim');
});

it('accepts only analysis bare-pod labels, not a same-name execution pod', async () => {
  const bare = (phase: string, uid: string) => ({
    ...pod,
    metadata: {
      name: 'analysis-claim',
      uid,
      labels: {
        'agentic.openshift.io/run': 'run',
        'agentic.openshift.io/step': phase,
      },
    },
  });
  fetchMock.mockResolvedValueOnce(
    response({ items: [bare('execution', 'wrong'), bare('analysis', 'right')] }),
  );
  expect(
    (await discoverStepPod(run('True'), new AbortController().signal, 'analysis'))?.podUid,
  ).toBe('right');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each([404, 403])('settles missing/forbidden analysis claims (%s)', async (status) => {
  fetchMock
    .mockResolvedValueOnce(response({ items: [] }))
    .mockResolvedValueOnce(response({}, status));
  const result = discoverStepPod(run(), new AbortController().signal, 'analysis');
  if (status === 404) await expect(result).resolves.toBeUndefined();
  else await expect(result).rejects.toThrow('HTTP 403');
});

it('validates the requested retained phase and rejects cross-phase records', () => {
  const record = { id: 1, timestamp: 'time', event: 'log', phase: 'analysis', body: 'analysis' };
  const page = { agentic_run_id: 'run', has_more: false, records: [record] };
  expect(parseRetainedLogsPage(page, 'run', 0, 'analysis')).toBeDefined();
  expect(parseRetainedLogsPage(page, 'run', 0, 'execution')).toBeUndefined();
  expect(
    parseRetainedLogsPage(
      { ...page, records: [{ ...record, phase: 'execution' }] },
      'run',
      0,
      'analysis',
    ),
  ).toBeUndefined();
});
