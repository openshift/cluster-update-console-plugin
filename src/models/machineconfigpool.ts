import {
  K8sModel,
  K8sResourceCommon,
  K8sResourceCondition,
  getGroupVersionKindForModel,
} from '@openshift-console/dynamic-plugin-sdk';

export const MachineConfigPoolModel: K8sModel = {
  apiGroup: 'machineconfiguration.openshift.io',
  apiVersion: 'v1',
  kind: 'MachineConfigPool',
  plural: 'machineconfigpools',
  abbr: 'MCP',
  namespaced: false,
  label: 'MachineConfigPool',
  labelPlural: 'MachineConfigPools',
};

export const MachineConfigPoolGVK = getGroupVersionKindForModel(MachineConfigPoolModel);

export enum NodeTypes {
  master = 'master',
  worker = 'worker',
}

export enum NodeTypeNames {
  Master = 'Control plane',
  Worker = 'Worker',
}

export type MachineConfigPool = K8sResourceCommon & {
  spec: {
    paused?: boolean;
    machineConfigSelector?: {
      matchLabels?: { [key: string]: string };
    };
    nodeSelector?: {
      matchLabels?: { [key: string]: string };
    };
    maxUnavailable?: number | string;
  };
  status?: {
    conditions?: K8sResourceCondition[];
    machineCount?: number;
    readyMachineCount?: number;
    updatedMachineCount?: number;
    degradedMachineCount?: number;
    unavailableMachineCount?: number;
    observedGeneration?: number;
    configuration?: {
      name?: string;
      source?: Array<{
        apiVersion: string;
        kind: string;
        name: string;
      }>;
    };
  };
};

export const isMCPMaster = (mcp: MachineConfigPool): boolean =>
  mcp.metadata?.name === NodeTypes.master;

export const isMCPWorker = (mcp: MachineConfigPool): boolean =>
  mcp.metadata?.name === NodeTypes.worker;

export const isMCPPaused = (mcp: MachineConfigPool): boolean => !!mcp.spec?.paused;

export const sortMCPsByCreationTimestamp = (a: MachineConfigPool, b: MachineConfigPool): number => {
  const aTimestamp = a.metadata?.creationTimestamp || '';
  const bTimestamp = b.metadata?.creationTimestamp || '';
  return aTimestamp.localeCompare(bTimestamp);
};
