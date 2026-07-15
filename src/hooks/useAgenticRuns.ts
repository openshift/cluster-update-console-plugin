import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import {
  LightspeedAgenticRun,
  LightspeedAgenticRunApproval,
  LightspeedApprovalPolicy,
  LightspeedAnalysisResult,
  LightspeedAgenticRunGVK,
  AgenticRunApprovalGVK,
  ApprovalPolicyGVK,
  AnalysisResultGVK,
} from '../models/agenticrun';
import { LIGHTSPEED_NAMESPACE } from '../utils/constants';

export const useAgenticRuns = () => {
  return useK8sWatchResource<LightspeedAgenticRun[]>({
    groupVersionKind: LightspeedAgenticRunGVK,
    isList: true,
    namespaced: true,
    namespace: LIGHTSPEED_NAMESPACE,
  });
};

export const useAgenticRunApprovals = () => {
  return useK8sWatchResource<LightspeedAgenticRunApproval[]>({
    groupVersionKind: AgenticRunApprovalGVK,
    isList: true,
    namespaced: true,
    namespace: LIGHTSPEED_NAMESPACE,
  });
};

export const useAnalysisResults = () => {
  return useK8sWatchResource<LightspeedAnalysisResult[]>({
    groupVersionKind: AnalysisResultGVK,
    isList: true,
    namespaced: true,
    namespace: LIGHTSPEED_NAMESPACE,
  });
};

export const useApprovalPolicy = () => {
  return useK8sWatchResource<LightspeedApprovalPolicy>({
    groupVersionKind: ApprovalPolicyGVK,
    name: 'cluster',
  });
};
