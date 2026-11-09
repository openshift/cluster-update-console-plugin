/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ResourceLink, useK8sModels } from '@openshift-console/dynamic-plugin-sdk';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { RequiredPermissions } from '../components/update-plan/lightspeed/RequiredPermissions';
import { RBACResult, RBACRule } from '../models/agenticrun';
import { I18N_NAMESPACE } from '../utils/constants';

jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  useK8sModels: jest.fn(() => [{}, false]),
  ResourceIcon: ({ kind }: { kind: string }) => <span data-testid="resource-icon">{kind}</span>,
  ResourceLink: jest.fn(({ name }: { name: string }) => <a href="#namespace">{name}</a>),
}));

const i18n = createInstance();
const rule: RBACRule = {
  namespace: 'openshift-monitoring',
  apiGroups: [''],
  resources: ['pods'],
  verbs: ['get', 'list', 'watch'],
  justification: 'Read pods',
};
const view = (rbac: RBACResult) =>
  render(
    <I18nextProvider i18n={i18n}>
      <RequiredPermissions rbac={rbac} />
    </I18nextProvider>,
  );
const expand = () =>
  fireEvent.click(screen.getByRole('button', { name: 'View permission details' }));

beforeAll(async () => {
  await i18n.init({
    lng: 'en',
    defaultNS: I18N_NAMESPACE,
    resources: {
      en: {
        [I18N_NAMESPACE]: jest.requireActual(
          '../../locales/en/plugin__cluster-update-console-plugin.json',
        ),
      },
    },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  (useK8sModels as jest.Mock).mockReturnValue([{}, false]);
});

it('omits the subsection when there are no permission rules', () => {
  const { container } = view({ namespaceScoped: [], clusterScoped: [] });
  expect(container.textContent).toBe('');
});

it('shows scope counts and the approval notice, then toggles the four-column details', () => {
  view({
    namespaceScoped: [rule, { ...rule, namespace: 'cluster-wide' }],
    clusterScoped: [{ ...rule, namespace: undefined, resources: ['nodes'] }],
  });
  expect(screen.getByRole('heading', { name: 'Required permissions', level: 4 })).toBeTruthy();
  expect(screen.getByText('2 namespace permissions')).toBeTruthy();
  expect(screen.getByText('1 cluster-wide permission')).toBeTruthy();
  expect(
    screen.getByText(
      'Permissions are fixed upon approval. The agent cannot exceed these scoped privileges.',
    ),
  ).toBeTruthy();
  expect(screen.queryByRole('grid')).toBeNull();
  expand();
  const table = screen.getByRole('grid', { name: 'Required permissions' });
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent),
  ).toEqual(['Namespace', 'Resource', 'Verbs', 'Purpose']);
  expect(within(table).getAllByText('Cluster-wide')).toHaveLength(1);
  expect(ResourceLink).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'Namespace', name: 'cluster-wide' }),
    expect.anything(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Hide permission details' }));
  expect(screen.queryByRole('grid')).toBeNull();
});

it('highlights write verbs and summarizes write access while retaining API groups', () => {
  view({
    clusterScoped: [
      {
        ...rule,
        apiGroups: ['apps'],
        resources: ['deployments'],
        verbs: ['get', 'patch', 'delete'],
      },
    ],
  });
  expect(screen.getByText('Includes write: patch/delete deployments')).toBeTruthy();
  expect(screen.queryByText(/namespace permission/)).toBeNull();
  expand();
  expect(screen.getByText('deployments (apps)')).toBeTruthy();
  expect(screen.getByText('get').closest('.pf-v6-c-label')?.classList.contains('pf-m-orange')).toBe(
    false,
  );
  for (const verb of ['patch', 'delete']) {
    expect(
      screen.getByText(verb).closest('.pf-v6-c-label')?.classList.contains('pf-m-orange'),
    ).toBe(true);
  }
  expect(screen.getByText('write')).toBeTruthy();
});

it('shows read-only permissions without a write summary or warning label', () => {
  view({ namespaceScoped: [rule] });
  expect(screen.getByText('1 namespace permission')).toBeTruthy();
  expect(screen.queryByText(/Includes write/)).toBeNull();
  expect(screen.queryByText(/cluster-wide permission/)).toBeNull();
  expand();
  expect(screen.getByRole('link', { name: rule.namespace })).toBeTruthy();
  expect(screen.getByText('pods')).toBeTruthy();
  expect(screen.getByText('Read pods')).toBeTruthy();
  expect(screen.queryByText('write')).toBeNull();
});

it('resolves named-resource icons by API group and handles undiscovered resources', () => {
  (useK8sModels as jest.Mock).mockReturnValue([
    {
      Secret: { apiGroup: '', plural: 'secrets', kind: 'Secret' },
      CustomSecret: { apiGroup: 'example.com', plural: 'secrets', kind: 'CustomSecret' },
    },
    false,
  ]);
  view({
    namespaceScoped: [
      {
        ...rule,
        apiGroups: ['example.com'],
        resources: ['secrets', 'widgets'],
        resourceNames: ['tls-cert'],
      },
    ],
  });
  expand();
  expect(screen.getByText('tls-cert')).toBeTruthy();
  expect(screen.getAllByTestId('resource-icon').map((icon) => icon.textContent)).toEqual([
    'CustomSecret',
    'widgets',
  ]);
});

it('handles wildcard and privileged verbs when the namespace is omitted', () => {
  view({ namespaceScoped: [{ ...rule, namespace: undefined, verbs: ['*', 'impersonate'] }] });
  expect(screen.getByText('Includes write: * pods')).toBeTruthy();
  expand();
  expect(screen.getByText('—')).toBeTruthy();
  expect(ResourceLink).not.toHaveBeenCalled();
  for (const verb of ['*', 'impersonate']) {
    expect(
      screen.getByText(verb).closest('.pf-v6-c-label')?.classList.contains('pf-m-orange'),
    ).toBe(true);
  }
});
