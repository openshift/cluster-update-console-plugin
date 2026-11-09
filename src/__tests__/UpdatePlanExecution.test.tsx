/** @jest-environment jsdom */
import * as React from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { k8sDelete, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import UpdatePlanTab from '../components/update-plan/UpdatePlanTab';
import { LightspeedAgenticRun } from '../models/agenticrun';
import { useAnalysisResults } from '../hooks/useAgenticRuns';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (message: string, values?: Record<string, string>) =>
      message.replace(/{{(\w+)}}/g, (_match, key) => values?.[key] ?? ''),
  }),
}));
jest.mock('react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));
jest.mock('../hooks/useClusterVersion', () => ({
  useClusterVersion: () => [
    {
      spec: {},
      status: {
        desired: { version: '5.0.1', image: 'target' },
        history: [{ state: 'Completed', version: '5.0.1', image: 'target' }],
        conditions: [
          { type: 'Progressing', status: 'False' },
          { type: 'Available', status: 'True' },
        ],
      },
    },
    true,
    undefined,
  ],
}));
jest.mock('../hooks/useAgenticRuns', () => ({
  useAgenticRunApprovals: () => [[]],
  useAnalysisResults: jest.fn(() => [[]]),
}));
jest.mock('../hooks/useApprovalActions', () => ({
  useApprovalActions: () => ({ approveStage: jest.fn() }),
}));
jest.mock('../components/update-plan/ApprovalPolicyWarningBanner', () => ({ default: () => null }));
jest.mock('../components/update-plan/PlanHeader', () => ({ default: () => null }));
jest.mock('../components/shared/MarkdownContent', () => ({
  MarkdownContent: ({ text }: { text: string }) => <div>{text}</div>,
}));
jest.mock('../components/shared/PhaseLabel', () => ({ default: () => null }));
jest.mock('../components/shared/ExecutionLogs', () => ({
  ExecutionLogs: () => <div data-testid="execution-logs" />,
  AnalysisLogs: () => <div data-testid="analysis-logs" />,
  VerificationLogs: () => <div data-testid="verification-logs" />,
}));

const fixture = (conditions: unknown[]) =>
  ({
    metadata: { uid: 'uid', name: 'plan', namespace: 'ns' },
    status: { conditions, steps: { analysis: { results: [{ name: 'analysis' }] } } },
  }) as LightspeedAgenticRun;
const show = (run: LightspeedAgenticRun) => render(<UpdatePlanTab agenticRuns={[run]} />);

beforeEach(() => {
  (useAnalysisResults as jest.Mock).mockReturnValue([
    [
      {
        metadata: { name: 'analysis', namespace: 'ns' },
        status: { failureReason: 'analysis-only detail' },
      },
    ],
  ]);
});

it('preserves analysis failureReason for analysis failure and does not invent execution', () => {
  show(fixture([{ type: 'Analyzed', status: 'False', message: 'analysis condition' }]));
  expect(screen.getByText('Analysis failed')).toBeTruthy();
  expect(screen.getByText('analysis-only detail')).toBeTruthy();
  expect(screen.queryByTestId('execution-logs')).toBeNull();
  expect(screen.getByTestId('analysis-logs')).toBeTruthy();
});

it.each(['Unknown', 'True', 'False'])(
  'mounts analysis logs without execution evidence (%s)',
  (status) => {
    show(fixture([{ type: 'Analyzed', status }]));
    expect(screen.getByTestId('analysis-logs')).toBeTruthy();
    expect(screen.queryByTestId('execution-logs')).toBeNull();
    expect(screen.queryByText('View pod logs')).toBeNull();
  },
);

it.each([
  ['Executed', 'Execution'],
  ['Escalated', 'Escalation'],
])('uses the matching %s failure instead of stale analysis failureReason', (type, label) => {
  show(
    fixture([
      {
        type: 'Executed',
        status: type === 'Executed' ? 'False' : 'True',
        message: 'execution detail',
      },
      ...(type === 'Executed' ? [] : [{ type, status: 'False', message: 'later-stage detail' }]),
    ]),
  );
  expect(screen.getByText(`${label} failed`)).toBeTruthy();
  expect(
    screen.getByText(type === 'Executed' ? 'execution detail' : 'later-stage detail'),
  ).toBeTruthy();
  expect(screen.queryByText('analysis-only detail')).toBeNull();
  expect(screen.getByTestId('execution-logs')).toBeTruthy();
});

it.each([
  [{ type: 'Executed', status: 'Unknown' }],
  [{ type: 'Executed', status: 'True' }],
  [
    { type: 'Executed', status: 'True' },
    { type: 'Verified', status: 'Unknown' },
  ],
  [
    { type: 'Executed', status: 'True' },
    { type: 'Verified', status: 'True' },
  ],
  [
    { type: 'Executed', status: 'True' },
    { type: 'Escalated', status: 'Unknown' },
  ],
  [
    { type: 'Executed', status: 'True' },
    { type: 'Escalated', status: 'True' },
  ],
])('does not hide logs when the lifecycle advances %#', (...conditions) => {
  show(fixture(conditions));
  expect(screen.getByTestId('execution-logs')).toBeTruthy();
});

it('keeps logs mounted during verification with step-only execution evidence', () => {
  const run = fixture([{ type: 'Verified', status: 'Unknown' }]);
  run.status!.steps!.execution = { sandbox: { claimName: 'execution-claim', namespace: 'ns' } };
  show(run);
  expect(run.status?.conditions?.some((condition) => condition.type === 'Executed')).toBe(false);
  expect(screen.getByTestId('execution-logs')).toBeTruthy();
});

it('shows actions from the latest referenced execution attempt before the execution logs', () => {
  const run = fixture([{ type: 'Executed', status: 'True' }]);
  run.status!.steps!.execution = {
    results: [
      { name: 'execution-1', outcome: 'Failed' },
      { name: 'execution-2', outcome: 'Succeeded' },
    ],
  };
  (useK8sWatchResource as jest.Mock).mockReturnValue([
    {
      metadata: { name: 'execution-2', namespace: 'ns' },
      spec: { agenticRunName: 'plan' },
      status: {
        actionsTaken: [
          {
            type: 'mutation',
            description: 'Updated the cluster',
            outcome: 'Succeeded',
            output: 'OK',
          },
        ],
      },
    },
    true,
  ]);
  show(run);
  expect(useK8sWatchResource).toHaveBeenLastCalledWith(
    expect.objectContaining({ name: 'execution-2', namespace: 'ns' }),
  );
  const actionsToggle = screen.getByRole('button', { name: 'View action details' });
  expect(
    actionsToggle.compareDocumentPosition(screen.getByTestId('execution-logs')) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.click(actionsToggle);
  expect(screen.getByText('Updated the cluster')).toBeTruthy();
  expect((screen.getByRole('textbox', { name: 'Output' }) as HTMLInputElement).value).toBe('OK');
});

it('follows the active phase while preserving manual toggles across refreshes', () => {
  const analyzing = fixture([{ type: 'Analyzed', status: 'Unknown' }]);
  const { rerender } = show(analyzing);
  const analysisToggle = () => screen.getByRole('button', { name: /Update analysis/ });
  const executionToggle = () => screen.getByRole('button', { name: /Update execution/ });
  expect(analysisToggle().getAttribute('aria-expanded')).toBe('true');
  expect(executionToggle().getAttribute('aria-expanded')).toBe('false');

  fireEvent.click(analysisToggle());
  rerender(<UpdatePlanTab agenticRuns={[{ ...analyzing }]} />);
  expect(analysisToggle().getAttribute('aria-expanded')).toBe('false');

  const executing = fixture([
    { type: 'Analyzed', status: 'True' },
    { type: 'Executed', status: 'Unknown' },
  ]);
  rerender(<UpdatePlanTab agenticRuns={[executing]} />);
  expect(analysisToggle().getAttribute('aria-expanded')).toBe('false');
  expect(executionToggle().getAttribute('aria-expanded')).toBe('true');
  expect(within(analysisToggle()).getByRole('img', { name: 'Completed' })).toBeTruthy();
  expect(within(executionToggle()).getByRole('img', { name: 'Executing' })).toBeTruthy();

  fireEvent.click(analysisToggle());
  fireEvent.click(executionToggle());
  const completed = fixture([
    { type: 'Analyzed', status: 'True' },
    { type: 'Executed', status: 'True' },
    { type: 'Verified', status: 'True' },
  ]);
  rerender(<UpdatePlanTab agenticRuns={[completed]} />);
  expect(analysisToggle().getAttribute('aria-expanded')).toBe('false');
  expect(executionToggle().getAttribute('aria-expanded')).toBe('false');
  expect(within(executionToggle()).getByRole('img', { name: 'Completed' })).toBeTruthy();
  expect(
    screen.getByRole('button', { name: /Update verification/ }).getAttribute('aria-expanded'),
  ).toBe('true');
});

it('shows three sections for a pending run and resets expansion when selecting another version', () => {
  const pending = fixture([]);
  const executing = fixture([
    { type: 'Analyzed', status: 'True' },
    { type: 'Executed', status: 'Unknown' },
  ]);
  executing.metadata = { ...executing.metadata, uid: 'other-uid', name: 'other-plan' };
  render(<UpdatePlanTab agenticRuns={[pending, executing]} />);
  expect(
    screen.getByRole('button', { name: /Update analysis/ }).getAttribute('aria-expanded'),
  ).toBe('true');
  expect(
    screen.getByRole('button', { name: /Update execution/ }).getAttribute('aria-expanded'),
  ).toBe('false');
  expect(
    screen.getByRole('button', { name: /Update verification/ }).getAttribute('aria-expanded'),
  ).toBe('false');
  fireEvent.change(screen.getByRole('combobox', { name: 'Select agentic run' }), {
    target: { value: 'other-plan' },
  });
  expect(
    screen.getByRole('button', { name: /Update analysis/ }).getAttribute('aria-expanded'),
  ).toBe('false');
  expect(
    screen.getByRole('button', { name: /Update execution/ }).getAttribute('aria-expanded'),
  ).toBe('true');
});

it.each(['Unknown', 'True', 'False'])(
  'places verification logs in their own togglable section and preserves completed execution (%s)',
  (status) => {
    show(
      fixture([
        { type: 'Analyzed', status: 'True' },
        { type: 'Executed', status: 'True' },
        { type: 'Verified', status, message: 'Verification detail' },
      ]),
    );
    const execution = screen.getByRole('button', { name: /Update execution/ });
    const verification = screen.getByRole('button', { name: /Update verification/ });
    expect(within(execution).getByRole('img', { name: 'Completed' })).toBeTruthy();
    expect(
      within(verification).getByRole('img', {
        name: status === 'Unknown' ? 'Verifying' : status === 'True' ? 'Completed' : 'Failed',
      }),
    ).toBeTruthy();
    expect(verification.getAttribute('aria-expanded')).toBe('true');
    expect(
      within(screen.getByRole('region', { name: /Update verification/ })).getByTestId(
        'verification-logs',
      ),
    ).toBeTruthy();
    fireEvent.click(verification);
    expect(verification.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(verification);
    expect(verification.getAttribute('aria-expanded')).toBe('true');
  },
);

it('shows verification as skipped for an analysis-only plan without mounting verification logs', () => {
  show(
    fixture([
      { type: 'Analyzed', status: 'True' },
      { type: 'Executed', status: 'True', reason: 'Skipped' },
      { type: 'Verified', status: 'True', reason: 'Skipped' },
    ]),
  );
  const verification = screen.getByRole('button', { name: /Update verification/ });
  expect(within(verification).getByRole('img', { name: 'Skipped' })).toBeTruthy();
  expect(screen.queryByTestId('verification-logs')).toBeNull();
});

it('places verification approval in its own section after execution succeeds', () => {
  const run = fixture([{ type: 'Executed', status: 'True' }]);
  run.spec = {
    request: 'Verify the update outcome',
    analysis: {},
    execution: {},
    verification: { agent: 'smart' },
  };
  show(run);
  const section = screen.getByRole('region', { name: /Update verification/ });
  expect(within(section).getByRole('button', { name: 'Approve verification' })).toBeTruthy();
  expect(screen.queryByTestId('verification-logs')).toBeNull();
});

it('keeps analysis expanded when execution is skipped', () => {
  show(
    fixture([
      { type: 'Analyzed', status: 'True' },
      { type: 'Executed', status: 'True', reason: 'Skipped' },
      { type: 'Verified', status: 'True', reason: 'Skipped' },
    ]),
  );
  expect(
    screen.getByRole('button', { name: /Update analysis/ }).getAttribute('aria-expanded'),
  ).toBe('true');
  const executionToggle = screen.getByRole('button', { name: /Update execution/ });
  expect(executionToggle.getAttribute('aria-expanded')).toBe('false');
  expect(within(executionToggle).getByRole('img', { name: 'Skipped' })).toBeTruthy();
  expect(screen.queryByTestId('execution-logs')).toBeNull();
});

it('keeps analysis results available after execution failure and places logs before remediation', () => {
  (useAnalysisResults as jest.Mock).mockReturnValue([
    [
      {
        metadata: { name: 'analysis', namespace: 'ns' },
        status: {
          options: [
            {
              title: 'Recommended update plan',
              remediationPlan: { description: 'Update the cluster', risk: 'Low' },
            },
          ],
        },
      },
    ],
  ]);
  show(
    fixture([
      { type: 'Analyzed', status: 'True' },
      { type: 'Executed', status: 'False', message: 'Execution stopped' },
    ]),
  );
  expect(screen.getByText('Execution stopped')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Update analysis/ }));
  const remediation = screen.getByRole('button', { name: /Recommended update plan/ });
  expect(
    screen.getByTestId('analysis-logs').compareDocumentPosition(remediation) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.getByText('Update the cluster')).toBeTruthy();
  expect(
    within(screen.getByRole('button', { name: /Update analysis/ })).getByRole('img', {
      name: 'Completed',
    }),
  ).toBeTruthy();
});

it('shows execution loading while provisioning and running, then removes it on completion', () => {
  const run = fixture([
    { type: 'Analyzed', status: 'True' },
    { type: 'Executed', status: 'Unknown' },
  ]);
  const { rerender } = show(run);
  expect(screen.getByRole('progressbar', { name: 'Executing' })).toBeTruthy();
  expect(screen.getByText('Starting execution — waiting for agent sandbox...')).toBeTruthy();
  run.status!.steps!.execution = { sandbox: { claimName: 'execution-sandbox', namespace: 'ns' } };
  rerender(<UpdatePlanTab agenticRuns={[{ ...run }]} />);
  expect(screen.getByText('AI agent is executing the selected upgrade plan...')).toBeTruthy();
  expect(screen.getByText('Sandbox: execution-sandbox')).toBeTruthy();
  run.status!.conditions![1].status = 'True';
  rerender(<UpdatePlanTab agenticRuns={[{ ...run }]} />);
  expect(screen.queryByRole('progressbar', { name: 'Executing' })).toBeNull();
  expect(screen.queryByText('AI agent is executing the selected upgrade plan...')).toBeNull();
});

it.each(['True', 'False'] as const)(
  'shows verification loading while provisioning and running, then removes it on %s',
  (outcome) => {
    const run = fixture([
      { type: 'Analyzed', status: 'True' },
      { type: 'Executed', status: 'True' },
      { type: 'Verified', status: 'Unknown' },
    ]);
    const { rerender } = show(run);
    expect(screen.getByRole('progressbar', { name: 'Verifying' })).toBeTruthy();
    expect(screen.getByText('Starting verification — waiting for agent sandbox...')).toBeTruthy();
    run.status!.steps!.verification = {
      sandbox: { claimName: 'verification-sandbox', namespace: 'ns' },
    };
    rerender(<UpdatePlanTab agenticRuns={[{ ...run }]} />);
    expect(screen.getByText('AI agent is verifying the cluster update...')).toBeTruthy();
    expect(screen.getByText('Sandbox: verification-sandbox')).toBeTruthy();
    run.status!.conditions![2].status = outcome;
    rerender(<UpdatePlanTab agenticRuns={[{ ...run }]} />);
    expect(screen.queryByRole('progressbar', { name: 'Verifying' })).toBeNull();
    expect(screen.queryByText('AI agent is verifying the cluster update...')).toBeNull();
  },
);

it('recovers the selected update path after its run is removed', () => {
  const first = fixture([{ type: 'Analyzed', status: 'True' }]);
  const second = {
    ...first,
    metadata: { ...first.metadata, name: 'replacement', uid: 'replacement' },
  };
  const { rerender } = render(<UpdatePlanTab agenticRuns={[first, second]} />);
  rerender(<UpdatePlanTab agenticRuns={[second]} />);
  expect(
    (screen.getByRole('combobox', { name: 'Select agentic run' }) as HTMLSelectElement).value,
  ).toBe('replacement');
  expect(screen.getByRole('button', { name: /Update analysis/ })).toBeTruthy();
});

it('closes re-analysis confirmation when the run begins execution', () => {
  (k8sDelete as jest.Mock).mockClear();
  const run = fixture([{ type: 'Analyzed', status: 'True' }]);
  const { rerender } = show(run);
  fireEvent.click(screen.getByRole('button', { name: 'Re-analyse' }));
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy();
  const executing = fixture([
    { type: 'Analyzed', status: 'True' },
    { type: 'Executed', status: 'Unknown' },
  ]);
  rerender(<UpdatePlanTab agenticRuns={[executing]} />);
  expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Re-analyse' })).toBeNull();
  expect(k8sDelete).not.toHaveBeenCalled();
});

it('uses deletion preconditions when re-analysing to reject concurrent run changes', async () => {
  (k8sDelete as jest.Mock).mockClear().mockResolvedValue({});
  const run = fixture([{ type: 'Analyzed', status: 'True' }]);
  run.metadata!.resourceVersion = '7';
  show(run);
  fireEvent.click(screen.getByRole('button', { name: 'Re-analyse' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(k8sDelete).toHaveBeenCalledTimes(1));
  expect((k8sDelete as jest.Mock).mock.calls[0][0].json).toEqual({
    preconditions: { uid: 'uid', resourceVersion: '7' },
  });
});
