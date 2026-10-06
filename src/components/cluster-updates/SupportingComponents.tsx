import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@patternfly/react-core';
import { ExternalLinkAltIcon, PencilAltIcon, ExclamationTriangleIcon } from '@patternfly/react-icons';
import { ClusterVersion } from '../../models/clusterversion';
import { I18N_NAMESPACE } from '../../utils/constants';
import {
  getReleaseNotesLink,
  getCurrentVersion,
  getDesiredClusterVersion,
  getLastCompletedUpdate,
  getClusterUpdateStatus,
  clusterIsUpToDateOrUpdateAvailable,
} from '../../utils/cluster-updates';

export const ReleaseNotesLink: React.FC<{ version: string | undefined }> = ({ version }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  if (!version) {
    return null;
  }
  const releaseNotesLink = getReleaseNotesLink(version);
  return releaseNotesLink ? (
    <Button
      variant="link"
      isInline
      icon={<ExternalLinkAltIcon />}
      iconPosition="end"
      component="a"
      href={releaseNotesLink}
      target="_blank"
      rel="noopener noreferrer"
    >
      {t('View release notes')}
    </Button>
  ) : null;
};

export const CurrentVersion: React.FC<{ cv: ClusterVersion }> = ({ cv }) => {
  const desiredVersion = getDesiredClusterVersion(cv);
  const lastVersion = getLastCompletedUpdate(cv);
  const status = getClusterUpdateStatus(cv);
  const { t } = useTranslation(I18N_NAMESPACE);

  if (clusterIsUpToDateOrUpdateAvailable(status)) {
    return desiredVersion ? (
      <>
        <div>
          <span data-test="cluster-version" data-test-id="cluster-version">
            {desiredVersion}
          </span>
        </div>
        <ReleaseNotesLink version={getCurrentVersion(cv)} />
      </>
    ) : (
      <>
        <ExclamationTriangleIcon color="var(--pf-t--global--icon--color--status--warning--default)" />
        &nbsp;{t('Unknown')}
      </>
    );
  }

  return lastVersion ? (
    <>
      <div>
        <span data-test="cluster-version" data-test-id="cluster-version">
          {lastVersion}
        </span>
      </div>
      <ReleaseNotesLink version={lastVersion} />
    </>
  ) : (
    <>{t('None')}</>
  );
};

export const CurrentVersionHeader: React.FC<{ cv: ClusterVersion }> = ({ cv }) => {
  const status = getClusterUpdateStatus(cv);
  const { t } = useTranslation(I18N_NAMESPACE);
  return (
    <>
      {clusterIsUpToDateOrUpdateAvailable(status)
        ? t('Current version')
        : t('Last completed version')}
    </>
  );
};

export const CurrentChannel: React.FC<{
  cv: ClusterVersion;
  canUpgrade: boolean;
  onEditChannel: () => void;
}> = ({ cv, canUpgrade, onEditChannel }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const label = cv.spec?.channel || t('Not configured');
  return canUpgrade ? (
    <Button
      icon={<PencilAltIcon />}
      iconPosition="end"
      type="button"
      isInline
      data-test-id="current-channel-update-link"
      data-test="current-channel-update-link"
      onClick={onEditChannel}
      variant="link"
    >
      {label}
    </Button>
  ) : (
    <>{label}</>
  );
};
