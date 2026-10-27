/** @jest-environment jsdom */
import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AnalysisLogs, ExecutionLogs } from '../components/shared/ExecutionLogs';
import { useStepSandbox } from '../hooks/useExecutionSandbox';
import { useRetainedLogs } from '../hooks/useRetainedLogs';
import { useSandboxLogStream } from '../hooks/useSandboxLogStream';
import { LightspeedAgenticRun } from '../models/agenticrun';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (message: string) => message }) }));
jest.mock('../hooks/useExecutionSandbox');
jest.mock('../hooks/useRetainedLogs');
jest.mock('../hooks/useSandboxLogStream');
jest.mock('@patternfly/react-log-viewer', () => ({
  LogViewer: ({ data, toolbar }: { data: string; toolbar: React.ReactNode }) => (
    <div>
      <pre>{data}</pre>
      {toolbar}
    </div>
  ),
  LogViewerSearch: ({ 'aria-label': label }: { 'aria-label': string }) => (
    <input aria-label={label} />
  ),
}));
const sandbox = useStepSandbox as jest.Mock;
const retained = useRetainedLogs as jest.Mock;
const stream = useSandboxLogStream as jest.Mock;
const makeRun = (status = 'Unknown', generation = 1) =>
  ({
    metadata: { uid: 'uid', namespace: 'ns', generation },
    status: {
      conditions: [{ type: 'Analyzed', status, lastTransitionTime: '2026-10-27T02:00:00Z' }],
    },
  }) as LightspeedAgenticRun;
const open = () => fireEvent.click(screen.getByText('View analysis logs'));
beforeEach(() => {
  jest.clearAllMocks();
  sandbox.mockReturnValue({
    pod: { podName: 'analysis-pod', namespace: 'ns', sinceTime: 'start' },
    loading: false,
    retry: jest.fn(),
  });
  retained.mockReturnValue({ available: false, loading: false, lines: [], retry: jest.fn() });
  stream.mockReturnValue({
    lines: ['analysis output'],
    loading: false,
    state: 'streaming',
    revision: 0,
    retry: jest.fn(),
  });
});

it('waits before analysis starts without prematurely querying history', () => {
  const run = makeRun();
  run.status = {};
  sandbox.mockReturnValue({ loading: false, missing: true, retry: jest.fn() });
  render(<AnalysisLogs run={run} />);
  open();
  expect(screen.getByText('Waiting for analysis sandbox')).toBeTruthy();
  expect(retained.mock.calls.at(-1)?.slice(1)).toEqual([false, 'analysis']);
});

it('offers a separate analysis viewer and follows only while analysis is active', () => {
  const view = render(<AnalysisLogs run={makeRun()} />);
  expect(retained.mock.calls.at(-1)?.slice(1)).toEqual([false, 'analysis']);
  open();
  expect(sandbox.mock.calls.at(-1)?.slice(1)).toEqual([true, 'analysis']);
  expect(stream.mock.calls.at(-1)?.slice(1)).toEqual([true, true, 'start']);
  expect(screen.getByText('Streaming analysis logs')).toBeTruthy();
  expect(screen.getByRole('textbox', { name: 'Search analysis logs' })).toBeTruthy();
  view.rerender(<AnalysisLogs run={makeRun('True')} />);
  expect(screen.getByText('Hide analysis logs')).toBeTruthy();
  expect(retained.mock.calls.at(-1)?.slice(1)).toEqual([true, 'analysis']);
  expect(stream.mock.calls.at(-1)?.[2]).toBe(false);
});

it('uses retained analysis history after the pod expires and disables pod requests', () => {
  retained.mockReturnValue({
    available: true,
    loading: false,
    lines: ['retained analysis'],
    retry: jest.fn(),
  });
  sandbox.mockReturnValue({ loading: false, missing: true, retry: jest.fn() });
  render(<AnalysisLogs run={makeRun('True')} />);
  open();
  expect(screen.getByText('retained analysis')).toBeTruthy();
  expect(screen.getByText('Retained analysis history')).toBeTruthy();
  expect(
    screen.getByText('Retained history includes all analysis attempts for this run.'),
  ).toBeTruthy();
  expect(stream.mock.calls.at(-1)?.[1]).toBe(false);
});

it('preserves buffered output during history loading and switches sources without mixing', () => {
  const view = render(<AnalysisLogs run={makeRun()} />);
  open();
  retained.mockReturnValue({ available: true, loading: true, lines: [], retry: jest.fn() });
  view.rerender(<AnalysisLogs run={makeRun('True')} />);
  expect(screen.getByText('analysis output')).toBeTruthy();
  expect(screen.getByText(/Loading logs/)).toBeTruthy();
  expect(stream.mock.calls.at(-1)?.[1]).toBe(false);
  retained.mockReturnValue({
    available: true,
    loading: false,
    lines: ['saved analysis'],
    retry: jest.fn(),
  });
  view.rerender(<AnalysisLogs run={makeRun('True')} />);
  expect(screen.getByText('saved analysis')).toBeTruthy();
  expect(screen.queryByText('analysis output')).toBeNull();
});

it.each(['connecting', 'reconnecting', 'error'])(
  'labels analysis connection state %s and retries all sources',
  (state) => {
    const podRetry = jest.fn();
    const historyRetry = jest.fn();
    const discoveryRetry = jest.fn();
    sandbox.mockReturnValue({
      pod: { podName: 'analysis', namespace: 'ns' },
      loading: false,
      retry: discoveryRetry,
    });
    retained.mockReturnValue({ available: false, loading: false, lines: [], retry: historyRetry });
    stream.mockReturnValue({
      lines: ['buffered'],
      loading: false,
      state,
      error: 'connection detail',
      truncated: true,
      retry: podRetry,
    });
    render(<AnalysisLogs run={makeRun()} />);
    open();
    const label =
      state === 'connecting'
        ? 'Connecting to analysis logs'
        : state === 'reconnecting'
          ? 'Reconnecting to analysis logs'
          : 'Analysis log connection failed';
    expect(screen.getByText(label)).toBeTruthy();
    expect(
      screen.getByText('Log output was truncated to viewer line or text limits.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByText('Retry analysis logs'));
    expect(podRetry).toHaveBeenCalledTimes(1);
    expect(historyRetry).toHaveBeenCalledTimes(1);
    expect(discoveryRetry).toHaveBeenCalledTimes(1);
  },
);

it.each([
  { available: false, lines: [] },
  { available: true, lines: [] },
  { available: true, lines: ['partial'], error: 'collector forbidden' },
])('falls back to analysis pod logs for missing, empty or failed retention (%#)', (history) => {
  retained.mockReturnValue({ ...history, loading: false, retry: jest.fn() });
  render(<AnalysisLogs run={makeRun('True')} />);
  open();
  expect(screen.getByText('analysis output')).toBeTruthy();
  expect(screen.getByText('Pod analysis logs')).toBeTruthy();
  expect(stream.mock.calls.at(-1)?.[1]).toBe(true);
});

it('shows waiting, missing, connection errors and failed-analysis status distinctly', () => {
  sandbox.mockReturnValue({ loading: false, missing: true, retry: jest.fn() });
  stream.mockReturnValue({ lines: [], loading: false, state: 'idle', retry: jest.fn() });
  const run = makeRun();
  const view = render(<AnalysisLogs run={run} />);
  open();
  expect(screen.getByText('Waiting for analysis sandbox')).toBeTruthy();
  view.rerender(<AnalysisLogs run={makeRun('False')} />);
  expect(screen.getByText('Analysis pod is unavailable')).toBeTruthy();
  expect(screen.getByText('Analysis failed')).toBeTruthy();
  stream.mockReturnValue({
    lines: [],
    loading: false,
    state: 'error',
    error: 'HTTP 403',
    retry: jest.fn(),
  });
  view.rerender(<AnalysisLogs run={makeRun('False')} />);
  expect(screen.getByText('Some analysis logs could not be loaded')).toBeTruthy();
  expect(screen.getByText('Retry analysis logs')).toBeTruthy();
});

it('separates simultaneous analysis snapshots and live execution output', () => {
  sandbox.mockImplementation((_run, _active, phase) => ({
    pod: { podName: phase, namespace: 'ns' },
    loading: false,
    retry: jest.fn(),
  }));
  stream.mockImplementation((pod) => ({
    lines: [`${pod.podName} only`],
    loading: false,
    state: 'complete',
    retry: jest.fn(),
  }));
  const run = makeRun('True');
  run.status!.conditions!.push({
    type: 'Executed',
    status: 'Unknown',
    lastTransitionTime: '2026-10-27T03:00:00Z',
    message: '',
    reason: 'InProgress',
  });
  render(
    <>
      <AnalysisLogs run={run} />
      <ExecutionLogs run={run} />
    </>,
  );
  open();
  fireEvent.click(screen.getByText('View execution logs'));
  const analysis = within(screen.getByRole('region', { name: 'Analysis' }));
  const execution = within(screen.getByRole('region', { name: 'Execution' }));
  expect(analysis.getByText('analysis only')).toBeTruthy();
  expect(analysis.queryByText('execution only')).toBeNull();
  expect(execution.getByText('execution only')).toBeTruthy();
  const recent = stream.mock.calls.slice(-2);
  expect(recent.find(([pod]) => pod.podName === 'execution')?.[2]).toBe(true);
});

it('resets the viewer for a new analysis generation or active start, not normal completion', () => {
  const view = render(<AnalysisLogs run={makeRun()} />);
  open();
  view.rerender(<AnalysisLogs run={makeRun('True')} />);
  expect(screen.getByText('Hide analysis logs')).toBeTruthy();
  view.rerender(<AnalysisLogs run={makeRun('Unknown', 2)} />);
  expect(screen.getByText('View analysis logs')).toBeTruthy();
  open();
  const retry = makeRun('Unknown', 2);
  retry.status!.conditions![0].lastTransitionTime = '2026-10-27T03:00:00Z';
  view.rerender(<AnalysisLogs run={retry} />);
  expect(screen.getByText('View analysis logs')).toBeTruthy();
  open();
  const replacement = {
    ...retry,
    status: {
      ...retry.status,
      steps: { analysis: { sandbox: { claimName: 'replacement', namespace: 'ns' } } },
    },
  };
  view.rerender(<AnalysisLogs run={replacement} />);
  expect(screen.getByText('View analysis logs')).toBeTruthy();
});
