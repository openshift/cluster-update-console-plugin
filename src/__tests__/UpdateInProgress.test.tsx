import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { UpdateInProgress } from '../components/cluster-updates/UpdateInProgress';
import { clusterVersionUpdating } from './data/clusterVersionMock';
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

const mockClusterOperators = [
  {
    metadata: { name: 'authentication' },
    status: {
      versions: [
        { name: 'operator', version: '4.15.4' },
      ],
    },
  },
  {
    metadata: { name: 'console' },
    status: {
      versions: [
        { name: 'operator', version: '4.15.4' },
      ],
    },
  },
  {
    metadata: { name: 'kube-apiserver' },
    status: {
      versions: [
        { name: 'operator', version: '4.15.2' }, // Not yet updated
      ],
    },
  },
];

const mockMasterMCP: MachineConfigPool = {
  apiVersion: 'machineconfiguration.openshift.io/v1',
  kind: 'MachineConfigPool',
  metadata: {
    name: 'master',
  },
  spec: {
    machineConfigSelector: {},
    nodeSelector: {},
  },
  status: {
    machineCount: 3,
    readyMachineCount: 2,
    updatedMachineCount: 2,
    degradedMachineCount: 0,
    observedGeneration: 1,
    configuration: {
      name: 'rendered-master-abc',
      source: [],
    },
  },
};

const mockWorkerMCP: MachineConfigPool = {
  apiVersion: 'machineconfiguration.openshift.io/v1',
  kind: 'MachineConfigPool',
  metadata: {
    name: 'worker',
  },
  spec: {
    machineConfigSelector: {},
    nodeSelector: {},
  },
  status: {
    machineCount: 5,
    readyMachineCount: 5,
    updatedMachineCount: 5,
    degradedMachineCount: 0,
    observedGeneration: 1,
    configuration: {
      name: 'rendered-worker-xyz',
      source: [],
    },
  },
};

describe('UpdateInProgress', () => {
  beforeEach(() => {
    (useK8sWatchResource as jest.Mock).mockReturnValue([mockClusterOperators, true, undefined]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders cluster operators progress', () => {
    render(
      <UpdateInProgress
        clusterVersion={clusterVersionUpdating}
        machineConfigPools={[mockMasterMCP, mockWorkerMCP]}
      />,
    );

    expect(screen.getByText(/Cluster Operators/)).toBeInTheDocument();
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
  });

  it('renders control plane nodes progress', () => {
    render(
      <UpdateInProgress
        clusterVersion={clusterVersionUpdating}
        machineConfigPools={[mockMasterMCP, mockWorkerMCP]}
      />,
    );

    expect(screen.getByText(/Control plane/)).toBeInTheDocument();
    expect(screen.getByText('2 of 3 nodes')).toBeInTheDocument();
  });

  it('renders worker nodes progress', () => {
    render(
      <UpdateInProgress
        clusterVersion={clusterVersionUpdating}
        machineConfigPools={[mockMasterMCP, mockWorkerMCP]}
      />,
    );

    expect(screen.getByText(/Worker/)).toBeInTheDocument();
    expect(screen.getByText('5 of 5 nodes')).toBeInTheDocument();
  });

  it('renders custom pool progress', () => {
    const customMCP: MachineConfigPool = {
      apiVersion: 'machineconfiguration.openshift.io/v1',
      kind: 'MachineConfigPool',
      metadata: {
        name: 'infra',
      },
      spec: {
        machineConfigSelector: {},
        nodeSelector: {},
      },
      status: {
        machineCount: 2,
        readyMachineCount: 1,
        updatedMachineCount: 1,
        degradedMachineCount: 0,
        observedGeneration: 1,
        configuration: {
          name: 'rendered-infra-123',
          source: [],
        },
      },
    };

    render(
      <UpdateInProgress
        clusterVersion={clusterVersionUpdating}
        machineConfigPools={[mockMasterMCP, mockWorkerMCP, customMCP]}
      />,
    );

    expect(screen.getByText(/infra/)).toBeInTheDocument();
    expect(screen.getByText('1 of 2 nodes')).toBeInTheDocument();
  });

  it('handles missing master pool gracefully', () => {
    render(
      <UpdateInProgress
        clusterVersion={clusterVersionUpdating}
        machineConfigPools={[mockWorkerMCP]}
      />,
    );

    // Should not crash and should show worker pool
    expect(screen.getByText(/Worker/)).toBeInTheDocument();
  });

  it('handles missing worker pool gracefully', () => {
    render(
      <UpdateInProgress
        clusterVersion={clusterVersionUpdating}
        machineConfigPools={[mockMasterMCP]}
      />,
    );

    // Should not crash and should show master pool
    expect(screen.getByText(/Control plane/)).toBeInTheDocument();
  });

  it('handles empty cluster operators', () => {
    (useK8sWatchResource as jest.Mock).mockReturnValue([[], true, undefined]);

    render(
      <UpdateInProgress
        clusterVersion={clusterVersionUpdating}
        machineConfigPools={[mockMasterMCP, mockWorkerMCP]}
      />,
    );

    expect(screen.getByText(/Cluster Operators/)).toBeInTheDocument();
    expect(screen.getByText('0 of 0')).toBeInTheDocument();
  });
});
