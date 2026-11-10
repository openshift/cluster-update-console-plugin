/** @jest-environment jsdom */
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { checkAccess, k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import { useClusterVersion } from '../hooks/useClusterVersion';
import { ClusterVersion } from '../models/clusterversion';
import { VerificationApproval } from '../components/update-plan/VerificationApproval';
import { useAgenticRunApprovals } from '../hooks/useAgenticRuns';
import {
  AgenticRunApprovalModel,
  derivePhase,
  LightspeedAgenticRun,
  LightspeedAgenticRunApproval,
} from '../models/agenticrun';
import {
  k8sPatch as previewPatch,
  useK8sWatchResource as usePreviewResource,
} from '../preview/console-sdk';
import { getPreview, setScenario } from '../preview/store';

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
  (checkAccess as jest.Mock).mockResolvedValue({ status: { allowed: true } });
  (k8sPatch as jest.Mock).mockResolvedValue({});
});

it.each([
  ['Approve verification', 'Confirm approval', 'Approved'],
  ['Reject verification', 'Confirm reject', 'Denied'],
])(
  'confirms %s, patches only verification, and prevents duplicate submissions',
  async (action, confirmation, decision) => {
    render(<VerificationApproval run={run} />);
    const button = screen.getByRole('button', { name: action }) as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);
    expect(k8sPatch).not.toHaveBeenCalled();
    const confirmButton = screen.getByRole('button', { name: confirmation });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);
    await waitFor(() => expect(k8sPatch).toHaveBeenCalledTimes(1));
    expect(k8sPatch).toHaveBeenCalledWith({
      model: AgenticRunApprovalModel,
      resource: approval,
      data: [
        { op: 'test', path: '/metadata/resourceVersion', value: '7' },
        {
          op: 'add',
          path: '/spec/stages/-',
          value: { type: 'Verification', decision, verification: {} },
        },
      ],
    });
  },
);

it('cancels a verification decision without submitting it', async () => {
  render(<VerificationApproval run={run} />);
  const button = screen.getByRole('button', { name: 'Reject verification' }) as HTMLButtonElement;
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
  expect(screen.getByRole('dialog', { name: 'Reject verification?' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(k8sPatch).not.toHaveBeenCalled();
});

it.each(['Approved', 'Denied', undefined] as const)(
  'never overwrites an existing %s verification stage',
  async (decision) => {
    approvals.mockReturnValue([
      [{ ...approval, spec: { stages: [{ type: 'Verification', decision, verification: {} }] } }],
      true,
    ]);
    await act(async () => {
      render(<VerificationApproval run={run} />);
    });
    expect(screen.queryByRole('button', { name: 'Approve verification' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject verification' })).toBeNull();
    expect(k8sPatch).not.toHaveBeenCalled();
  },
);

it.each(['permission', 'namespace', 'loading'] as const)(
  'blocks approval for %s problems',
  async (problem) => {
    if (problem === 'permission')
      (checkAccess as jest.Mock).mockResolvedValue({ status: { allowed: false } });
    if (problem === 'namespace')
      approvals.mockReturnValue([
        [{ ...approval, metadata: { ...approval.metadata, namespace: 'other' } }],
        true,
      ]);
    if (problem === 'loading') approvals.mockReturnValue([[], false]);
    render(<VerificationApproval run={run} />);
    if (problem === 'permission')
      await screen.findByText('You do not have permission to approve or reject this run.');
    const button = screen.getByRole('button', {
      name: 'Approve verification',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Reject verification' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(button);
    expect(k8sPatch).not.toHaveBeenCalled();
  },
);

it('shows an approval failure without starting verification locally', async () => {
  (k8sPatch as jest.Mock).mockRejectedValue(
    new Error('The approval changed. Refresh and try again.'),
  );
  render(<VerificationApproval run={run} />);
  const button = screen.getByRole('button', { name: 'Approve verification' }) as HTMLButtonElement;
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }));
  await waitFor(() =>
    expect(
      within(screen.getByRole('dialog')).getByText('The approval changed. Refresh and try again.'),
    ).toBeTruthy(),
  );
  expect(screen.getAllByText('The approval changed. Refresh and try again.')).toHaveLength(1);
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
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
  expect(k8sPatch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }));
  await waitFor(() => expect(k8sPatch).toHaveBeenCalledTimes(1));
});

it('rechecks rollout completion in the confirmation dialog but still allows rejection', async () => {
  const { rerender } = render(<VerificationApproval run={run} />);
  const button = screen.getByRole('button', { name: 'Approve verification' }) as HTMLButtonElement;
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
  clusterVersion.mockReturnValue([
    {
      ...completeVersion,
      status: { ...completeVersion.status, conditions: [{ type: 'Progressing', status: 'True' }] },
    },
    true,
    undefined,
  ]);
  rerender(<VerificationApproval run={run} />);
  const confirmButton = screen.getByRole('button', {
    name: 'Confirm approval',
  }) as HTMLButtonElement;
  expect(confirmButton.disabled).toBe(true);
  expect(
    within(screen.getByRole('dialog')).getByText(
      'Verification approval is unavailable until update completion is confirmed.',
    ),
  ).toBeTruthy();
  fireEvent.click(confirmButton);
  expect(k8sPatch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reject verification' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm reject' }));
  await waitFor(() => expect(k8sPatch).toHaveBeenCalledTimes(1));
  expect((k8sPatch as jest.Mock).mock.calls[0][0].data.at(-1).value.decision).toBe('Denied');
});

it.each(['loading', 'error', 'missing', 'unknown'] as const)(
  'does not allow verification with %s cluster status',
  async (problem) => {
    clusterVersion.mockReturnValue([
      problem === 'unknown'
        ? { ...completeVersion, status: { ...completeVersion.status, conditions: [] } }
        : undefined,
      problem !== 'loading',
      problem === 'error' ? new Error('Forbidden') : undefined,
    ]);
    await act(async () => {
      render(<VerificationApproval run={run} />);
    });
    const button = screen.getByRole('button', {
      name: 'Approve verification',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(k8sPatch).not.toHaveBeenCalled();
    expect(screen.getByText(/Unable to confirm update completion/)).toBeTruthy();
  },
);

it.each(['ReadyForVerification', 'AwaitingVerification'] as const)(
  'preserves completed execution and live rollout state when rejecting verification in preview (%s)',
  async (scenario) => {
    setScenario(scenario);
    const before = getPreview();
    const { result } = renderHook(() =>
      usePreviewResource<ClusterVersion>({ groupVersionKind: { kind: 'ClusterVersion' } }),
    );
    const beforeVersion = result.current[0];
    await act(async () => {
      await previewPatch({
        model: AgenticRunApprovalModel,
        resource: before.approval,
        data: [
          {
            op: 'add',
            path: '/spec/stages/-',
            value: { type: 'Verification', decision: 'Denied', verification: {} },
          },
        ],
      });
    });
    const after = getPreview();
    expect(result.current[0]).toEqual(beforeVersion);
    expect(after.run.status?.steps?.execution).toEqual(before.run.status?.steps?.execution);
    expect(after.executionResults).toEqual(before.executionResults);
    expect(derivePhase(after.run)).toBe('Denied');
    expect(after.approval.spec?.stages?.find((stage) => stage.type === 'Execution')?.decision).toBe(
      'Approved',
    );
    expect(
      after.approval.spec?.stages?.find((stage) => stage.type === 'Verification')?.decision,
    ).toBe('Denied');
  },
);
