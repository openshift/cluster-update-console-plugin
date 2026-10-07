import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertActionCloseButton } from '@patternfly/react-core';
import { useApprovalPolicy } from '../../hooks/useAgenticRuns';
import { I18N_NAMESPACE } from '../../utils/constants';

const DISMISSAL_KEY = 'cluster-update-plugin.approval-policy-warning.dismissed';

const ApprovalPolicyWarningBanner: React.FC = () => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [policy, loaded, error] = useApprovalPolicy();
  const [dismissed, setDismissed] = React.useState(() => {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(DISMISSAL_KEY) === 'true';
    }
    return false;
  });

  const handleDismiss = React.useCallback(() => {
    setDismissed(true);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(DISMISSAL_KEY, 'true');
    }
  }, []);

  // Clear dismissal if policy changes to Manual for both stages
  React.useEffect(() => {
    if (!loaded || !policy) return;

    const stages = policy.spec?.stages ?? [];
    const analysisStage = stages.find((s) => s.name === 'Analysis');
    const executionStage = stages.find((s) => s.name === 'Execution');
    const bothManual =
      analysisStage?.approval === 'Manual' && executionStage?.approval === 'Manual';

    if (bothManual && dismissed) {
      setDismissed(false);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(DISMISSAL_KEY);
      }
    }
  }, [policy, loaded, dismissed]);

  if (!loaded || error || !policy || dismissed) {
    return null;
  }

  const stages = policy.spec?.stages ?? [];
  const analysisStage = stages.find((s) => s.name === 'Analysis');
  const executionStage = stages.find((s) => s.name === 'Execution');

  const showBanner = analysisStage?.approval !== 'Manual' || executionStage?.approval !== 'Manual';

  if (!showBanner) {
    return null;
  }

  return (
    <Alert
      variant="warning"
      isInline
      title={t('Cluster ApprovalPolicy not set to Manual for all stages')}
      actionClose={<AlertActionCloseButton onClose={handleDismiss} />}
    >
      {t(
        'For upgrade workflows, it is strongly recommended to set ApprovalPolicy to Manual for both Analysis and Execution stages to ensure all upgrade actions require explicit administrator approval.',
      )}{' '}
      <a
        href="https://docs.openshift.com/container-platform/latest/updating/updating_a_cluster/update-using-custom-machine-config-pools.html"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('Learn more')}
      </a>
    </Alert>
  );
};

export default ApprovalPolicyWarningBanner;
