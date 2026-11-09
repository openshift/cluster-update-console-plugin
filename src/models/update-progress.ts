import { K8sResourceCommon, K8sResourceCondition } from '@openshift-console/dynamic-plugin-sdk';

export const ClusterOperatorGVK = {
  group: 'config.openshift.io',
  version: 'v1',
  kind: 'ClusterOperator',
};
export const MachineConfigPoolGVK = {
  group: 'machineconfiguration.openshift.io',
  version: 'v1',
  kind: 'MachineConfigPool',
};
export const MachineConfigGVK = {
  group: 'machineconfiguration.openshift.io',
  version: 'v1',
  kind: 'MachineConfig',
};
export const RELEASE_VERSION_ANNOTATION = 'machineconfiguration.openshift.io/release-image-version';

export type ClusterOperator = K8sResourceCommon & {
  status?: {
    conditions?: K8sResourceCondition[];
    versions?: { name: string; version: string }[];
  };
};

export type MachineConfigPool = K8sResourceCommon & {
  spec?: { paused?: boolean; configuration?: { name?: string } };
  status?: {
    observedGeneration?: number;
    machineCount?: number;
    updatedMachineCount?: number;
    readyMachineCount?: number;
    degradedMachineCount?: number;
    conditions?: K8sResourceCondition[];
  };
};

export type PoolUpdateState =
  | 'complete'
  | 'updating'
  | 'waiting'
  | 'paused'
  | 'degraded'
  | 'unknown'
  | 'empty';
export type PoolProgress = {
  resource: MachineConfigPool;
  total?: number;
  updated?: number;
  ready?: number;
  state: PoolUpdateState;
  message?: string;
};
