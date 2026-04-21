import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { LightspeedProposal, LightspeedProposalGVK } from '../models/proposal';
import { LIGHTSPEED_NAMESPACE } from '../utils/constants';

export const useUpdateProposals = () => {
  return useK8sWatchResource<LightspeedProposal[]>({
    groupVersionKind: LightspeedProposalGVK,
    isList: true,
    namespaced: true,
    namespace: LIGHTSPEED_NAMESPACE,
  });
};
