import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import {
  MachineConfigPool,
  MachineConfigPoolGVK,
  sortMCPsByCreationTimestamp,
} from '../models/machineconfigpool';

export const useMachineConfigPools = (): [MachineConfigPool[], boolean, Error] => {
  const [mcps, loaded, error] = useK8sWatchResource<MachineConfigPool[]>({
    groupVersionKind: MachineConfigPoolGVK,
    isList: true,
  });

  const sortedMcps = mcps ? [...mcps].sort(sortMCPsByCreationTimestamp) : [];

  return [sortedMcps, loaded, error];
};
