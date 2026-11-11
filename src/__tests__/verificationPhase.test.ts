import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import { LightspeedAgenticRun } from '../models/agenticrun';
import { discoverStepPod } from '../utils/execution';
import {
  getLogCondition,
  getStepLogIdentity,
  hasStepLogs,
  isLogStreaming,
} from '../utils/logPhase';
import { parseRetainedLogsPage } from '../utils/retainedLogs';

const run = (status = 'Unknown') =>
  ({
    metadata: { uid: 'run', namespace: 'ns' },
    spec: { analysis: {}, execution: {}, verification: {} },
    status: {
      conditions: [
        { type: 'Analyzed', status: 'True' },
        { type: 'Executed', status: 'True' },
        { type: 'Verified', status },
      ],
      steps: { verification: { sandbox: { claimName: 'verification-pod', namespace: 'ns' } } },
    },
  }) as LightspeedAgenticRun;

it.each(['Unknown', 'True', 'False'])(
  'uses only verification evidence and streams while active (%s)',
  (status) => {
    expect(getLogCondition(run(status), 'verification')?.status).toBe(status);
    expect(hasStepLogs(run(status), 'verification')).toBe(true);
    expect(isLogStreaming(run(status), 'verification')).toBe(status === 'Unknown');
    expect(isLogStreaming(run(status), 'execution')).toBe(false);
    expect(getStepLogIdentity(run(status), 'verification')).not.toBe(
      getStepLogIdentity(run(status), 'execution'),
    );
  },
);

it('does not treat a verification configuration or a skipped condition as verification output', () => {
  const pending = run();
  pending.status = {};
  expect(hasStepLogs(pending, 'verification')).toBe(false);
  pending.status = {
    conditions: [
      {
        type: 'Verified',
        status: 'True',
        reason: 'Skipped',
        message: '',
        lastTransitionTime: '2026-10-29T12:00:00Z',
      },
    ],
  };
  expect(hasStepLogs(pending, 'verification')).toBe(false);
  expect(isLogStreaming(pending, 'verification')).toBe(false);
});

it('discovers only the verification pod and scopes logs to its own start', async () => {
  const current = run();
  current.status!.steps!.verification!.conditions = [
    {
      type: 'Started',
      status: 'True',
      reason: 'Started',
      message: '',
      lastTransitionTime: '2026-10-29T12:00:00Z',
    },
  ];
  (consoleFetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      items: [
        ...['execution', 'verification'].map((phase) => ({
          metadata: {
            name: 'verification-pod',
            uid: `${phase}-uid`,
            labels: { 'agentic.openshift.io/run': 'run', 'agentic.openshift.io/step': phase },
          },
          spec: { containers: [{ name: 'agent' }] },
          status: { phase: 'Running', startTime: '2026-10-29T11:00:00Z' },
        })),
      ],
    }),
  });
  await expect(
    discoverStepPod(current, new AbortController().signal, 'verification'),
  ).resolves.toMatchObject({
    podName: 'verification-pod',
    podUid: 'verification-uid',
    sinceTime: '2026-10-29T12:00:00Z',
  });
});

it('accepts retained verification history and rejects records from another phase', () => {
  const page = {
    agentic_run_id: 'run',
    has_more: false,
    records: [
      {
        id: 1,
        timestamp: '2026-10-29T12:00:00Z',
        event: 'INFO',
        phase: 'verification',
        body: { msg: 'Checking target version' },
      },
    ],
  };
  expect(parseRetainedLogsPage(page, 'run', 0, 'verification')).toEqual(page);
  expect(parseRetainedLogsPage(page, 'run', 0, 'execution')).toBeUndefined();
});
