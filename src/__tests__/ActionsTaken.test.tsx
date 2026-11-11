/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { ActionsTaken } from '../components/update-plan/ActionsTaken';
import { LightspeedExecutionResult } from '../models/agenticrun';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (text: string) => text }) }));
jest.mock('../components/shared/MarkdownContent', () => ({
  MarkdownContent: ({ text }: { text: string }) => <div>{text}</div>,
}));

const watch = useK8sWatchResource as jest.Mock;
const result: LightspeedExecutionResult = {
  metadata: { name: 'execution-2', namespace: 'ns' },
  spec: { agenticRunName: 'update' },
  status: {
    actionsTaken: [
      {
        type: 'mutation',
        description: 'Requested the update',
        outcome: 'Succeeded',
        output: 'Cluster update to 5.0.1 has been initiated.',
      },
      {
        type: 'post-check',
        description: 'Checked operator health',
        outcome: 'Failed',
        error: 'The monitoring operator is degraded.',
      },
    ],
  },
};
const view = () => <ActionsTaken name="execution-2" namespace="ns" agenticRunName="update" />;

beforeEach(() => {
  watch.mockReturnValue([result, true, undefined]);
});

it('watches the referenced execution result and displays ordered actions with copyable output', () => {
  render(view());
  expect(watch).toHaveBeenLastCalledWith({
    groupVersionKind: {
      group: 'agentic.openshift.io',
      version: 'v1alpha1',
      kind: 'ExecutionResult',
    },
    name: 'execution-2',
    namespace: 'ns',
    namespaced: true,
  });
  expect(screen.queryByRole('grid', { name: 'Actions taken' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'View action details' }));
  const rows = within(screen.getByRole('grid', { name: 'Actions taken' })).getAllByRole('row');
  expect(rows).toHaveLength(3);
  expect(within(rows[1]).getByText('1')).toBeTruthy();
  expect(within(rows[1]).getByText('mutation')).toBeTruthy();
  expect(within(rows[1]).getByText('Succeeded')).toBeTruthy();
  const output = within(rows[1]).getByRole('textbox', { name: 'Output' }) as HTMLInputElement;
  expect(output.value).toBe(result.status!.actionsTaken![0].output);
  expect(output.readOnly).toBe(true);
  expect(within(rows[1]).getByRole('button', { name: 'Copy to clipboard' })).toBeTruthy();
  expect(within(rows[2]).getByText('2')).toBeTruthy();
  expect(within(rows[2]).getByText('Failed')).toBeTruthy();
  expect(within(rows[2]).getByText('The monitoring operator is degraded.')).toBeTruthy();
  expect(within(rows[2]).getByText('-')).toBeTruthy();
});

it.each([
  { result: undefined, loaded: false, error: undefined, text: 'Loading execution details...' },
  {
    result,
    loaded: true,
    error: new Error('Forbidden'),
    text: 'Failed to load actions taken',
  },
  {
    result: { ...result, status: {} },
    loaded: true,
    error: undefined,
    text: 'No actions were recorded for this execution.',
  },
])(
  'handles loading, errors and empty execution results ($text)',
  ({ result, loaded, error, text }) => {
    watch.mockReturnValue([result, loaded, error]);
    render(view());
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View action details' })).toBeNull();
  },
);

it.each([
  { ...result, metadata: { ...result.metadata, name: 'execution-1' } },
  { ...result, metadata: { ...result.metadata, namespace: 'other' } },
  { ...result, spec: { agenticRunName: 'other' } },
])('does not display actions belonging to another result, namespace or run (%#)', (other) => {
  watch.mockReturnValue([other, true, undefined]);
  render(view());
  expect(screen.queryByRole('button', { name: 'View action details' })).toBeNull();
  expect(screen.getByText('Loading execution details...')).toBeTruthy();
});
