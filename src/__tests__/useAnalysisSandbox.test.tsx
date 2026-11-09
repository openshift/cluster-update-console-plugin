/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useStepSandbox } from '../hooks/useExecutionSandbox';
import { useLogIdentity } from '../hooks/useLogIdentity';
import { discoverStepPod } from '../utils/execution';
import { LightspeedAgenticRun } from '../models/agenticrun';
import { LogPhase } from '../utils/logPhase';

jest.mock('../utils/execution', () => ({ discoverStepPod: jest.fn() }));
const discover = discoverStepPod as jest.Mock;
const makeRun = (status = 'Unknown', generation = 1, start = '2026-10-27T02:00:00Z') =>
  ({
    metadata: { uid: 'run', namespace: 'ns', generation },
    status: {
      conditions: [{ type: 'Analyzed', status, lastTransitionTime: start }],
      steps: { analysis: { sandbox: { claimName: 'claim', namespace: 'ns' } } },
    },
  }) as LightspeedAgenticRun;
const pod = {
  namespace: 'ns',
  podName: 'analysis-pod',
  podUid: 'pod',
  sinceTime: '2026-10-27T02:00:00Z',
};
beforeEach(() => discover.mockReset());
afterEach(() => jest.useRealTimers());

it('polls during analysis, preserves start through terminal handoff, then stops polling', async () => {
  jest.useFakeTimers();
  discover.mockResolvedValueOnce(undefined).mockResolvedValue(pod);
  const view = renderHook(({ status }) => useStepSandbox(makeRun(status), true, 'analysis'), {
    initialProps: { status: 'Unknown' },
  });
  await act(async () => {});
  expect(view.result.current.missing).toBe(true);
  await act(async () => jest.advanceTimersByTime(3000));
  expect(view.result.current.pod).toEqual(pod);
  expect(discover.mock.calls.at(-1)?.slice(2)).toEqual(['analysis', '2026-10-27T02:00:00Z']);
  view.rerender({ status: 'True' });
  await act(async () => {});
  expect(discover.mock.calls.at(-1)?.slice(2)).toEqual(['analysis', '2026-10-27T02:00:00Z']);
  const calls = discover.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(12000));
  expect(discover).toHaveBeenCalledTimes(calls);
});

it.each(['generation', 'start', 'phase', 'run', 'sandbox'] as const)(
  'isolates a pending old discovery on %s change',
  async (change) => {
    let finish!: (value: typeof pod) => void;
    discover
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      )
      .mockResolvedValueOnce({ ...pod, podUid: 'new' });
    const original = makeRun();
    const view = renderHook(
      ({ run, phase }: { run: LightspeedAgenticRun; phase: LogPhase }) =>
        useStepSandbox(run, true, phase),
      {
        initialProps: { run: original, phase: 'analysis' },
      },
    );
    const signal = discover.mock.calls[0][1] as AbortSignal;
    const next = makeRun(
      'Unknown',
      change === 'generation' ? 2 : 1,
      change === 'start' ? '2026-10-27T03:00:00Z' : '2026-10-27T02:00:00Z',
    );
    if (change === 'run') next.metadata!.uid = 'next';
    if (change === 'sandbox') next.status!.steps!.analysis!.sandbox!.claimName = 'replacement';
    view.rerender({ run: next, phase: change === 'phase' ? 'execution' : 'analysis' });
    expect(signal.aborted).toBe(true);
    expect(view.result.current.pod).toBeUndefined();
    await waitFor(() => expect(view.result.current.pod?.podUid).toBe('new'));
    await act(async () => finish(pod));
    expect(view.result.current.pod?.podUid).toBe('new');
  },
);

it('retains an analysis start across completion but resets it for a new generation', () => {
  const view = renderHook(({ run }) => useLogIdentity(run, 'analysis'), {
    initialProps: { run: makeRun() },
  });
  const identity = view.result.current.identity;
  view.rerender({ run: makeRun('True') });
  expect(view.result.current.identity).toBe(identity);
  expect(view.result.current.analysisStart).toBe('2026-10-27T02:00:00Z');
  view.rerender({ run: makeRun('True', 2) });
  expect(view.result.current.identity).not.toBe(identity);
  expect(view.result.current.analysisStart).toBeUndefined();
});

it('cancels pending analysis discovery on collapse and allows retry after errors', async () => {
  discover.mockRejectedValueOnce(new Error('HTTP 403')).mockReturnValueOnce(new Promise(() => {}));
  const view = renderHook(({ active }) => useStepSandbox(makeRun(), active, 'analysis'), {
    initialProps: { active: true },
  });
  await waitFor(() => expect(view.result.current.error).toBe('HTTP 403'));
  act(() => view.result.current.retry());
  const signal = discover.mock.calls.at(-1)?.[1] as AbortSignal;
  view.rerender({ active: false });
  expect(signal.aborted).toBe(true);
});
