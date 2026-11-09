import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
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
import { LightspeedAgenticRun, RemediationOption } from '../../models/agenticrun';
import { I18N_NAMESPACE } from '../../utils/constants';
import { useApprovalActions } from '../../hooks/useApprovalActions';
import { useAgenticRunApprovals } from '../../hooks/useAgenticRuns';

type DecisionActionsProps = {
  agenticRun: LightspeedAgenticRun;
  selectedOption?: RemediationOption;
  selectedOptionIndex?: number;
};

const DecisionActions: React.FC<DecisionActionsProps> = ({
  agenticRun,
  selectedOption,
  selectedOptionIndex,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [approvals] = useAgenticRunApprovals();
  const approval = (approvals ?? []).find(
    (a) =>
      a.metadata?.name === agenticRun.metadata?.name &&
      a.metadata?.namespace === agenticRun.metadata?.namespace,
  );
  const { approveStage, denyStage, error, clearError, inProgress, canApprove, canApproveLoading } =
    useApprovalActions(approval);
  const [confirm, setConfirm] = React.useState<'approve' | 'deny'>();
  const decided = approval?.spec?.stages?.some((stage) => stage.type === 'Execution');
  const disabled = inProgress || !approval || !canApprove || canApproveLoading || decided;
  const canExecute = selectedOptionIndex !== undefined && !!selectedOption?.remediationPlan;

  const submit = async () => {
    if (disabled) return;
    if (confirm === 'approve' && !canExecute) return;
    const ok =
      confirm === 'approve'
        ? await approveStage('Execution', { optionIndex: selectedOptionIndex })
        : await denyStage('Execution');
    if (ok) setConfirm(undefined);
  };

  if (decided) return null;

  return (
    <>
      <Card className="cluster-update-plugin__decision-card">
        <CardTitle>{t('Awaiting decision')}</CardTitle>
        <CardBody>
          <Stack hasGutter>
            <StackItem>
              <Content component="p">
                {t(
                  'Select and review a remediation plan. Approval allows the agent to execute that plan; a platform update starts only if the plan requests one.',
                )}
              </Content>
            </StackItem>
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
                    isDisabled={disabled || !canExecute}
                    onClick={() => {
                      clearError();
                      setConfirm('approve');
                    }}
                  >
                    {t('Approve plan')}
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
                    {t('Reject plan')}
                  </Button>
                </FlexItem>
              </Flex>
            </StackItem>
          </Stack>
        </CardBody>
      </Card>
      <Modal
        variant="small"
        isOpen={!!confirm}
        onClose={() => {
          if (!inProgress) setConfirm(undefined);
        }}
        aria-labelledby="plan-decision-title"
      >
        <ModalHeader
          title={confirm === 'approve' ? t('Approve remediation plan?') : t('Reject update plan?')}
          labelId="plan-decision-title"
        />
        <ModalBody>
          <Stack hasGutter>
            <StackItem>
              {confirm === 'approve'
                ? t('The agent will execute {{title}}.', {
                    title: selectedOption?.title || t('the selected plan'),
                  })
                : t(
                    'Rejecting execution ends this agentic run. No remediation plan will be executed.',
                  )}
            </StackItem>
            {confirm === 'approve' &&
              selectedOption?.remediationPlan?.reversible === 'Irreversible' && (
                <StackItem>
                  <Alert isInline variant="warning" title={t('This remediation is irreversible')}>
                    {t(
                      'The selected remediation plan is irreversible. Once executed, it cannot be reversed.',
                    )}
                  </Alert>
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
            isDisabled={disabled || (confirm === 'approve' && !canExecute)}
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

export default DecisionActions;
