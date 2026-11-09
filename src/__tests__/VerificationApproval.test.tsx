/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { k8sPatch, useAccessReview } from '@openshift-console/dynamic-plugin-sdk';
import { VerificationApproval } from '../components/update-plan/VerificationApproval';
import { useAgenticRunApprovals } from '../hooks/useAgenticRuns';
import {
  AgenticRunApprovalModel,
  LightspeedAgenticRun,
  LightspeedAgenticRunApproval,
} from '../models/agenticrun';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (text: string) => text }) }));
jest.mock('../hooks/useAgenticRuns', () => ({ useAgenticRunApprovals: jest.fn() }));

const run = { metadata: { name: 'update', namespace: 'ns' } } as LightspeedAgenticRun;
const approval: LightspeedAgenticRunApproval = {
  metadata: { name: 'update', namespace: 'ns', resourceVersion: '7' },
  spec: { stages: [{ type: 'Execution', execution: { option: 0 } }] },
};
const approvals = useAgenticRunApprovals as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
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
