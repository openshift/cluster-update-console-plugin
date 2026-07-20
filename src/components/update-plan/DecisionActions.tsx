import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  Flex,
  Label,
} from '@patternfly/react-core';
import { CheckIcon } from '@patternfly/react-icons';
import { LightspeedAgenticRun, LightspeedAgenticRunApproval } from '../../models/agenticrun';
import { ClusterVersion, ClusterVersionModel } from '../../models/clusterversion';
import { I18N_NAMESPACE, LABELS } from '../../utils/constants';
import { unsanitizeVersion } from '../../utils/version';
import { getErrorMessage } from '../../utils/error';
import { useApprovalActions } from '../../hooks/useApprovalActions';
import { useAgenticRunApprovals } from '../../hooks/useAgenticRuns';

type DecisionActionsProps = {
  agenticRun: LightspeedAgenticRun;
  clusterVersion: ClusterVersion;
};

const CONFIRM_TIMEOUT_MS = 5000;

const DecisionActions: React.FC<DecisionActionsProps> = ({ agenticRun, clusterVersion }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const history = useHistory();

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

  const [confirmingApprove, setConfirmingApprove] = React.useState(false);
  const [confirmingDeny, setConfirmingDeny] = React.useState(false);
  const [upgradeError, setUpgradeError] = React.useState<string | null>(null);
  const approveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const denyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (approveTimerRef.current) clearTimeout(approveTimerRef.current);
      if (denyTimerRef.current) clearTimeout(denyTimerRef.current);
    };
  }, []);

  const handleApproveClick = React.useCallback(async () => {
    if (confirmingApprove) {
      if (approveTimerRef.current) clearTimeout(approveTimerRef.current);
      setConfirmingApprove(false);
      setUpgradeError(null);

      const approved = await approveStage('Analysis');
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
        history.push('/settings/cluster');
      } catch (err) {
        setUpgradeError(getErrorMessage(err));
      }
    } else {
      setConfirmingApprove(true);
      setConfirmingDeny(false);
      if (denyTimerRef.current) clearTimeout(denyTimerRef.current);
      approveTimerRef.current = setTimeout(() => {
        setConfirmingApprove(false);
      }, CONFIRM_TIMEOUT_MS);
    }
  }, [confirmingApprove, approveStage, agenticRun, clusterVersion, history, t]);

  const handleDenyClick = React.useCallback(async () => {
    if (confirmingDeny) {
      if (denyTimerRef.current) clearTimeout(denyTimerRef.current);
      setConfirmingDeny(false);
      setUpgradeError(null);
      const denied = await denyStage('Analysis');
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

  const displayError = error || upgradeError;

  return (
    <Card className="cluster-update-plugin__decision-card">
      <CardTitle>
        <span className="cluster-update-plugin__decision-title-text">{t('Awaiting Decision')}</span>
        <Label color="orange" isCompact className="cluster-update-plugin__decision-badge">
          {t('Pending')}
        </Label>
      </CardTitle>
      <CardBody>
        <Content component="p" className="cluster-update-plugin__decision-description">
          {t(
            "Plan ready — Clicking 'Start update' will begin the cluster update and redirect you to the cluster settings page to monitor progress. OCP updates are irreversible.",
          )}
        </Content>
        <Flex gap={{ default: 'gapLg' }} className="cluster-update-plugin__decision-action-group">
          <Button
            variant="primary"
            icon={<CheckIcon />}
            onClick={handleApproveClick}
            isDisabled={inProgress || !approval}
            isLoading={inProgress && confirmingApprove}
          >
            {confirmingApprove ? t('Confirm and start update') : t('Start update')}
          </Button>
          <Button variant="secondary" isDisabled>
            {t('Schedule for later')}
          </Button>
          <Button
            variant="danger"
            onClick={handleDenyClick}
            isDisabled={inProgress || !approval}
            isLoading={inProgress && confirmingDeny}
          >
            {confirmingDeny ? t('Confirm reject') : t('Reject plan')}
          </Button>
        </Flex>
        {displayError && (
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
        )}
      </CardBody>
    </Card>
  );
};

export default DecisionActions;
