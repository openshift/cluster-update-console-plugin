import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { k8sPatch, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterUpdateModal } from '../components/modals/ClusterUpdateModal';
import { clusterVersionWithUpdates, clusterVersionUpgradeableFalse } from './data/clusterVersionMock';
import type { MachineConfigPool } from '../models/machineconfigpool';

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const text = key.replace('plugin__cluster-update-console-plugin~', '');
      if (opts) {
        return Object.entries(opts).reduce(
          (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
          text,
        );
      }
      return text;
    },
  }),
}));

jest.mock('@openshift-console/dynamic-plugin-sdk');

const mockWorkerMCP: MachineConfigPool = {
  apiVersion: 'machineconfiguration.openshift.io/v1',
  kind: 'MachineConfigPool',
  metadata: {
    name: 'worker',
    creationTimestamp: '2023-01-01T00:00:00Z',
  },
  spec: {
    machineConfigSelector: {},
    nodeSelector: {},
    paused: false,
  },
  status: {
    machineCount: 3,
    readyMachineCount: 3,
    updatedMachineCount: 3,
    degradedMachineCount: 0,
    observedGeneration: 1,
    configuration: {
      name: 'rendered-worker-xyz',
      source: [],
    },
  },
};

describe('ClusterUpdateModal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    (useK8sWatchResource as jest.Mock).mockReturnValue([[mockWorkerMCP], true, undefined]);
    jest.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(
      <ClusterUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    expect(screen.getByText('Update cluster')).toBeInTheDocument();
  });

  it('does not render modal when closed', () => {
    render(
      <ClusterUpdateModal
        isOpen={false}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    expect(screen.queryByText('Update cluster')).not.toBeInTheDocument();
  });

  it('shows current version', () => {
    render(
      <ClusterUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    expect(screen.getByText(/4\.15\.2/)).toBeInTheDocument();
  });

  it('shows version dropdown with available updates', () => {
    render(
      <ClusterUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    // Newest version should be selected by default
    expect(screen.getByDisplayValue('4.16.0')).toBeInTheDocument();
  });

  it('shows Full and Partial update options', () => {
    render(
      <ClusterUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    expect(screen.getByLabelText(/Full cluster update/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Control plane only update/)).toBeInTheDocument();
  });

  it('Full update is selected by default', () => {
    render(
      <ClusterUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    const fullRadio = screen.getByLabelText(/Full cluster update/);
    expect(fullRadio).toBeChecked();
  });

  it('allows switching to Partial update', async () => {
    const user = userEvent.setup();

    render(
      <ClusterUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    const partialRadio = screen.getByLabelText(/Control plane only update/);
    await user.click(partialRadio);

    expect(partialRadio).toBeChecked();
  });

  it('submits full update successfully', async () => {
    const user = userEvent.setup();
    (k8sPatch as jest.Mock).mockResolvedValue({});

    render(
      <ClusterUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    const updateButton = screen.getByText('Update cluster');
    await user.click(updateButton);

    await waitFor(() => {
      expect(k8sPatch).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.objectContaining({ kind: 'ClusterVersion' }),
          resource: clusterVersionWithUpdates,
          data: expect.arrayContaining([
            expect.objectContaining({
              path: '/spec/desiredUpdate',
              value: expect.objectContaining({ version: '4.16.0' }),
            }),
          ]),
        }),
      );
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles patch error', async () => {
    const user = userEvent.setup();
    (k8sPatch as jest.Mock).mockRejectedValue(new Error('Cluster is not upgradeable'));

    render(
      <ClusterUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    const updateButton = screen.getByText('Update cluster');
    await user.click(updateButton);

    await waitFor(() => {
      expect(screen.getByText(/Cluster is not upgradeable/)).toBeInTheDocument();
    });
  });

  it('allows canceling', async () => {
    const user = userEvent.setup();

    render(
      <ClusterUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
    expect(k8sPatch).not.toHaveBeenCalled();
  });

  it('shows only patch updates when Upgradeable=False', () => {
    render(
      <ClusterUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionUpgradeableFalse}
      />,
    );

    // Should select the patch update (4.15.4), not the minor update (4.16.0)
    expect(screen.getByDisplayValue('4.15.4')).toBeInTheDocument();
  });

  it('shows irreversibility warning', () => {
    render(
      <ClusterUpdateModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    expect(screen.getByText(/Cluster updates are irreversible/)).toBeInTheDocument();
    expect(screen.getByText(/you cannot roll back/)).toBeInTheDocument();
  });
});
