import * as React from 'react';
import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import { LightspeedProposal, LightspeedProposalModel } from '../models/proposal';
import { getErrorMessage } from '../utils/error';

export const useApprovalActions = (proposal?: LightspeedProposal) => {
  const [inProgress, setInProgress] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const proposalRef = React.useRef(proposal);
  proposalRef.current = proposal;

  const handleApproval = React.useCallback(async (approved: boolean) => {
    const currentProposal = proposalRef.current;
    if (!currentProposal) return;
    setInProgress(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const conditionValue = {
        lastTransitionTime: now,
        message: approved
          ? 'Update plan approved by user via console'
          : 'Update plan denied by user via console',
        reason: approved ? 'ApprovedViaConsole' : 'DeniedViaConsole',
        status: approved ? 'True' : 'False',
        type: 'Approved',
      };
      const patches: Array<{ op: string; path: string; value: unknown }> = [
        currentProposal.status?.conditions?.length
          ? { op: 'add', path: '/status/conditions/-', value: conditionValue }
          : { op: 'add', path: '/status/conditions', value: [conditionValue] },
      ];

      await k8sPatch({
        data: patches,
        model: LightspeedProposalModel,
        resource: currentProposal,
        path: 'status',
      });
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setInProgress(false);
    }
  }, []);

  return {
    approve: React.useCallback(() => handleApproval(true), [handleApproval]),
    deny: React.useCallback(() => handleApproval(false), [handleApproval]),
    clearError: React.useCallback(() => setError(null), []),
    error,
    inProgress,
  };
};
