import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { AnalysisResult, AnalysisResultGVK } from '../models/proposal';
import { LIGHTSPEED_NAMESPACE } from '../utils/constants';

export const useAnalysisResults = () => {
  return useK8sWatchResource<AnalysisResult[]>({
    groupVersionKind: AnalysisResultGVK,
    isList: true,
    namespaced: true,
    namespace: LIGHTSPEED_NAMESPACE,
  });
};
