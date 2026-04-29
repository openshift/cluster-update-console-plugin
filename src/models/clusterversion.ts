import {
  K8sModel,
  K8sResourceCommon,
  K8sResourceCondition,
  getGroupVersionKindForModel,
} from '@openshift-console/dynamic-plugin-sdk';

export const ClusterVersionModel: K8sModel = {
  apiGroup: 'config.openshift.io',
  apiVersion: 'v1',
  kind: 'ClusterVersion',
  plural: 'clusterversions',
  abbr: 'CV',
  namespaced: false,
  label: 'ClusterVersion',
  labelPlural: 'ClusterVersions',
};

export const ClusterVersionGVK = getGroupVersionKindForModel(ClusterVersionModel);

export type Release = {
  version: string;
  image: string;
  url?: string;
  channels?: string[];
  architecture?: string;
};

export type ConditionalUpdateRisk = {
  url: string;
  name: string;
  message: string;
  matchingRules: Array<{
    type: string;
    promql?: { promql: string };
  }>;
  conditions?: K8sResourceCondition[];
};

export type ConditionalUpdate = {
  release: Release;
  risks: ConditionalUpdateRisk[];
  riskNames?: string[];
  conditions?: K8sResourceCondition[];
};

export type UpdateHistory = {
  state: 'Completed' | 'Partial';
  startedTime: string;
  completionTime?: string;
  version: string;
  image: string;
  verified: boolean;
  acceptedRisks?: string;
};

export type ClusterVersion = K8sResourceCommon & {
  spec: {
    channel?: string;
    clusterID?: string;
    desiredUpdate?: {
      version?: string;
      image?: string;
      force?: boolean;
      architecture?: string;
    };
    upstream?: string;
  };
  status?: {
    desired: {
      version: string;
      image: string;
      channels?: string[];
    };
    availableUpdates?: Release[];
    conditionalUpdates?: ConditionalUpdate[];
    history?: UpdateHistory[];
    conditions?: K8sResourceCondition[];
    observedGeneration?: number;
  };
};
