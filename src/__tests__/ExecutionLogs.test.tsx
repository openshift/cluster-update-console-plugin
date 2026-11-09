/** @jest-environment jsdom */
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ExecutionLogs } from '../components/shared/ExecutionLogs';
import { useRetainedLogs } from '../hooks/useRetainedLogs';
import { useSandboxLogStream } from '../hooks/useSandboxLogStream';
import { useStepSandbox } from '../hooks/useExecutionSandbox';
import { LightspeedAgenticRun } from '../models/agenticrun';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (message: string, values?: Record<string, string>) =>
      message.replace(/{{(\w+)}}/g, (_match, key) => values?.[key] ?? ''),
  }),
}));
jest.mock('../hooks/useRetainedLogs');
jest.mock('../hooks/useSandboxLogStream');
jest.mock('../hooks/useExecutionSandbox');
jest.mock('@patternfly/react-log-viewer', () => ({
  LogViewer: ({
    data,
    toolbar,
    footer,
    innerRef,
    onScroll,
  }: {
    data: string;
    toolbar: React.ReactNode;
    footer: React.ReactNode;
    innerRef: React.Ref<{ scrollToItem: (index: number) => void }>;
    onScroll: typeof mockViewerOnScroll;
  }) => {
    React.useImperativeHandle(innerRef, () => ({ scrollToItem: mockScrollToItem }));
    mockViewerOnScroll = onScroll;
    return (
      <div>
        <pre>{data}</pre>
        {toolbar}
        {footer}
      </div>
    );
  },
  LogViewerSearch: ({
    placeholder,
    'aria-label': label,
    nextNavigationButtonAriaLabel,
    previousNavigationButtonAriaLabel,
    resetButtonLabel,
    resultsCountContext,
  }: {
    placeholder: string;
    'aria-label'?: string;
    nextNavigationButtonAriaLabel?: string;
    previousNavigationButtonAriaLabel?: string;
    resetButtonLabel?: string;
    resultsCountContext?: string;
  }) => (
    <div>
      <input placeholder={placeholder} aria-label={label} />
      <button aria-label={previousNavigationButtonAriaLabel}>Previous</button>
      <button aria-label={nextNavigationButtonAriaLabel}>Next</button>
      <button>{resetButtonLabel}</button>
      <span>{resultsCountContext}</span>
    </div>
  ),
}));

const retained = useRetainedLogs as jest.Mock;
const stream = useSandboxLogStream as jest.Mock;
const sandbox = useStepSandbox as jest.Mock;
const retainedRetry = jest.fn();
const sandboxRetry = jest.fn();
const podRetry = jest.fn();
const mockScrollToItem = jest.fn();
let mockViewerOnScroll: (event: {
  scrollOffsetToBottom: number;
  scrollUpdateWasRequested: boolean;
}) => void;
const run = (conditions: unknown[]) =>
  ({
    metadata: { uid: 'run-uid' },
    status: {
      conditions,
      steps: { execution: { sandbox: { claimName: 'claim', namespace: 'ns' } } },
    },
  }) as LightspeedAgenticRun;

beforeEach(() => {
  jest.clearAllMocks();
  retained.mockReturnValue({ available: false, lines: [], loading: false, retry: retainedRetry });
  stream.mockReturnValue({
    lines: [],
    loading: false,
    state: 'idle',
    revision: 0,
    truncated: false,
    retry: podRetry,
  });
  sandbox.mockReturnValue({
    pod: {
      podName: 'resolved-pod',
      podUid: 'pod-uid',
      namespace: 'ns',
      sinceTime: '2026-10-27T01:00:00Z',
    },
    loading: false,
    retry: sandboxRetry,
  });
});

it('does no log I/O while collapsed and streams immediately without retention gating', () => {
  render(<ExecutionLogs run={run([{ type: 'Executed', status: 'Unknown' }])} />);
  expect(retained).toHaveBeenLastCalledWith('run-uid', false, 'execution');
  expect(stream.mock.calls.at(-1)?.[1]).toBe(false);
  expect(screen.queryByPlaceholderText('Search execution logs')).toBeNull();
  fireEvent.click(screen.getByText('View execution logs'));
  expect(stream.mock.calls.at(-1)?.slice(1)).toEqual([true, true, '2026-10-27T01:00:00Z']);
  expect(retained).toHaveBeenLastCalledWith('run-uid', false, 'execution');
  expect(screen.getByRole('textbox', { name: 'Search execution logs' })).toBeTruthy();
});

it('provides accessible search, navigation, reset and results-context labels', () => {
  render(<ExecutionLogs run={run([{ type: 'Executed', status: 'Unknown' }])} />);
  fireEvent.click(screen.getByText('View execution logs'));
  expect(
    screen.getByRole('textbox', { name: 'Search execution logs' }).getAttribute('aria-label'),
  ).toBe('Search execution logs');
  expect(screen.getByRole('button', { name: 'Next matching log line' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Previous matching log line' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Clear log search' })).toBeTruthy();
  expect(screen.getByText('Matching log lines').textContent).toBe(' Matching log lines');
});

it.each([
  [{ type: 'Executed', status: 'True' }],
  [
    { type: 'Executed', status: 'True' },
    { type: 'Verified', status: 'Unknown' },
  ],
  [
    { type: 'Executed', status: 'True' },
    { type: 'Verified', status: 'True' },
  ],
  [{ type: 'Executed', status: 'False' }],
  [
    { type: 'Executed', status: 'True' },
    { type: 'Escalated', status: 'Unknown' },
  ],
  [
    { type: 'Executed', status: 'True' },
    { type: 'Escalated', status: 'True' },
  ],
])('keeps nonstreaming logs available in later lifecycle %#', (...conditions) => {
  render(<ExecutionLogs run={run(conditions)} />);
  fireEvent.click(screen.getByText('View execution logs'));
  expect(retained).toHaveBeenLastCalledWith('run-uid', true, 'execution');
  expect(stream.mock.calls.at(-1)?.[2]).toBe(false);
});

it('uses nonempty successful retained history even with no pod', () => {
  retained.mockReturnValue({
    available: true,
    lines: ['retained execution'],
    loading: false,
    retry: retainedRetry,
  });
  sandbox.mockReturnValue({ loading: false, retry: sandboxRetry });
  render(<ExecutionLogs run={run([{ type: 'Executed', status: 'True' }])} />);
  fireEvent.click(screen.getByText('View execution logs'));
  expect(screen.getByText('retained execution')).toBeTruthy();
  expect(screen.getByText('Retained execution history')).toBeTruthy();
  expect(stream.mock.calls.at(-1)?.[1]).toBe(false);
});

it.each([
  { description: 'successful empty', lines: [], error: undefined },
  { description: 'errored empty', lines: [], error: 'HTTP 503' },
  { description: 'errored nonempty', lines: ['incomplete retained line'], error: 'HTTP 503' },
])(
  'falls back for $description retained responses and preserves usable pod logs',
  ({ lines, error }) => {
    retained.mockReturnValue({
      available: true,
      lines,
      loading: false,
      error,
      retry: retainedRetry,
    });
    stream.mockReturnValue({
      lines: ['usable pod line'],
      loading: false,
      state: 'reconnecting',
      error: 'Network disconnected',
      revision: 1,
      truncated: true,
      retry: podRetry,
    });
    render(<ExecutionLogs run={run([{ type: 'Executed', status: 'True' }])} />);
    fireEvent.click(screen.getByText('View execution logs'));
    expect(stream.mock.calls.at(-1)?.[1]).toBe(true);
    expect(screen.getByText('usable pod line')).toBeTruthy();
    expect(screen.queryByText('incomplete retained line')).toBeNull();
    expect(screen.queryByText('Retained execution history')).toBeNull();
    expect(screen.getByText('Some execution logs could not be loaded')).toBeTruthy();
    fireEvent.click(screen.getByText('Retry execution logs'));
    expect(sandboxRetry).toHaveBeenCalledTimes(1);
    expect(retainedRetry).toHaveBeenCalledTimes(1);
    expect(podRetry).toHaveBeenCalledTimes(1);
  },
);

it('does not relabel successful execution as failed when verification fails', () => {
  render(
    <ExecutionLogs
      run={run([
        { type: 'Executed', status: 'True' },
        { type: 'Verified', status: 'False' },
      ])}
    />,
  );
  expect(screen.getByRole('button', { name: 'View execution logs' })).toBeTruthy();
  expect(screen.queryByText('Execution completed; see run status for verification')).toBeNull();
  expect(screen.queryByText('Execution failed')).toBeNull();
});

it('shows loading and completion without hiding buffered live lines on source transition', () => {
  stream.mockReturnValue({
    lines: ['last live line'],
    loading: false,
    state: 'streaming',
    revision: 1,
    retry: podRetry,
  });
  const view = render(<ExecutionLogs run={run([{ type: 'Executed', status: 'Unknown' }])} />);
  fireEvent.click(screen.getByText('View execution logs'));
  retained.mockReturnValue({ available: false, lines: [], loading: true, retry: retainedRetry });
  view.rerender(<ExecutionLogs run={run([{ type: 'Executed', status: 'True' }])} />);
  expect(screen.getByText('last live line')).toBeTruthy();
  expect(stream.mock.calls.at(-1)?.[1]).toBe(false);
  expect(screen.getByRole('status').textContent).toContain('Loading logs...');
  retained.mockReturnValue({ available: false, lines: [], loading: false, retry: retainedRetry });
  stream.mockReturnValue({
    ...stream.mock.results.at(-1)?.value,
    state: 'complete',
  });
  view.rerender(<ExecutionLogs run={run([{ type: 'Executed', status: 'True' }])} />);
  expect(screen.getByText('last live line')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('Execution logs loaded');
  expect(screen.getByRole('status').textContent).not.toContain('Loading logs...');
});

it('follows updates, ignores programmatic scrolling, and pauses and resumes for user scrolling', () => {
  const execution = run([{ type: 'Executed', status: 'Unknown' }]);
  const showLines = (lines: string[]) =>
    stream.mockReturnValue({
      lines,
      loading: false,
      state: 'streaming',
      revision: 0,
      retry: podRetry,
    });
  showLines(['first']);
  const view = render(<ExecutionLogs run={execution} />);
  expect(mockScrollToItem).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('View execution logs'));
  expect(mockScrollToItem).toHaveBeenLastCalledWith(0);
  showLines(['first', 'second']);
  view.rerender(<ExecutionLogs run={execution} />);
  expect(mockScrollToItem).toHaveBeenLastCalledWith(1);
  act(() => mockViewerOnScroll({ scrollOffsetToBottom: 100, scrollUpdateWasRequested: true }));
  expect(screen.queryByRole('button', { name: 'Resume auto-scroll' })).toBeNull();
  showLines(['first', 'second', 'third']);
  view.rerender(<ExecutionLogs run={execution} />);
  expect(mockScrollToItem).toHaveBeenLastCalledWith(2);
  act(() => mockViewerOnScroll({ scrollOffsetToBottom: 100, scrollUpdateWasRequested: false }));
  const callsBeforePause = mockScrollToItem.mock.calls.length;
  showLines(['first', 'second', 'third', 'fourth']);
  view.rerender(<ExecutionLogs run={execution} />);
  expect(mockScrollToItem).toHaveBeenCalledTimes(callsBeforePause);
  fireEvent.click(screen.getByRole('button', { name: 'Resume auto-scroll' }));
  expect(mockScrollToItem).toHaveBeenCalledTimes(callsBeforePause + 1);
  expect(mockScrollToItem).toHaveBeenLastCalledWith(3);
  expect(screen.queryByRole('button', { name: 'Resume auto-scroll' })).toBeNull();
  act(() => mockViewerOnScroll({ scrollOffsetToBottom: 100, scrollUpdateWasRequested: false }));
  act(() => mockViewerOnScroll({ scrollOffsetToBottom: 0, scrollUpdateWasRequested: false }));
  expect(mockScrollToItem).toHaveBeenCalledTimes(callsBeforePause + 2);
  expect(screen.queryByRole('button', { name: 'Resume auto-scroll' })).toBeNull();
});

it('keeps following changed output at the 20000-line cap even when line count is unchanged', () => {
  const execution = run([{ type: 'Executed', status: 'Unknown' }]);
  const lines = Array.from({ length: 20000 }, (_value, index) => `line ${index}`);
  stream.mockReturnValue({
    lines,
    loading: false,
    state: 'streaming',
    revision: 0,
    retry: podRetry,
  });
  const view = render(<ExecutionLogs run={execution} />);
  fireEvent.click(screen.getByText('View execution logs'));
  expect(mockScrollToItem).toHaveBeenCalledTimes(1);
  expect(mockScrollToItem).toHaveBeenLastCalledWith(19999);
  stream.mockReturnValue({
    lines: [...lines.slice(1), 'newest line'],
    loading: false,
    state: 'streaming',
    revision: 0,
    retry: podRetry,
  });
  view.rerender(<ExecutionLogs run={execution} />);
  expect(mockScrollToItem).toHaveBeenCalledTimes(2);
  expect(mockScrollToItem).toHaveBeenLastCalledWith(19999);
  expect(screen.getByText(/newest line/).textContent).toContain('newest line');
});

it.each([
  { state: 'connecting', text: 'Connecting to execution logs', loading: true },
  { state: 'reconnecting', text: 'Reconnecting to execution logs', loading: false },
  { state: 'complete', text: 'Execution logs loaded', loading: false },
])(
  'displays the $state connection state without hiding buffered output',
  ({ state, text, loading }) => {
    stream.mockReturnValue({
      lines: ['buffered output'],
      loading,
      state,
      revision: 0,
      retry: podRetry,
    });
    render(
      <ExecutionLogs
        run={run([{ type: 'Executed', status: state === 'complete' ? 'True' : 'Unknown' }])}
      />,
    );
    fireEvent.click(screen.getByText('View execution logs'));
    expect(screen.getByRole('status').textContent).toContain(text);
    expect(screen.getByText('buffered output')).toBeTruthy();
  },
);

it.each([
  { executed: 'Unknown', text: 'Waiting for execution sandbox' },
  { executed: 'True', text: 'Execution pod is unavailable' },
])('displays $text when the pod is missing', ({ executed, text }) => {
  sandbox.mockReturnValue({ missing: true, loading: false, retry: sandboxRetry });
  render(<ExecutionLogs run={run([{ type: 'Executed', status: executed }])} />);
  fireEvent.click(screen.getByText('View execution logs'));
  expect(screen.getByRole('status').textContent).toContain(text);
  expect(stream.mock.calls.at(-1)?.[1]).toBe(false);
});

it('shows initial loading and then an honestly empty completed snapshot', () => {
  stream.mockReturnValue({ lines: [], loading: true, state: 'connecting', retry: podRetry });
  const execution = run([{ type: 'Executed', status: 'True' }]);
  const view = render(<ExecutionLogs run={execution} />);
  fireEvent.click(screen.getByText('View execution logs'));
  expect(screen.getByRole('status').textContent).toContain('Loading logs...');
  expect(screen.queryByText('No execution logs available.')).toBeNull();
  stream.mockReturnValue({ lines: [], loading: false, state: 'complete', retry: podRetry });
  view.rerender(<ExecutionLogs run={execution} />);
  expect(screen.getByRole('status').textContent).toContain('Execution logs loaded');
  expect(screen.getByText('No execution logs available.')).toBeTruthy();
  expect(screen.queryByText('Loading logs...')).toBeNull();
});

it('shows execution-failure details independently of log connection failure', () => {
  stream.mockReturnValue({
    lines: ['saved output'],
    loading: false,
    state: 'error',
    error: 'HTTP 403',
    retry: podRetry,
  });
  render(
    <ExecutionLogs
      run={run([{ type: 'Executed', status: 'False', message: 'Update command exited 1' }])}
    />,
  );
  fireEvent.click(screen.getByText('View execution logs'));
  expect(screen.getByText('Execution failed')).toBeTruthy();
  expect(screen.getByText('Update command exited 1')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('Execution log connection failed');
  expect(screen.getByText('HTTP 403')).toBeTruthy();
  expect(screen.getByText('saved output')).toBeTruthy();
});

it.each(['pod', 'retained'])('discloses truncated %s output', (source) => {
  if (source === 'retained') {
    retained.mockReturnValue({
      available: true,
      lines: ['retained output'],
      loading: false,
      truncated: true,
      retry: retainedRetry,
    });
  } else {
    stream.mockReturnValue({
      lines: ['pod output'],
      loading: false,
      state: 'complete',
      truncated: true,
      retry: podRetry,
    });
  }
  render(<ExecutionLogs run={run([{ type: 'Executed', status: 'True' }])} />);
  fireEvent.click(screen.getByText('View execution logs'));
  expect(screen.getByText('Log output was truncated to viewer line or text limits.')).toBeTruthy();
});
