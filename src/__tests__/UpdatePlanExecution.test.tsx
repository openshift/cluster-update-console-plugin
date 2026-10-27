/** @jest-environment jsdom */
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import UpdatePlanTab from '../components/update-plan/UpdatePlanTab';
import { LightspeedAgenticRun } from '../models/agenticrun';
import { ClusterVersion } from '../models/clusterversion';
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
jest.mock('../hooks/useAgenticRuns', () => ({
  useAgenticRunApprovals: () => [[]],
  useAnalysisResults: jest.fn(() => [[]]),
}));
jest.mock('../hooks/useApprovalActions', () => ({
  useApprovalActions: () => ({ approveStage: jest.fn() }),
}));
jest.mock('../components/update-plan/ApprovalPolicyWarningBanner', () => ({ default: () => null }));
jest.mock('../components/update-plan/PlanHeader', () => ({ default: () => null }));
jest.mock('../components/update-plan/AnalysisResultView', () => ({ default: () => null }));
jest.mock('../components/shared/PhaseLabel', () => ({ default: () => null }));
jest.mock('../components/shared/ExecutionLogs', () => ({
  ExecutionLogs: () => <div data-testid="execution-logs" />,
  AnalysisLogs: () => <div data-testid="analysis-logs" />,
}));

const fixture = (conditions: unknown[]) =>
  ({
    metadata: { uid: 'uid', name: 'plan', namespace: 'ns' },
    status: { conditions, steps: { analysis: { results: [{ name: 'analysis' }] } } },
  }) as LightspeedAgenticRun;
const show = (run: LightspeedAgenticRun) =>
  render(<UpdatePlanTab agenticRuns={[run]} clusterVersion={{} as ClusterVersion} />);

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
  ['Verified', 'Verification'],
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
