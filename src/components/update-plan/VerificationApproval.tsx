import { Alert, Button, Content, Stack, StackItem } from '@patternfly/react-core';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgenticRunApprovals } from '../../hooks/useAgenticRuns';
import { useApprovalActions } from '../../hooks/useApprovalActions';
import { LightspeedAgenticRun } from '../../models/agenticrun';
import { useClusterVersion } from '../../hooks/useClusterVersion';
import { verificationUpdateState } from '../../utils/update-progress';
import { I18N_NAMESPACE } from '../../utils/constants';

export const VerificationApproval: FC<{ run: LightspeedAgenticRun }> = ({ run }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [approvals, loaded, loadError] = useAgenticRunApprovals();
  const approval = (approvals ?? []).find(
    (entry) =>
      entry.metadata?.name === run.metadata?.name &&
      entry.metadata?.namespace === run.metadata?.namespace,
  );
  const { approveStage, error, inProgress, canApprove, canApproveLoading } =
    useApprovalActions(approval);
  const [clusterVersion, cvLoaded, cvError] = useClusterVersion();
  const updateState = cvLoaded && !cvError ? verificationUpdateState(clusterVersion) : 'unknown';
  const rolloutBlocked = updateState !== 'complete';
  const decision = approval?.spec?.stages?.find((stage) => stage.type === 'Verification');

  if (decision) {
    return (
      <Content component="p">
        {decision.decision === 'Denied'
          ? t('Verification was denied.')
          : t('Verification approved. Waiting for the agent to start...')}
      </Content>
    );
  }

  return (
    <Stack hasGutter>
      <StackItem>
        <Content component="p">
          {updateState === 'updating'
            ? t(
                'The cluster update is still in progress. Verification becomes available when the rollout finishes.',
              )
            : rolloutBlocked
              ? t(
                  'Unable to confirm update completion. Verification approval is unavailable until cluster status confirms the rollout has finished. Status updates automatically.',
                )
              : t(
                  'Execution completed. Approve verification to let the agent check the update outcome.',
                )}
          {rolloutBlocked && (
            <>
              {' '}
              <a href="#live-cluster-update-progress">{t('View live cluster update progress')}</a>
            </>
          )}
        </Content>
      </StackItem>
      {loadError && (
        <StackItem>
          <Alert isInline variant="warning" title={t('Failed to load verification approval')} />
        </StackItem>
      )}
      {error && (
        <StackItem>
          <Alert isInline variant="danger" title={t('Action failed')}>
            {error}
          </Alert>
        </StackItem>
      )}
      {!canApproveLoading && !canApprove && (
        <StackItem>
          <Alert
            isInline
            variant="info"
            title={t('You do not have permission to approve or reject this run.')}
          />
        </StackItem>
      )}
      <StackItem>
        <Button
          variant="primary"
          isLoading={inProgress}
          isDisabled={
            rolloutBlocked ||
            !loaded ||
            !!loadError ||
            !approval ||
            !canApprove ||
            canApproveLoading ||
            inProgress
          }
          onClick={() => {
            if (!rolloutBlocked) void approveStage('Verification');
          }}
        >
          {t('Approve verification')}
        </Button>
      </StackItem>
    </Stack>
  );
};
