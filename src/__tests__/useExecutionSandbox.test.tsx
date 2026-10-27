/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useExecutionSandbox } from '../hooks/useExecutionSandbox';
import { discoverExecutionPod } from '../utils/execution';
import { LightspeedAgenticRun } from '../models/agenticrun';

jest.mock('../utils/execution', () => ({ discoverExecutionPod: jest.fn() }));
const discover = discoverExecutionPod as jest.Mock;
const makeRun = (uid = 'run-uid') =>
  ({
    metadata: { uid, namespace: 'ns' },
    status: { conditions: [{ type: 'Executed', status: 'True' }] },
  }) as LightspeedAgenticRun;
const pod = { namespace: 'ns', podName: 'pod', podUid: 'pod-uid' };

beforeEach(() => discover.mockReset());

it('does not discover while collapsed', () => {
  renderHook(() => useExecutionSandbox(makeRun(), false));
  expect(discover).not.toHaveBeenCalled();
});

it('resolves once after execution finishes, and cancels on collapse', async () => {
  discover.mockResolvedValue(pod);
  const hook = renderHook(({ active }) => useExecutionSandbox(makeRun(), active), {
    initialProps: { active: true },
  });
  await waitFor(() => expect(hook.result.current.pod).toEqual(pod));
  const signal = discover.mock.calls[0][1] as AbortSignal;
  hook.rerender({ active: false });
  expect(signal.aborted).toBe(true);
});

it('does not leak a previous run while new discovery is pending', async () => {
  discover.mockResolvedValueOnce(pod).mockReturnValueOnce(new Promise(() => {}));
  const hook = renderHook(({ uid }) => useExecutionSandbox(makeRun(uid), true), {
    initialProps: { uid: 'first' },
  });
  await waitFor(() => expect(hook.result.current.pod).toEqual(pod));
  hook.rerender({ uid: 'second' });
  expect(hook.result.current.pod).toBeUndefined();
  expect(hook.result.current.loading).toBe(true);
});

it('ignores a late result after identity changes', async () => {
  let finish!: (value: typeof pod) => void;
  discover
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    )
    .mockResolvedValueOnce({ ...pod, podUid: 'new' });
  const hook = renderHook(({ uid }) => useExecutionSandbox(makeRun(uid), true), {
    initialProps: { uid: 'first' },
  });
  hook.rerender({ uid: 'second' });
  await waitFor(() => expect(hook.result.current.pod?.podUid).toBe('new'));
  await act(async () => finish(pod));
  expect(hook.result.current.pod?.podUid).toBe('new');
});

it('exposes discovery errors and permits manual retry', async () => {
  discover.mockRejectedValueOnce(new Error('HTTP 403')).mockResolvedValueOnce(pod);
  const hook = renderHook(() => useExecutionSandbox(makeRun(), true));
  await waitFor(() => expect(hook.result.current.error).toBe('HTTP 403'));
  act(() => hook.result.current.retry());
  await waitFor(() => expect(hook.result.current.pod).toEqual(pod));
  expect(hook.result.current.error).toBeUndefined();
});

describe('execution-time discovery', () => {
  const executingRun = (claimName = 'claim', retryCount = 0) =>
    ({
      ...makeRun(),
      status: {
        conditions: [{ type: 'Executed', status: 'Unknown' }],
        steps: { execution: { sandbox: { claimName, namespace: 'ns' }, retryCount } },
      },
    }) as LightspeedAgenticRun;
  const advance = async (milliseconds: number) => {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(milliseconds);
    });
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('polls missing, ready, missing and replacement pods at three-second intervals', async () => {
    const replacement = { ...pod, podUid: 'replacement-uid' };
    let finish!: (value: typeof pod) => void;
    discover
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(pod)
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const hook = renderHook(() => useExecutionSandbox(executingRun(), true));
    expect(hook.result.current.loading).toBe(true);
    await advance(0);
    expect(discover).toHaveBeenCalledTimes(1);
    expect(hook.result.current).toMatchObject({ loading: false, missing: true });
    expect(hook.result.current.pod).toBeUndefined();
    await advance(2999);
    expect(discover).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(discover).toHaveBeenCalledTimes(2);
    expect(hook.result.current).toMatchObject({ pod, missing: false, loading: false });
    await advance(3000);
    expect(discover).toHaveBeenCalledTimes(3);
    expect(hook.result.current).toMatchObject({ pod, missing: true, loading: false });
    await advance(3000);
    expect(discover).toHaveBeenCalledTimes(4);
    expect(hook.result.current).toMatchObject({ pod, missing: true, loading: true });
    await act(async () => finish(replacement));
    expect(hook.result.current).toMatchObject({
      pod: replacement,
      missing: false,
      loading: false,
    });
    hook.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['collapse', 'unmount'])('aborts and removes scheduled polling on %s', async (action) => {
    discover.mockResolvedValue(pod);
    const hook = renderHook(({ active }) => useExecutionSandbox(executingRun(), active), {
      initialProps: { active: true },
    });
    await advance(0);
    const signal = discover.mock.calls[0][1] as AbortSignal;
    expect(jest.getTimerCount()).toBe(1);
    if (action === 'collapse') hook.rerender({ active: false });
    else hook.unmount();
    expect(signal.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    await advance(30000);
    expect(discover).toHaveBeenCalledTimes(1);
  });

  it.each(['collapse', 'unmount'])('ignores a pending refresh after %s', async (action) => {
    let finish!: (value: typeof pod) => void;
    discover.mockResolvedValueOnce(pod).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const hook = renderHook(({ active }) => useExecutionSandbox(executingRun(), active), {
      initialProps: { active: true },
    });
    await advance(0);
    await advance(3000);
    expect(discover).toHaveBeenCalledTimes(2);
    const signal = discover.mock.calls[1][1] as AbortSignal;
    if (action === 'collapse') hook.rerender({ active: false });
    else hook.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => finish({ ...pod, podUid: 'late-uid' }));
    if (action === 'collapse') {
      expect(hook.result.current.pod).toEqual(pod);
      expect(hook.result.current.loading).toBe(false);
    }
    await advance(30000);
    expect(discover).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('performs one final discovery on completion and stops polling', async () => {
    discover.mockResolvedValue(pod);
    const initialRun = executingRun();
    const hook = renderHook(({ run }) => useExecutionSandbox(run, true), {
      initialProps: { run: initialRun },
    });
    await advance(0);
    const signal = discover.mock.calls[0][1] as AbortSignal;
    hook.rerender({
      run: {
        ...initialRun,
        status: {
          ...initialRun.status,
          conditions: [
            {
              type: 'Executed',
              status: 'True',
              reason: 'Completed',
              message: '',
              lastTransitionTime: '2026-10-27T01:00:00Z',
            },
          ],
        },
      },
    });
    await advance(0);
    expect(signal.aborted).toBe(true);
    expect(discover).toHaveBeenCalledTimes(2);
    expect(hook.result.current).toMatchObject({ pod, missing: false, loading: false });
    await advance(30000);
    expect(discover).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([
    ['claim', 'replacement-claim', 0],
    ['retry', 'claim', 1],
  ])(
    'clears cached identity and ignores the previous refresh on a same-run %s switch',
    async (_change, claimName, retryCount) => {
      let finish!: (value: typeof pod) => void;
      const replacement = { ...pod, podUid: 'replacement-uid' };
      discover
        .mockResolvedValueOnce(pod)
        .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)))
        .mockResolvedValueOnce(replacement);
      const hook = renderHook(({ run }) => useExecutionSandbox(run, true), {
        initialProps: { run: executingRun() },
      });
      await advance(0);
      await advance(3000);
      const signal = discover.mock.calls[1][1] as AbortSignal;
      hook.rerender({ run: executingRun(claimName as string, retryCount as number) });
      expect(signal.aborted).toBe(true);
      expect(hook.result.current.pod).toBeUndefined();
      expect(hook.result.current.loading).toBe(true);
      await advance(0);
      expect(hook.result.current).toMatchObject({
        pod: replacement,
        loading: false,
        missing: false,
      });
      await act(async () => finish(pod));
      expect(hook.result.current.pod).toEqual(replacement);
      expect(discover).toHaveBeenCalledTimes(3);
      hook.unmount();
      expect(jest.getTimerCount()).toBe(0);
    },
  );
});
