/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { useAgenticRunApprovals } from '../hooks/useAgenticRuns';
import { TimeoutGuidance } from '../components/update-plan/TimeoutGuidance';
import { LightspeedAgenticRun } from '../models/agenticrun';
import { LogPhase } from '../utils/logPhase';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (text: string, values?: Record<string, unknown>) =>
      text.replace(/{{(\w+)}}/g, (_, key) => String(values?.[key] ?? '')),
  }),
}));
jest.mock('../hooks/useAgenticRuns', () => ({ useAgenticRunApprovals: jest.fn() }));
const watch = useK8sWatchResource as jest.Mock;
const approvals = useAgenticRunApprovals as jest.Mock;
const runFor = (stage: LogPhase, reason = 'AgentTimeout') =>
  ({
    metadata: { name: 'update', namespace: 'ns' },
    spec: { request: 'Update', analysis: { agent: 'smart' }, [stage]: { agent: 'smart' } },
    status: {
      conditions: [
        {
          type: { analysis: 'Analyzed', execution: 'Executed', verification: 'Verified' }[stage],
          status: 'False',
          reason,
          message: '',
          lastTransitionTime: '2026-11-02T12:00:00Z',
        },
        {
          type: 'Escalated',
          status: 'Unknown',
          reason: 'VerificationFailed',
          message: '',
          lastTransitionTime: '2026-11-02T12:00:00Z',
        },
      ],
    },
  }) as LightspeedAgenticRun;
beforeEach(() => {
  watch
    .mockReset()
    .mockReturnValue([{ spec: { timeouts: { analysisSeconds: 900 } } }, true, undefined]);
  approvals.mockReturnValue([[], true, undefined]);
});
it.each(['analysis', 'execution', 'verification'] as LogPhase[])(
  'links to the effective Agent and correct field for %s',
  (stage) => {
    approvals.mockReturnValue([
      [
        {
          metadata: { name: 'update', namespace: 'ns' },
          spec: {
            stages: [
              {
                type: {
                  analysis: 'Analysis',
                  execution: 'Execution',
                  verification: 'Verification',
                }[stage],
                [stage]: { agent: 'override' },
              },
            ],
          },
        },
      ],
      true,
      undefined,
    ]);
    render(<TimeoutGuidance run={runFor(stage)} stage={stage} />);
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/k8s/cluster/agentic.openshift.io~v1alpha1~Agent/override/yaml',
    );
    expect(screen.getByText(`spec.timeouts.${stage}Seconds`)).toBeTruthy();
    expect(watch.mock.calls[0][0].name).toBe('override');
  },
);
it('uses the run Agent and displays a configured limit', () => {
  render(<TimeoutGuidance run={runFor('analysis')} stage="analysis" />);
  expect(screen.getByText('Agent smart is currently configured for 900 seconds.')).toBeTruthy();
  expect(screen.getByRole('link').textContent).toContain('smart');
});
it('uses default Agent and built-in limit when omitted', () => {
  const run = runFor('verification');
  run.spec.verification = {};
  render(<TimeoutGuidance run={run} stage="verification" />);
  expect(screen.getByRole('link').textContent).toContain('default');
  expect(screen.getByText('Agent default uses the built-in default of 1800 seconds.')).toBeTruthy();
});
it('does not guess an Agent when approval access fails', () => {
  approvals.mockReturnValue([[], true, new Error('Forbidden')]);
  render(<TimeoutGuidance run={runFor('analysis')} stage="analysis" />);
  expect(screen.queryByRole('link')).toBeNull();
  expect(watch).not.toHaveBeenCalled();
});
it('does not claim a default when Agent access fails', () => {
  watch.mockReturnValue([undefined, true, new Error('Forbidden')]);
  render(<TimeoutGuidance run={runFor('execution')} stage="execution" />);
  expect(screen.getByText(/Unable to read the Agent configuration/)).toBeTruthy();
  expect(screen.queryByText(/built-in default/)).toBeNull();
});
it('separates startup failures from configurable execution timeouts', () => {
  render(<TimeoutGuidance run={runFor('analysis', 'SandboxStartupTimeout')} stage="analysis" />);
  expect(screen.getByText(/Increasing the Agent execution timeout will not resolve/)).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'View sandbox namespace pods' }).getAttribute('href'),
  ).toBe('/k8s/ns/ns/pods');
  expect(watch).not.toHaveBeenCalled();
});
it('does not confuse unrelated failures with an agent timeout', () => {
  render(<TimeoutGuidance run={runFor('execution', 'CommandFailed')} stage="execution" />);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(watch).not.toHaveBeenCalled();
});

it('recognizes the operator verification timeout escalation condition', () => {
  const run = runFor('verification', 'VerificationFailed');
  run.status!.conditions![0].message = 'Verification failed: AgentTimeout';
  render(<TimeoutGuidance run={run} stage="verification" />);
  expect(screen.getByText('Update verification timed out')).toBeTruthy();
  expect(screen.getByText(/escalation status/)).toBeTruthy();
});

it('keeps the raw operator message in collapsed technical details', () => {
  const run = runFor('analysis');
  run.status!.conditions![0].message = 'Agent exceeded its configured execution budget';
  render(<TimeoutGuidance run={run} stage="analysis" />);
  const toggle = screen.getByRole('button', { name: 'Technical details' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByText('The agent exceeded its configured execution budget.')).toBeNull();
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByText('Agent exceeded its configured execution budget')).toBeTruthy();
  expect(screen.getByText('spec.timeouts.analysisSeconds')).toBeTruthy();
});
