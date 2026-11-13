import {
  Alert,
  Button,
  Content,
  Flex,
  FlexItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { type FC, useState } from 'react';
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
  const { approveStage, denyStage, error, clearError, inProgress, canApprove, canApproveLoading } =
    useApprovalActions(approval);
  const [confirm, setConfirm] = useState<'approve' | 'deny'>();
  const [clusterVersion, cvLoaded, cvError] = useClusterVersion();
  const updateState = cvLoaded && !cvError ? verificationUpdateState(clusterVersion) : 'unknown';
  const rolloutBlocked = updateState !== 'complete';
  const decision = approval?.spec?.stages?.find((stage) => stage.type === 'Verification');
  const disabled =
    !loaded || !!loadError || !approval || !canApprove || canApproveLoading || inProgress;
  const submit = async () => {
    if (!confirm || disabled || (confirm === 'approve' && rolloutBlocked)) return;
    const ok =
      confirm === 'approve' ? await approveStage('Verification') : await denyStage('Verification');
    if (ok) setConfirm(undefined);
  };

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
    <>
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
          </Content>
        </StackItem>
        {loadError && (
          <StackItem>
            <Alert isInline variant="warning" title={t('Failed to load verification approval')} />
          </StackItem>
        )}
        {error && !confirm && (
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
          <Flex>
            <FlexItem>
              <Button
                variant="primary"
                isDisabled={disabled || rolloutBlocked}
                onClick={() => {
                  clearError();
                  setConfirm('approve');
                }}
              >
                {t('Approve verification')}
              </Button>
            </FlexItem>
            <FlexItem>
              <Button
                variant="danger"
                isDisabled={disabled}
                onClick={() => {
                  clearError();
                  setConfirm('deny');
                }}
              >
                {t('Reject verification')}
              </Button>
            </FlexItem>
          </Flex>
        </StackItem>
      </Stack>
      <Modal
        variant="small"
        isOpen={!!confirm}
        onClose={() => {
          if (!inProgress) setConfirm(undefined);
        }}
        aria-labelledby="verification-decision-title"
      >
        <ModalHeader
          title={confirm === 'approve' ? t('Approve verification?') : t('Reject verification?')}
          labelId="verification-decision-title"
        />
        <ModalBody>
          <Stack hasGutter>
            <StackItem>
              {confirm === 'approve'
                ? t('The agent will run the verification plan to check the update outcome.')
                : t(
                    'Rejecting verification ends this agentic run. Completed update actions remain in place.',
                  )}
            </StackItem>
            {confirm === 'approve' && rolloutBlocked && (
              <StackItem>
                <Alert
                  isInline
                  variant="warning"
                  title={t(
                    'Verification approval is unavailable until update completion is confirmed.',
                  )}
                />
              </StackItem>
            )}
            {error && (
              <StackItem>
                <Alert isInline variant="danger" title={t('Action failed')}>
                  {error}
                </Alert>
              </StackItem>
            )}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button
            variant={confirm === 'approve' ? 'primary' : 'danger'}
            onClick={submit}
            isLoading={inProgress}
            isDisabled={disabled || (confirm === 'approve' && rolloutBlocked)}
          >
            {confirm === 'approve' ? t('Confirm approval') : t('Confirm reject')}
          </Button>
          <Button variant="link" isDisabled={inProgress} onClick={() => setConfirm(undefined)}>
            {t('Cancel')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};
