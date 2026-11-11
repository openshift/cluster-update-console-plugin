/** @jest-environment jsdom */
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { checkAccess, k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import { useAgenticRunApprovals } from '../hooks/useAgenticRuns';
import { useApprovalActions } from '../hooks/useApprovalActions';
import {
  AgenticRunApprovalModel,
  LightspeedAgenticRun,
  LightspeedAgenticRunApproval,
  LightspeedAnalysisResult,
} from '../models/agenticrun';
import UpdatePlanSections from '../components/update-plan/UpdatePlanSections';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (text: string, values?: Record<string, string>) =>
      text.replace(/{{(\w+)}}/g, (_, key) => values?.[key] ?? ''),
  }),
}));
jest.mock('../hooks/useAgenticRuns', () => ({ useAgenticRunApprovals: jest.fn() }));
jest.mock('../components/update-plan/PlanHeader', () => ({ default: () => null }));
jest.mock('../components/shared/MarkdownContent', () => ({
  MarkdownContent: ({ text }: { text: string }) => <div>{text}</div>,
}));
jest.mock('../components/shared/ExecutionLogs', () => ({
  AnalysisLogs: () => <div>Analysis logs</div>,
  ExecutionLogs: () => null,
  VerificationLogs: () => null,
}));

const run = {
  metadata: { name: 'update', namespace: 'ns', uid: 'run-uid' },
  spec: { analysis: { agent: 'smart' }, execution: { agent: 'smart' } },
  status: {
    conditions: [{ type: 'Analyzed', status: 'True' }],
    steps: { analysis: { results: [{ name: 'analysis' }] } },
  },
} as LightspeedAgenticRun;
const approval = {
  metadata: { name: 'update', namespace: 'ns', resourceVersion: '17' },
  spec: { stages: [{ type: 'Analysis', analysis: {} }] },
} as LightspeedAgenticRunApproval;
const analysis = {
  metadata: { name: 'analysis', namespace: 'ns', uid: 'analysis-uid' },
  spec: { agenticRunName: 'update' },
  status: {
    options: [
      {
        title: 'Diagnosis only',
        diagnosis: { rootCause: 'Operator needs attention', summary: 'Review compatibility' },
      },
      {
        title: 'Update operator first',
        remediationPlan: {
          description: 'Remediate the operator',
          actions: [
            {
              type: 'mutation',
              description: 'Update the subscription',
              command:
                'oc patch subscription example --type=merge -p \'{"spec":{"channel":"stable"}}\'',
            },
          ],
          reversible: 'Reversible',
        },
      },
      {
        title: 'Update platform',
        remediationPlan: {
          description: 'Request the platform update',
          actions: [
            {
              type: 'mutation',
              description: 'Update the platform',
              command: 'oc adm upgrade --to=5.0.9',
            },
          ],
          reversible: 'Irreversible',
        },
      },
    ],
  },
} as LightspeedAnalysisResult;
const view = (result = analysis) => (
  <UpdatePlanSections
    agenticRun={run}
    analysisResults={[result]}
    submitted={false}
    reanalyseButton={null}
  />
);

const waitForDecisions = () =>
  waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Reject plan' }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );

const renderReady = async () => {
  const rendered = render(view());
  await waitForDecisions();
  return rendered;
};

beforeEach(() => {
  jest.clearAllMocks();
  (checkAccess as jest.Mock).mockResolvedValue({ status: { allowed: true } });
  (useAgenticRunApprovals as jest.Mock).mockReturnValue([[approval]]);
  (k8sPatch as jest.Mock).mockResolvedValue({});
});

it('approves the original option index and never patches ClusterVersion or overrides the agent', async () => {
  (checkAccess as jest.Mock).mockImplementation(async ({ name, namespace }) => ({
    status: { allowed: name === 'update' && namespace === 'ns' },
  }));
  await renderReady();
  expect(checkAccess).toHaveBeenCalledWith({
    group: 'agentic.openshift.io',
    resource: 'agenticrunapprovals',
    verb: 'patch',
    namespace: 'ns',
    name: 'update',
  });
  expect((screen.getByRole('button', { name: 'Approve plan' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole('radio', { name: 'Select plan 2' }));
  await waitForDecisions();
  fireEvent.click(screen.getByRole('button', { name: 'View details for Update operator first' }));
  fireEvent.click(screen.getByRole('button', { name: 'View command details' }));
  expect(
    screen.getByDisplayValue(analysis.status!.options![1].remediationPlan!.actions[0].command!),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Approve plan' }));
  expect(k8sPatch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }));
  await waitFor(() => expect(k8sPatch).toHaveBeenCalledTimes(1));
  expect(k8sPatch).toHaveBeenCalledWith({
    model: AgenticRunApprovalModel,
    resource: approval,
    data: [
      { op: 'test', path: '/metadata/resourceVersion', value: '17' },
      {
        op: 'add',
        path: '/spec/stages/-',
        value: { type: 'Execution', decision: 'Approved', execution: { option: 1 } },
      },
    ],
  });
});

it('denies the execution stage with the required execution arm', async () => {
  await renderReady();
  fireEvent.click(screen.getByRole('button', { name: 'Reject plan' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm reject' }));
  await waitFor(() => expect(k8sPatch).toHaveBeenCalledTimes(1));
  expect((k8sPatch as jest.Mock).mock.calls[0][0].data[1].value).toEqual({
    type: 'Execution',
    decision: 'Denied',
    execution: {},
  });
});

it('invalidates confirmation and selection when analysis contents change', async () => {
  const { rerender } = await renderReady();
  fireEvent.click(screen.getByRole('radio', { name: 'Select plan 2' }));
  await waitForDecisions();
  fireEvent.click(screen.getByRole('button', { name: 'Approve plan' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  const updated = {
    ...analysis,
    status: {
      ...analysis.status,
      options: analysis.status!.options!.map((option) => ({ ...option, summary: 'Updated plan' })),
    },
  };
  rerender(view(updated));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect((screen.getByRole('button', { name: 'Approve plan' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(k8sPatch).not.toHaveBeenCalled();
});

it('requires review of irreversibility in the approval confirmation', async () => {
  await renderReady();
  fireEvent.click(screen.getByRole('radio', { name: 'Select plan 3' }));
  await waitForDecisions();
  fireEvent.click(screen.getByRole('button', { name: 'Approve plan' }));
  expect(screen.getByText('This remediation is irreversible')).toBeTruthy();
  expect(k8sPatch).not.toHaveBeenCalled();
});

it('shows standalone diagnosis for no-action results without offering approval', () => {
  render(
    view({
      ...analysis,
      status: {
        actionRequired: 'False',
        diagnosis: { rootCause: 'Cluster is healthy', summary: 'No changes needed' },
      },
    }),
  );
  expect(screen.getByText('Cluster is healthy')).toBeTruthy();
  expect(screen.getByText('No action required')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Approve plan' })).toBeNull();
  expect(
    screen.queryByText(
      'Analysis indicates this upgrade is not feasible. Review diagnosis for details.',
    ),
  ).toBeNull();
});

it('disables decisions without permission and prevents hook mutations', async () => {
  (checkAccess as jest.Mock).mockResolvedValue({ status: { allowed: false } });
  render(view());
  await screen.findByText('You do not have permission to approve or reject this run.');
  expect((screen.getByRole('button', { name: 'Reject plan' }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  const { result } = renderHook(() => useApprovalActions(approval));
  await waitFor(() => expect(result.current.canApproveLoading).toBe(false));
  await act(async () => {
    expect(await result.current.approveStage('Execution', { optionIndex: 1 })).toBe(false);
  });
  expect(k8sPatch).not.toHaveBeenCalled();
});

it('checks permission for the newly selected approval', async () => {
  (checkAccess as jest.Mock).mockImplementation(async ({ name, namespace }) => ({
    status: { allowed: name === 'update' && namespace === 'ns' },
  }));
  const { result, rerender } = renderHook((selected) => useApprovalActions(selected), {
    initialProps: approval,
  });
  await waitFor(() => expect(result.current.canApprove).toBe(true));

  const selected = { ...approval, metadata: { name: 'another-update', namespace: 'another-ns' } };
  rerender(selected);
  expect(checkAccess).toHaveBeenLastCalledWith({
    group: 'agentic.openshift.io',
    resource: 'agenticrunapprovals',
    verb: 'patch',
    namespace: 'another-ns',
    name: 'another-update',
  });
  expect(result.current.canApprove).toBe(false);
  expect(result.current.canApproveLoading).toBe(true);
  await act(async () => {
    expect(await result.current.approveStage('Execution', { optionIndex: 1 })).toBe(false);
  });
  await waitFor(() => expect(result.current.canApproveLoading).toBe(false));
  expect(result.current.canApprove).toBe(false);
  expect(k8sPatch).not.toHaveBeenCalled();
});

it.each([true, false])(
  'ignores stale reviews after the current review allows %s',
  async (allowed) => {
    let resolvePrevious!: (review: { status: { allowed: boolean } }) => void;
    let resolveCurrent!: typeof resolvePrevious;
    (checkAccess as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePrevious = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveCurrent = resolve;
          }),
      );
    const { result, rerender } = renderHook((selected) => useApprovalActions(selected), {
      initialProps: approval,
    });
    rerender({ ...approval, metadata: { ...approval.metadata, name: 'another-update' } });
    expect(result.current.canApprove).toBe(false);
    expect(result.current.canApproveLoading).toBe(true);

    await act(async () => resolveCurrent({ status: { allowed } }));
    expect(result.current.canApprove).toBe(allowed);
    expect(result.current.canApproveLoading).toBe(false);
    await act(async () => resolvePrevious({ status: { allowed: !allowed } }));
    expect(result.current.canApprove).toBe(allowed);
    expect(result.current.canApproveLoading).toBe(false);
  },
);

it('waits for a named approval before requesting permission', async () => {
  const { result, rerender } = renderHook((selected) => useApprovalActions(selected), {
    initialProps: undefined as LightspeedAgenticRunApproval | undefined,
  });
  expect(checkAccess).not.toHaveBeenCalled();
  expect(result.current.canApprove).toBe(false);
  expect(result.current.canApproveLoading).toBe(true);
  rerender(approval);
  expect(result.current.canApproveLoading).toBe(true);
  await waitFor(() => expect(result.current.canApprove).toBe(true));
  expect(checkAccess).toHaveBeenCalledTimes(1);
});

it('preserves the SDK fallback when an access review request fails', async () => {
  (checkAccess as jest.Mock).mockRejectedValue(new Error('Access review unavailable'));
  const { result } = renderHook(() => useApprovalActions(approval));
  await waitFor(() => expect(result.current.canApprove).toBe(true));
  expect(result.current.canApproveLoading).toBe(false);
});

it('does not treat an existing denial as successful approval', async () => {
  const denied = {
    ...approval,
    spec: { stages: [{ type: 'Execution', decision: 'Denied', execution: {} }] },
  } as LightspeedAgenticRunApproval;
  const { result } = renderHook(() => useApprovalActions(denied));
  await waitFor(() => expect(result.current.canApprove).toBe(true));
  await act(async () => {
    expect(await result.current.approveStage('Execution', { optionIndex: 1 })).toBe(false);
  });
  expect(k8sPatch).not.toHaveBeenCalled();
});

it('retains confirmation and reports errors when an approval patch fails', async () => {
  (k8sPatch as jest.Mock).mockRejectedValue(new Error('Resource changed; retry the decision'));
  await renderReady();
  fireEvent.click(screen.getByRole('radio', { name: 'Select plan 2' }));
  await waitForDecisions();
  fireEvent.click(screen.getByRole('button', { name: 'Approve plan' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }));
  expect(await screen.findByText('Resource changed; retry the decision')).toBeTruthy();
  expect(screen.getByRole('dialog')).toBeTruthy();
});
