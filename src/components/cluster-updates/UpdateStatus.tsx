import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Popover } from '@patternfly/react-core';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InfoCircleIcon,
  SyncAltIcon,
  ArrowCircleUpIcon,
} from '@patternfly/react-icons';
import { Link } from 'react-router';
import { k8sPatch, K8sResourceConditionStatus } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterVersion, ClusterVersionConditionType, ClusterVersionModel } from '../../models/clusterversion';
import { I18N_NAMESPACE } from '../../utils/constants';
import {
  getClusterUpdateStatus,
  ClusterUpdateStatus,
  getClusterVersionCondition,
  getDesiredClusterVersion,
} from '../../utils/cluster-updates';
import { getErrorMessage } from '../../utils/error';

const getClusterVersionResourcePath = (name: string): string => {
  const { apiGroup, apiVersion, kind } = ClusterVersionModel;
  return `/k8s/cluster/${apiGroup}~${apiVersion}~${kind}/${name}`;
};

const ClusterVersionConditionsLink: React.FC<{ cv: ClusterVersion }> = ({ cv }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const path = `${getClusterVersionResourcePath(cv.metadata?.name || 'version')}#conditions`;
  return <Link to={path}>{t('View conditions')}</Link>;
};

type UpdateStatusProps = {
  cv: ClusterVersion;
};

const truncateMiddle = (str: string, options: { length: number }): string => {
  if (str.length <= options.length) {
    return str;
  }
  const half = Math.floor(options.length / 2);
  return `${str.slice(0, half)}...${str.slice(-half)}`;
};

const StatusMessagePopover: React.FC<{ bodyContent: string; children: React.ReactNode }> = ({
  bodyContent,
  children,
}) => (
  <Popover bodyContent={truncateMiddle(bodyContent, { length: 256 })}>
    <Button variant="link" isInline>
      <span>{children}</span>
    </Button>
  </Popover>
);

const UpdatesAvailableMessage: React.FC = () => {
  const { t } = useTranslation(I18N_NAMESPACE);
  return (
    <div className="cluster-update-plugin__update-status" data-test="cv-update-status-available-updates">
      <ArrowCircleUpIcon color="var(--pf-t--global--icon--color--status--info--default)" /> {t('Available updates')}
    </div>
  );
};

const FailingMessageText: React.FC<{ cv: ClusterVersion }> = ({ cv }) => {
  const failingCondition = getClusterVersionCondition(
    cv,
    ClusterVersionConditionType.Failing,
    K8sResourceConditionStatus.True,
  );
  const { t } = useTranslation(I18N_NAMESPACE);

  if (!failingCondition || !failingCondition.message) {
    return null;
  }

  return (
    <div data-test="cv-update-status-failing">
      <StatusMessagePopover bodyContent={failingCondition.message}>
        <ExclamationCircleIcon color="var(--pf-t--global--icon--color--status--danger--default)" /> {t('Failing')}
      </StatusMessagePopover>
    </div>
  );
};

export const UpdatingMessageText: React.FC<{ cv: ClusterVersion }> = ({ cv }) => {
  const version = getDesiredClusterVersion(cv);
  const { t } = useTranslation(I18N_NAMESPACE);
  return <>{t('Update to {{version}} in progress', { version })}</>;
};

const UpdatingMessage: React.FC<{ cv: ClusterVersion; isFailing?: boolean }> = ({
  cv,
  isFailing,
}) => (
  <>
    <div data-test="cv-update-status-updating">
      <SyncAltIcon className="pf-v6-u-mr-sm" />
      <UpdatingMessageText cv={cv} />
    </div>
    {isFailing && <FailingMessageText cv={cv} />}
    <ClusterVersionConditionsLink cv={cv} />
  </>
);

const ErrorRetrievingMessage: React.FC<{ cv: ClusterVersion }> = ({ cv }) => {
  const retrievedUpdatesCondition = getClusterVersionCondition(
    cv,
    ClusterVersionConditionType.RetrievedUpdates,
    K8sResourceConditionStatus.False,
  );
  const { t } = useTranslation(I18N_NAMESPACE);

  if (!retrievedUpdatesCondition || !retrievedUpdatesCondition.message) {
    return null;
  }

  return retrievedUpdatesCondition.reason === 'NoChannel' ? (
    <div data-test="cv-update-status-no-channel">
      <InfoCircleIcon color="var(--pf-t--global--icon--color--status--info--default)" />{' '}
      {retrievedUpdatesCondition.message}
    </div>
  ) : (
    <>
      <div data-test="cv-update-status-no-updates">
        <StatusMessagePopover bodyContent={retrievedUpdatesCondition.message}>
          <ExclamationCircleIcon color="var(--pf-t--global--icon--color--status--danger--default)" />{' '}
          {t('Not retrieving updates')}
        </StatusMessagePopover>
      </div>
      <ClusterVersionConditionsLink cv={cv} />
    </>
  );
};

const FailingMessage: React.FC<{ cv: ClusterVersion }> = ({ cv }) => (
  <>
    <FailingMessageText cv={cv} />
    <ClusterVersionConditionsLink cv={cv} />
  </>
);

const InvalidMessage: React.FC<{ cv: ClusterVersion }> = ({ cv }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [inProgress, setInProgress] = React.useState(false);
  const [error, setError] = React.useState('');

  const cancelUpdate = async () => {
    setError('');
    setInProgress(true);
    try {
      await k8sPatch({
        model: ClusterVersionModel,
        resource: cv,
        data: [{ path: '/spec/desiredUpdate', op: 'remove' }],
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setInProgress(false);
    }
  };

  return (
    <div data-test="cv-update-status-invalid">
      <div>
        <ExclamationCircleIcon color="var(--pf-t--global--icon--color--status--danger--default)" />{' '}
        {t('Invalid cluster version')}
      </div>
      <Button
        onClick={cancelUpdate}
        variant="primary"
        className="pf-v6-u-mt-xs"
        isLoading={inProgress}
        isDisabled={inProgress}
      >
        {t('Cancel update')}
      </Button>
      {error && (
        <Alert variant="danger" isInline title={t('Error canceling update')} className="pf-v6-u-mt-sm">
          {error}
        </Alert>
      )}
    </div>
  );
};

const ReleaseNotAcceptedMessage: React.FC<{ cv: ClusterVersion }> = ({ cv }) => {
  const releaseNotAcceptedCondition = getClusterVersionCondition(
    cv,
    ClusterVersionConditionType.ReleaseAccepted,
    K8sResourceConditionStatus.False,
  );
  const { t } = useTranslation(I18N_NAMESPACE);

  if (!releaseNotAcceptedCondition || !releaseNotAcceptedCondition.message) {
    return null;
  }

  return (
    <>
      <div data-test="cv-update-status-release-accepted-false">
        <StatusMessagePopover bodyContent={releaseNotAcceptedCondition.message}>
          <ExclamationCircleIcon color="var(--pf-t--global--icon--color--status--danger--default)" />{' '}
          {t('Release not accepted')}
        </StatusMessagePopover>
      </div>
      <ClusterVersionConditionsLink cv={cv} />
    </>
  );
};

export const UpToDateMessage: React.FC = () => {
  const { t } = useTranslation(I18N_NAMESPACE);
  return (
    <span data-test="cv-update-status-up-to-date">
      <CheckCircleIcon color="var(--pf-t--global--icon--color--status--success--default)" /> {t('Up to date')}
    </span>
  );
};

export const UpdateStatus: React.FC<UpdateStatusProps> = ({ cv }) => {
  const status = getClusterUpdateStatus(cv);
  switch (status) {
    case ClusterUpdateStatus.Invalid:
      return <InvalidMessage cv={cv} />;
    case ClusterUpdateStatus.ReleaseNotAccepted:
      return <ReleaseNotAcceptedMessage cv={cv} />;
    case ClusterUpdateStatus.UpdatesAvailable:
      return <UpdatesAvailableMessage />;
    case ClusterUpdateStatus.Updating:
      return <UpdatingMessage cv={cv} />;
    case ClusterUpdateStatus.UpdatingAndFailing:
      return <UpdatingMessage cv={cv} isFailing />;
    case ClusterUpdateStatus.ErrorRetrieving:
      return <ErrorRetrievingMessage cv={cv} />;
    case ClusterUpdateStatus.Failing:
      return <FailingMessage cv={cv} />;
    default:
      return <UpToDateMessage />;
  }
};
