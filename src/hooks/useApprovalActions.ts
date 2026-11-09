import * as React from 'react';
import { k8sPatch, useAccessReview } from '@openshift-console/dynamic-plugin-sdk';
import { useTranslation } from 'react-i18next';
import { LightspeedAgenticRunApproval, AgenticRunApprovalModel } from '../models/agenticrun';
import { getErrorMessage } from '../utils/error';
import { I18N_NAMESPACE, LIGHTSPEED_NAMESPACE } from '../utils/constants';

export type ApprovalStageType = 'Analysis' | 'Execution' | 'Verification' | 'Escalation';

const STAGE_FIELDS = {
  Analysis: 'analysis',
  Execution: 'execution',
  Verification: 'verification',
  Escalation: 'escalation',
} as const;

export const useApprovalActions = (approval?: LightspeedAgenticRunApproval) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [inProgress, setInProgress] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const mutationPending = React.useRef(false);
  const [canApprove, canApproveLoading] = useAccessReview({
    group: 'agentic.openshift.io',
    resource: 'agenticrunapprovals',
    verb: 'patch',
    namespace: approval?.metadata?.namespace ?? LIGHTSPEED_NAMESPACE,
  });

  const decide = React.useCallback(
    async (stageType: ApprovalStageType, denied: boolean, options?: { optionIndex?: number }) => {
      if (mutationPending.current) return false;
      setError(null);
      if (!approval) {
        setError(t('Approval resource is not available yet.'));
        return false;
      }
      if (!canApprove || canApproveLoading) {
        setError(t('You do not have permission to approve or reject this run.'));
        return false;
      }
      if (approval.spec?.stages?.some((stage) => stage.type === stageType)) {
        setError(
          t('This stage already has a decision. Refresh the run to see its current status.'),
        );
        return false;
      }
      const stage = {
        type: stageType,
        decision: denied ? 'Denied' : 'Approved',
        [STAGE_FIELDS[stageType]]:
          stageType === 'Execution' && !denied && options?.optionIndex !== undefined
            ? { option: options.optionIndex }
            : {},
      };
      const path = approval.spec?.stages?.length
        ? '/spec/stages/-'
        : approval.spec
          ? '/spec/stages'
          : '/spec';
      const value =
        path === '/spec/stages/-' ? stage : path === '/spec/stages' ? [stage] : { stages: [stage] };
      mutationPending.current = true;
      setInProgress(true);
      try {
        await k8sPatch({
          model: AgenticRunApprovalModel,
          resource: approval,
          data: [
            ...(approval.metadata?.resourceVersion
              ? [
                  {
                    op: 'test',
                    path: '/metadata/resourceVersion',
                    value: approval.metadata.resourceVersion,
                  },
                ]
              : []),
            { op: 'add', path, value },
          ],
        });
        return true;
      } catch (err) {
        setError(getErrorMessage(err));
        return false;
      } finally {
        mutationPending.current = false;
        setInProgress(false);
      }
    },
    [approval, canApprove, canApproveLoading, t],
  );

  const approveStage = React.useCallback(
    (stage: ApprovalStageType, options?: { optionIndex?: number }) => decide(stage, false, options),
    [decide],
  );
  const denyStage = React.useCallback((stage: ApprovalStageType) => decide(stage, true), [decide]);

  return {
    approveStage,
    denyStage,
    error,
    clearError: React.useCallback(() => setError(null), []),
    inProgress,
    canApprove,
    canApproveLoading,
  };
};
