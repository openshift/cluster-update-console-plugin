/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterUpdateProgress } from '../components/ClusterUpdateProgress';
import { ClusterVersion } from '../models/clusterversion';
import { RELEASE_VERSION_ANNOTATION } from '../models/update-progress';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (text: string, values?: Record<string, unknown>) =>
      text.replace(/{{(\w+)}}/g, (_, key) => String(values?.[key] ?? '')),
  }),
}));

it.each([3, 0])('updates live progress with %i worker nodes', (workerCount) => {
  const cv: ClusterVersion = {
    spec: { desiredUpdate: { version: '5.0.1' } },
    status: {
      desired: { version: '5.0.1', image: 'target' },
      history: [
        {
          version: '5.0.1',
          image: 'target',
          state: 'Partial',
          verified: true,
          startedTime: '2026-11-02T12:00:00Z',
        },
      ],
      conditions: [
        { type: 'Progressing', status: 'True' },
        { type: 'Available', status: 'True' },
      ],
    },
  };
  let updated = 1;
  let complete = false;
  (useK8sWatchResource as jest.Mock).mockImplementation(({ groupVersionKind }) => {
    const conditions = [
      { type: 'Available', status: 'True' },
      { type: 'Degraded', status: 'False' },
      { type: 'Progressing', status: complete ? 'False' : 'True' },
    ];
    const resources = {
      ClusterOperator: [
        {
          metadata: { name: 'network' },
          status: { versions: [{ name: 'operator', version: '5.0.1' }], conditions },
        },
      ],
      MachineConfig: [
        {
          metadata: {
            name: 'rendered-target',
            annotations: { [RELEASE_VERSION_ANNOTATION]: '5.0.1' },
          },
        },
      ],
      MachineConfigPool: ['master', 'worker'].map((name) => ({
        metadata: { name, generation: 2 },
        spec: { configuration: { name: 'rendered-target' } },
        status: {
          observedGeneration: 2,
          machineCount: name === 'worker' ? workerCount : 3,
          updatedMachineCount: name === 'worker' ? Math.min(updated, workerCount) : updated,
          readyMachineCount: name === 'worker' ? Math.min(updated, workerCount) : updated,
          conditions: [
            { type: 'Updated', status: complete ? 'True' : 'False' },
            { type: 'Degraded', status: 'False' },
          ],
        },
      })),
    };
    return [resources[groupVersionKind.kind as keyof typeof resources], true, undefined];
  });
  const { rerender } = render(<ClusterUpdateProgress clusterVersion={cv} />);
  expect(screen.getByRole('progressbar', { name: 'Cluster update in progress' })).toBeTruthy();
  expect(screen.getAllByRole('progressbar')).toHaveLength(workerCount === 0 ? 3 : 4);
  expect(screen.getAllByText('1 of 3 updated')).toHaveLength(workerCount === 0 ? 1 : 2);
  expect(screen.queryAllByText('0 of 0 updated')).toHaveLength(workerCount === 0 ? 1 : 0);
  expect(screen.queryByText('Waiting for target configuration')).toBeNull();
  updated = 2;
  rerender(<ClusterUpdateProgress clusterVersion={{ ...cv }} />);
  expect(screen.getAllByText('2 of 3 updated')).toHaveLength(workerCount === 0 ? 1 : 2);
  complete = true;
  updated = 3;
  const finished: ClusterVersion = {
    ...cv,
    status: {
      ...cv.status!,
      history: cv.status!.history!.map((entry) => ({ ...entry, state: 'Completed' })),
      conditions: [
        { type: 'Progressing', status: 'False' },
        { type: 'Available', status: 'True' },
      ],
    },
  };
  rerender(<ClusterUpdateProgress clusterVersion={finished} />);
  expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  expect(screen.getByText('Up to date')).toBeTruthy();
  expect(screen.getAllByText('3 of 3 up to date')).toHaveLength(workerCount === 0 ? 1 : 2);
});
