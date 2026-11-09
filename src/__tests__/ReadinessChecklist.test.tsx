/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { ReadinessChecklist } from '../components/update-plan/ReadinessChecklist';
import { OtaFinding } from '../models/agenticrun';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (text: string) => text }) }));

it('keeps a blocker visible even when its summary check passes and exposes actionable evidence', () => {
  const finding: OtaFinding = {
    type: 'ota_finding',
    severity: 'blocker',
    check: 'Operators',
    detail: 'Approval required.',
    affectedResources: ['InstallPlan monitoring/pending'],
    prerequisite: 'Review the InstallPlan.',
    verifyCommand: 'oc get installplan pending -n monitoring',
  };
  const { rerender } = render(
    <ReadinessChecklist checks={[{ name: 'Operators', status: 'pass' }]} findings={[finding]} />,
  );
  expect(screen.getByText('1 blocker must be resolved')).toBeTruthy();
  expect(screen.getByText('Blocked')).toBeTruthy();
  expect(screen.getByText('InstallPlan monitoring/pending')).toBeTruthy();
  expect(screen.getByText('Review the InstallPlan.')).toBeTruthy();
  expect(
    (screen.getByRole('textbox', { name: 'Verification command' }) as HTMLInputElement).value,
  ).toBe(finding.verifyCommand);
  rerender(<ReadinessChecklist checks={[{ name: 'Operators', status: 'pass' }]} findings={[]} />);
  expect(screen.queryByText('Blocked')).toBeNull();
  expect(screen.getByText('All assessed checks passed')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Passed checks ({{total}})' }).getAttribute('aria-expanded'),
  ).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: 'Passed checks ({{total}})' }));
  expect(screen.getByText('Operators')).toBeTruthy();
  expect(screen.getByText('Ready')).toBeTruthy();
});

it('does not report failed collection or an informational finding as ready', () => {
  render(
    <ReadinessChecklist
      checks={[{ name: 'Nodes', status: 'error' }]}
      findings={[
        {
          type: 'ota_finding',
          severity: 'info',
          check: 'APIs',
          detail: 'Not assessed.',
        },
      ]}
    />,
  );
  expect(screen.getByText('Some checks could not be completed')).toBeTruthy();
  expect(screen.getAllByText('Needs recheck')).toHaveLength(2);
  expect(screen.queryByText('Ready')).toBeNull();
});

it('shows warnings immediately while passing checks stay collapsed', () => {
  render(
    <ReadinessChecklist
      checks={[
        { name: 'Compatibility', status: 'warn', detail: 'Review operator support.' },
        { name: 'Nodes', status: 'pass', detail: 'All nodes ready.' },
      ]}
      findings={[]}
    />,
  );
  expect(screen.getByText('Review warnings before updating')).toBeTruthy();
  expect(screen.getByText('Review operator support.')).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Passed checks ({{total}})' }).getAttribute('aria-expanded'),
  ).toBe('false');
});
