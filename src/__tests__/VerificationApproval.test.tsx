/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { k8sPatch, useAccessReview } from '@openshift-console/dynamic-plugin-sdk';
import { useClusterVersion } from '../hooks/useClusterVersion';
import { ClusterVersion } from '../models/clusterversion';
import { VerificationApproval } from '../components/update-plan/VerificationApproval';
import { useAgenticRunApprovals } from '../hooks/useAgenticRuns';
import {
  AgenticRunApprovalModel,
  LightspeedAgenticRun,
  LightspeedAgenticRunApproval,
} from '../models/agenticrun';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (text: string) => text }) }));
jest.mock('../hooks/useAgenticRuns', () => ({ useAgenticRunApprovals: jest.fn() }));

jest.mock('../hooks/useClusterVersion', () => ({ useClusterVersion: jest.fn() }));
const clusterVersion = useClusterVersion as jest.Mock;
const completeVersion: ClusterVersion = {
  spec: {},
  status: {
    desired: { version: '5.0.1', image: 'target' },
    history: [
      {
        version: '5.0.1',
        image: 'target',
        state: 'Completed',
        verified: true,
        startedTime: '2026-11-04T12:00:00Z',
      },
    ],
    conditions: [
      { type: 'Progressing', status: 'False' },
      { type: 'Available', status: 'True' },
    ],
  },
};

const run = { metadata: { name: 'update', namespace: 'ns' } } as LightspeedAgenticRun;
const approval: LightspeedAgenticRunApproval = {
  metadata: { name: 'update', namespace: 'ns', resourceVersion: '7' },
  spec: { stages: [{ type: 'Execution', execution: { option: 0 } }] },
};
const approvals = useAgenticRunApprovals as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  clusterVersion.mockReturnValue([completeVersion, true, undefined]);
  approvals.mockReturnValue([[approval], true, undefined]);
  (useAccessReview as jest.Mock).mockReturnValue([true, false]);
  (k8sPatch as jest.Mock).mockResolvedValue({});
});

it('approves only verification, preserves the configured agent, and prevents duplicate submissions', async () => {
  render(<VerificationApproval run={run} />);
  const button = screen.getByRole('button', { name: 'Approve verification' });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(k8sPatch).toHaveBeenCalledTimes(1));
  expect(k8sPatch).toHaveBeenCalledWith({
    model: AgenticRunApprovalModel,
    resource: approval,
    data: [
      { op: 'test', path: '/metadata/resourceVersion', value: '7' },
      {
        op: 'add',
        path: '/spec/stages/-',
        value: { type: 'Verification', decision: 'Approved', verification: {} },
      },
    ],
  });
});

it.each(['Approved', 'Denied', undefined] as const)(
  'never overwrites an existing %s verification stage',
  (decision) => {
    approvals.mockReturnValue([
      [{ ...approval, spec: { stages: [{ type: 'Verification', decision, verification: {} }] } }],
      true,
    ]);
    render(<VerificationApproval run={run} />);
    expect(screen.queryByRole('button', { name: 'Approve verification' })).toBeNull();
    expect(k8sPatch).not.toHaveBeenCalled();
  },
);

it.each(['permission', 'namespace', 'loading'] as const)(
  'blocks approval for %s problems',
  (problem) => {
    if (problem === 'permission') (useAccessReview as jest.Mock).mockReturnValue([false, false]);
    if (problem === 'namespace')
      approvals.mockReturnValue([
        [{ ...approval, metadata: { ...approval.metadata, namespace: 'other' } }],
        true,
      ]);
    if (problem === 'loading') approvals.mockReturnValue([[], false]);
    render(<VerificationApproval run={run} />);
    const button = screen.getByRole('button', {
      name: 'Approve verification',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(k8sPatch).not.toHaveBeenCalled();
  },
);

it('shows an approval failure without starting verification locally', async () => {
  (k8sPatch as jest.Mock).mockRejectedValue(
    new Error('The approval changed. Refresh and try again.'),
  );
  render(<VerificationApproval run={run} />);
  fireEvent.click(screen.getByRole('button', { name: 'Approve verification' }));
  await waitFor(() =>
    expect(screen.getByText('The approval changed. Refresh and try again.')).toBeTruthy(),
  );
});

it('blocks verification during a rollout and enables it automatically when the rollout finishes', async () => {
  clusterVersion.mockReturnValue([
    {
      ...completeVersion,
      status: { ...completeVersion.status, conditions: [{ type: 'Progressing', status: 'True' }] },
    },
    true,
    undefined,
  ]);
  const { rerender } = render(<VerificationApproval run={run} />);
  const button = screen.getByRole('button', { name: 'Approve verification' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(screen.getByText(/The cluster update is still in progress/)).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'View live cluster update progress' }).getAttribute('href'),
  ).toBe('#live-cluster-update-progress');
  fireEvent.click(button);
  expect(k8sPatch).not.toHaveBeenCalled();
  clusterVersion.mockReturnValue([completeVersion, true, undefined]);
  rerender(<VerificationApproval run={run} />);
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  await waitFor(() => expect(k8sPatch).toHaveBeenCalledTimes(1));
});

it.each(['loading', 'error', 'missing', 'unknown'] as const)(
  'does not allow verification with %s cluster status',
  (problem) => {
    clusterVersion.mockReturnValue([
      problem === 'unknown'
        ? { ...completeVersion, status: { ...completeVersion.status, conditions: [] } }
        : undefined,
      problem !== 'loading',
      problem === 'error' ? new Error('Forbidden') : undefined,
    ]);
    render(<VerificationApproval run={run} />);
    const button = screen.getByRole('button', {
      name: 'Approve verification',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(k8sPatch).not.toHaveBeenCalled();
    expect(screen.getByText(/Unable to confirm update completion/)).toBeTruthy();
  },
);
