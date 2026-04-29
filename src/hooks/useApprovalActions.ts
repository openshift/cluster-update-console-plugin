import * as React from 'react';
import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import { LightspeedProposal, LightspeedProposalModel } from '../models/proposal';
import { getErrorMessage } from '../utils/error';

export const useApprovalActions = (proposal?: LightspeedProposal) => {
  const [inProgress, setInProgress] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const proposalRef = React.useRef(proposal);
  proposalRef.current = proposal;

  const handleApproval = React.useCallback(
    async (approved: boolean, maxAttempts?: number, optionIndex?: number) => {
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
        const statusPatches: Array<{ op: string; path: string; value: unknown }> = [
          { op: 'replace', path: '/status/phase', value: approved ? 'Approved' : 'Denied' },
          currentProposal.status?.conditions?.length
            ? { op: 'add', path: '/status/conditions/-', value: conditionValue }
            : { op: 'add', path: '/status/conditions', value: [conditionValue] },
        ];
        if (approved && optionIndex !== undefined) {
          statusPatches.push({
            op:
              currentProposal.status?.steps?.analysis?.selectedOption !== undefined
                ? 'replace'
                : 'add',
            path: '/status/steps/analysis/selectedOption',
            value: optionIndex,
          });
        }

        // Run spec and status patches in parallel when both are needed
        const statusPatch = k8sPatch({
          data: statusPatches,
          model: LightspeedProposalModel,
          resource: currentProposal,
          path: 'status',
        });

        const specPatch =
          approved && maxAttempts !== undefined && maxAttempts > 0
            ? k8sPatch({
                data: [
                  {
                    op: currentProposal.spec.maxAttempts === undefined ? 'add' : 'replace',
                    path: '/spec/maxAttempts',
                    value: maxAttempts,
                  },
                ],
                model: LightspeedProposalModel,
                resource: currentProposal,
              })
            : Promise.resolve();

        await Promise.all([statusPatch, specPatch]);
        return true;
      } catch (err) {
        setError(getErrorMessage(err));
        return false;
      } finally {
        setInProgress(false);
      }
    },
    [],
  );

  return {
    approve: React.useCallback(
      (maxAttempts?: number, optionIndex?: number) =>
        handleApproval(true, maxAttempts, optionIndex),
      [handleApproval],
    ),
    deny: React.useCallback(() => handleApproval(false), [handleApproval]),
    clearError: React.useCallback(() => setError(null), []),
    error,
    inProgress,
  };
};
