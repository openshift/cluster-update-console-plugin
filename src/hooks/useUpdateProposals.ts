import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import {
  LightspeedProposal,
  LightspeedProposalApproval,
  LightspeedApprovalPolicy,
  LightspeedAnalysisResult,
  LightspeedProposalGVK,
  ProposalApprovalGVK,
  ApprovalPolicyGVK,
  AnalysisResultGVK,
} from '../models/proposal';
import { LIGHTSPEED_NAMESPACE } from '../utils/constants';

export const useUpdateProposals = () => {
  return useK8sWatchResource<LightspeedProposal[]>({
    groupVersionKind: LightspeedProposalGVK,
    isList: true,
    namespaced: true,
    namespace: LIGHTSPEED_NAMESPACE,
  });
};

export const useProposalApprovals = () => {
  return useK8sWatchResource<LightspeedProposalApproval[]>({
    groupVersionKind: ProposalApprovalGVK,
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
