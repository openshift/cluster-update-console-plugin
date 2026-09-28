import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  Flex,
  FlexItem,
  FormSelect,
  FormSelectOption,
  Label,
  Modal,
  ModalVariant,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { CheckIcon } from '@patternfly/react-icons';
import {
  LightspeedAgenticRun,
  LightspeedAgenticRunApproval,
  AnalysisData,
  hasDefaultModeData,
} from '../../models/agenticrun';
import { ClusterVersion, ClusterVersionModel } from '../../models/clusterversion';
import { I18N_NAMESPACE, LABELS } from '../../utils/constants';
import { unsanitizeVersion } from '../../utils/version';
import { getErrorMessage } from '../../utils/error';
import { useApprovalActions } from '../../hooks/useApprovalActions';
import { useAgenticRunApprovals } from '../../hooks/useAgenticRuns';

type DecisionActionsProps = {
  agenticRun: LightspeedAgenticRun;
  clusterVersion: ClusterVersion;
  analysisData: AnalysisData;
};

const CONFIRM_TIMEOUT_MS = 5000;

const DecisionActions: React.FC<DecisionActionsProps> = ({
  agenticRun,
  clusterVersion,
  analysisData,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const navigate = useNavigate();

  // Find the AgenticRunApproval matching this run (same name/namespace)
  const [approvals] = useAgenticRunApprovals();
  const approval = React.useMemo(
    () =>
      (approvals ?? []).find(
        (a: LightspeedAgenticRunApproval) =>
          a.metadata?.name === agenticRun.metadata?.name &&
          a.metadata?.namespace === agenticRun.metadata?.namespace,
      ),
    [approvals, agenticRun.metadata?.name, agenticRun.metadata?.namespace],
  );

  const { approveStage, denyStage, error, clearError, inProgress } = useApprovalActions(approval);

  // Option selection (for multiple remediation plans)
  const remediationOptions = React.useMemo(
    () => analysisData.options.filter((opt) => hasDefaultModeData(opt) && opt.proposal),
    [analysisData.options],
  );
  const [selectedOptionIndex, setSelectedOptionIndex] = React.useState(0);
  const selectedOption = remediationOptions[selectedOptionIndex];

  const [confirmingApprove, setConfirmingApprove] = React.useState(false);
  const [confirmingDeny, setConfirmingDeny] = React.useState(false);
  const [showIrreversibilityModal, setShowIrreversibilityModal] = React.useState(false);
  const [upgradeError, setUpgradeError] = React.useState<string | null>(null);
  const approveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const denyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (approveTimerRef.current) clearTimeout(approveTimerRef.current);
      if (denyTimerRef.current) clearTimeout(denyTimerRef.current);
    };
  }, []);

  const executeApproval = React.useCallback(async () => {
    if (approveTimerRef.current) clearTimeout(approveTimerRef.current);
    setConfirmingApprove(false);
    setUpgradeError(null);

    const approved = await approveStage('Execution', { optionIndex: selectedOptionIndex });
    if (!approved) return;

    const rawTarget = agenticRun.metadata?.labels?.[LABELS.targetVersion] ?? '';
    const targetVersion = rawTarget ? unsanitizeVersion(rawTarget) : '';
    const release = clusterVersion.status?.availableUpdates?.find(
      (u) => u.version === targetVersion,
    );

    if (!release) {
      setUpgradeError(
        t('Target version {{version}} not found in available updates', {
          version: targetVersion,
        }),
      );
      return;
    }

    try {
      const hasDesiredUpdate = clusterVersion.spec?.desiredUpdate !== undefined;
      await k8sPatch({
        data: [
          {
            op: hasDesiredUpdate ? 'replace' : 'add',
            path: '/spec/desiredUpdate',
            value: { version: release.version, image: release.image },
          },
        ],
        model: ClusterVersionModel,
        resource: clusterVersion,
      });
      navigate('/settings/cluster');
    } catch (err) {
      setUpgradeError(getErrorMessage(err));
    }
  }, [approveStage, selectedOptionIndex, agenticRun, clusterVersion, navigate, t]);

  const handleApproveClick = React.useCallback(async () => {
    if (confirmingApprove) {
      if (selectedOption?.proposal?.reversible === 'Irreversible') {
        setShowIrreversibilityModal(true);
      } else {
        await executeApproval();
      }
    } else {
      setConfirmingApprove(true);
      setConfirmingDeny(false);
      if (denyTimerRef.current) clearTimeout(denyTimerRef.current);
      approveTimerRef.current = setTimeout(() => {
        setConfirmingApprove(false);
      }, CONFIRM_TIMEOUT_MS);
    }
  }, [confirmingApprove, selectedOption, executeApproval]);

  const handleIrreversibilityConfirm = React.useCallback(async () => {
    setShowIrreversibilityModal(false);
    await executeApproval();
  }, [executeApproval]);

  const handleDenyClick = React.useCallback(async () => {
    if (confirmingDeny) {
      if (denyTimerRef.current) clearTimeout(denyTimerRef.current);
      setConfirmingDeny(false);
      setUpgradeError(null);
      const denied = await denyStage('Execution');
      if (!denied) return;
    } else {
      setConfirmingDeny(true);
      setConfirmingApprove(false);
      if (approveTimerRef.current) clearTimeout(approveTimerRef.current);
      denyTimerRef.current = setTimeout(() => {
        setConfirmingDeny(false);
      }, CONFIRM_TIMEOUT_MS);
    }
  }, [confirmingDeny, denyStage]);

  const hasMultipleOptions = remediationOptions.length > 1;
  const isApproveDisabled = inProgress || !approval || !selectedOption;

  const displayError = error || upgradeError;

  return (
    <>
      <Card className="cluster-update-plugin__decision-card">
        <CardTitle>
          <span className="cluster-update-plugin__decision-title-text">
            {t('Awaiting Decision')}
          </span>
          <Label color="orange" isCompact className="cluster-update-plugin__decision-badge">
            {t('Pending')}
          </Label>
        </CardTitle>
        <CardBody>
          <Stack hasGutter>
            <StackItem>
              <Content component="p" className="cluster-update-plugin__decision-description">
                {t(
                  'Plan ready — approving will start the cluster upgrade. You will be redirected to the cluster settings page to monitor progress.',
                )}
              </Content>
            </StackItem>

            {hasMultipleOptions && (
              <StackItem>
                <Content component="p">
                  <strong>{t('Select remediation plan:')}</strong>
                </Content>
                <FormSelect
                  value={selectedOptionIndex.toString()}
                  onChange={(_event, value) => setSelectedOptionIndex(parseInt(value, 10))}
                  aria-label={t('Select remediation option')}
                  style={{ maxWidth: '400px' }}
                >
                  {remediationOptions.map((opt, idx) => (
                    <FormSelectOption
                      key={idx}
                      value={idx.toString()}
                      label={opt.title || t('Option {{index}}', { index: idx + 1 })}
                    />
                  ))}
                </FormSelect>
              </StackItem>
            )}

            <StackItem>
              <Flex
                gap={{ default: 'gapLg' }}
                alignItems={{ default: 'alignItemsCenter' }}
                className="cluster-update-plugin__decision-action-group"
              >
                <FlexItem>
                  <Button
                    variant="primary"
                    icon={<CheckIcon />}
                    onClick={handleApproveClick}
                    isDisabled={isApproveDisabled}
                    isLoading={inProgress && confirmingApprove}
                  >
                    {confirmingApprove ? t('Confirm approve & upgrade') : t('Approve & upgrade')}
                  </Button>
                </FlexItem>
                <FlexItem>
                  <Button
                    variant="danger"
                    onClick={handleDenyClick}
                    isDisabled={inProgress || !approval}
                    isLoading={inProgress && confirmingDeny}
                  >
                    {confirmingDeny ? t('Confirm reject') : t('Reject plan')}
                  </Button>
                </FlexItem>
              </Flex>
            </StackItem>

            {displayError && (
              <StackItem>
                <Alert
                  variant="danger"
                  isInline
                  title={t('Action failed')}
                  className="cluster-update-plugin__decision-alert"
                  actionClose={
                    <Button
                      variant="plain"
                      onClick={() => {
                        clearError();
                        setUpgradeError(null);
                      }}
                      aria-label={t('Close')}
                    >
                      &times;
                    </Button>
                  }
                >
                  {displayError}
                </Alert>
              </StackItem>
            )}
          </Stack>
        </CardBody>
      </Card>

      {/* Irreversibility confirmation modal */}
      {showIrreversibilityModal && (
        <Modal
          variant={ModalVariant.small}
          title={t('Confirm irreversible action')}
          isOpen={showIrreversibilityModal}
          onClose={() => setShowIrreversibilityModal(false)}
        >
          <Stack hasGutter>
            <StackItem>
              <Alert variant="danger" isInline title={t('This action cannot be undone')}>
                {t(
                  'The selected remediation plan is irreversible. Once executed, it cannot be reversed.',
                )}
              </Alert>
            </StackItem>
            <StackItem>
              <Content component="p">
                {t(
                  'Please review the remediation plan carefully and ensure you understand the implications before proceeding.',
                )}
              </Content>
            </StackItem>
            <StackItem>
              <Flex gap={{ default: 'gapMd' }}>
                <FlexItem>
                  <Button variant="danger" onClick={handleIrreversibilityConfirm}>
                    {t('I understand, proceed')}
                  </Button>
                </FlexItem>
                <FlexItem>
                  <Button variant="link" onClick={() => setShowIrreversibilityModal(false)}>
                    {t('Cancel')}
                  </Button>
                </FlexItem>
              </Flex>
            </StackItem>
          </Stack>
        </Modal>
      )}
    </>
  );
};

export default DecisionActions;
