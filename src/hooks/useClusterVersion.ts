import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterVersion, ClusterVersionGVK } from '../models/clusterversion';

export const useClusterVersion = () => {
  return useK8sWatchResource<ClusterVersion>({
    groupVersionKind: ClusterVersionGVK,
    name: 'version',
  });
};
