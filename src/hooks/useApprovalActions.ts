import * as React from 'react';
import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import { LightspeedAgenticRunApproval, AgenticRunApprovalModel } from '../models/agenticrun';
import { getErrorMessage } from '../utils/error';

export type ApprovalStageType = 'Analysis' | 'Execution' | 'Verification' | 'Escalation';

export const useApprovalActions = (approval?: LightspeedAgenticRunApproval) => {
  const [inProgress, setInProgress] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const approvalRef = React.useRef(approval);
  approvalRef.current = approval;

  const approveStage = React.useCallback(
    async (
      stageType: ApprovalStageType,
      options?: { optionIndex?: number; maxAttempts?: number },
    ) => {
      const currentApproval = approvalRef.current;
      if (!currentApproval) return false;
      setInProgress(true);
      setError(null);
      try {
        const existingStages = currentApproval.spec?.stages ?? [];
        if (existingStages.some((s) => s.type === stageType)) return true;

        const stageEntry: Record<string, unknown> = {
          type: stageType,
          decision: 'Approved',
        };

        if (stageType === 'Analysis') {
          stageEntry.analysis = { agent: 'default' };
        } else if (stageType === 'Execution') {
          stageEntry.execution = {
            agent: 'default',
            ...(options?.optionIndex !== undefined && { option: options.optionIndex }),
            ...(options?.maxAttempts !== undefined && { maxAttempts: options.maxAttempts }),
          };
        } else if (stageType === 'Verification') {
          stageEntry.verification = { agent: 'default' };
        } else if (stageType === 'Escalation') {
          stageEntry.escalation = { agent: 'default' };
        }

        const newStages = [...existingStages, stageEntry];
        const hasSpec = currentApproval.spec?.stages !== undefined;

        await k8sPatch({
          data: [
            hasSpec
              ? { op: 'replace', path: '/spec/stages', value: newStages }
              : { op: 'add', path: '/spec', value: { stages: newStages } },
          ],
          model: AgenticRunApprovalModel,
          resource: currentApproval,
        });
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

  const denyStage = React.useCallback(async (stageType: ApprovalStageType) => {
    const currentApproval = approvalRef.current;
    if (!currentApproval) return false;
    setInProgress(true);
    setError(null);
    try {
      const existingStages = currentApproval.spec?.stages ?? [];
      const stageEntry = { type: stageType, decision: 'Denied' };
      const newStages = [...existingStages, stageEntry];
      const hasSpec = currentApproval.spec?.stages !== undefined;

      await k8sPatch({
        data: [
          hasSpec
            ? { op: 'replace', path: '/spec/stages', value: newStages }
            : { op: 'add', path: '/spec', value: { stages: newStages } },
        ],
        model: AgenticRunApprovalModel,
        resource: currentApproval,
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
    approveStage,
    denyStage,
    clearError: React.useCallback(() => setError(null), []),
    error,
    inProgress,
  };
};
