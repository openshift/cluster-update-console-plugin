import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Spinner,
} from '@patternfly/react-core';
import { PencilAltIcon } from '@patternfly/react-icons';
import { useAccessReview } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterVersion } from '../../models/clusterversion';
import { MachineConfigPoolModel, NodeTypes } from '../../models/machineconfigpool';
import { I18N_NAMESPACE } from '../../utils/constants';
import {
  getClusterUpdateStatus,
  ClusterUpdateStatus,
  hasAvailableUpdates,
  hasNotRecommendedUpdates,
  clusterIsUpToDateOrUpdateAvailable,
  getClusterID,
  getDesiredImage,
  getUpstreamURL,
} from '../../utils/cluster-updates';
import { useMachineConfigPools } from '../../hooks/useMachineConfigPools';
import { UpdatesGraph } from './UpdatesGraph';
import { UpdateStatus } from './UpdateStatus';
import { UpdateInProgress } from './UpdateInProgress';
import {
  CurrentVersion,
  CurrentVersionHeader,
  CurrentChannel,
} from './SupportingComponents';
import { ClusterUpdateModal } from '../modals/ClusterUpdateModal';
import { ClusterMoreUpdatesModal } from '../modals/ClusterMoreUpdatesModal';
import { ClusterChannelModal } from '../modals/ClusterChannelModal';
import { ConfigureUpstreamModal } from '../modals/ConfigureUpstreamModal';
import './cluster-updates.css';

type ClusterUpdatesTabProps = {
  clusterVersion: ClusterVersion;
};

export default function ClusterUpdatesTab({ clusterVersion }: ClusterUpdatesTabProps) {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [mcps, mcpsLoaded] = useMachineConfigPools();
  const [isUpdateModalOpen, setIsUpdateModalOpen] = React.useState(false);
  const [isMoreUpdatesModalOpen, setIsMoreUpdatesModalOpen] = React.useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = React.useState(false);
  const [isUpstreamModalOpen, setIsUpstreamModalOpen] = React.useState(false);

  const updateStatus = getClusterUpdateStatus(clusterVersion);
  const hasUpdates = hasAvailableUpdates(clusterVersion);
  const hasNotRecommended = hasNotRecommendedUpdates(clusterVersion);

  const clusterID = getClusterID(clusterVersion);
  const desiredImage = getDesiredImage(clusterVersion) || '';
  const imageParts = desiredImage.split('@');
  const upstreamURL = getUpstreamURL(clusterVersion);

  // Check if user can upgrade
  const [canUpgrade] = useAccessReview({
    group: 'config.openshift.io',
    resource: 'clusterversions',
    verb: 'patch',
  });

  // Check if user can edit machine config pools
  const [workerMachineConfigPoolIsEditable] = useAccessReview({
    group: MachineConfigPoolModel.apiGroup,
    resource: MachineConfigPoolModel.plural,
    verb: 'patch',
    name: NodeTypes.worker,
  });

  const showSelectVersionButton =
    canUpgrade &&
    (hasUpdates || hasNotRecommended) &&
    (updateStatus === ClusterUpdateStatus.UpdatesAvailable ||
      updateStatus === ClusterUpdateStatus.Updating ||
      updateStatus === ClusterUpdateStatus.Failing ||
      updateStatus === ClusterUpdateStatus.ErrorRetrieving ||
      (updateStatus === ClusterUpdateStatus.UpToDate && hasNotRecommended)) &&
    workerMachineConfigPoolIsEditable;

  if (!mcpsLoaded) {
    return <Spinner aria-label={t('Loading')} />;
  }

  return (
    <>
      <div className="cluster-update-plugin__settings">
        <div className="cluster-update-plugin__settings__row">
          {/* Left column - Current version */}
          <div className="cluster-update-plugin__settings__section cluster-update-plugin__settings__section--current">
            <DescriptionList className="cluster-update-plugin__settings__details">
              <DescriptionListGroup>
                <DescriptionListTerm data-test="cv-current-version-header">
                  <CurrentVersionHeader cv={clusterVersion} />
                </DescriptionListTerm>
                <DescriptionListDescription data-test="cv-current-version">
                  <CurrentVersion cv={clusterVersion} />
                </DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
          </div>

          {/* Right column - Status, Channel, and Updates */}
          <div className="cluster-update-plugin__settings__section">
          <div className="cluster-update-plugin__settings__row">
            <DescriptionList className="cluster-update-plugin__settings__details cluster-update-plugin__settings__details--status">
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Update status')}</DescriptionListTerm>
                <DescriptionListDescription>
                  <UpdateStatus cv={clusterVersion} />
                </DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
            <div className="cluster-update-plugin__settings__row">
              <DescriptionList className="cluster-update-plugin__settings__details">
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Channel')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <CurrentChannel
                      cv={clusterVersion}
                      canUpgrade={canUpgrade}
                      onEditChannel={() => setIsChannelModalOpen(true)}
                    />
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
              {showSelectVersionButton && (
                <div className="cluster-update-plugin__settings__details">
                  <Button
                    variant="primary"
                    type="button"
                    onClick={() => setIsUpdateModalOpen(true)}
                    data-test-id="cv-update-button"
                    data-test="cv-update-button"
                  >
                    {t('Select a version')}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Updates graph and alerts */}
          {clusterIsUpToDateOrUpdateAvailable(updateStatus) && (
            <>
              {!hasUpdates && hasNotRecommended && (
                <Alert
                  className="pf-v6-u-my-sm"
                  isInline
                  isPlain
                  title={t('Click "Select a version" to view versions with known issues.')}
                  variant="info"
                  data-test="cv-not-recommended-alert"
                />
              )}
              {hasUpdates && (
                <UpdatesGraph
                  clusterVersion={clusterVersion}
                  onShowMoreUpdates={() => setIsMoreUpdatesModalOpen(true)}
                />
              )}
            </>
          )}

          {/* Update progress */}
          {(updateStatus === ClusterUpdateStatus.Updating ||
            updateStatus === ClusterUpdateStatus.UpdatingAndFailing) && (
            <UpdateInProgress clusterVersion={clusterVersion} machineConfigPools={mcps} />
          )}
        </div>
        </div>
      </div>

      {/* Additional cluster details - outside bordered container */}
      <DescriptionList className="pf-v6-u-mt-lg">
        {clusterID && (
          <DescriptionListGroup>
            <DescriptionListTerm>{t('Cluster ID')}</DescriptionListTerm>
            <DescriptionListDescription className="cluster-update-plugin__select-to-copy pf-v6-u-text-break-word">
              {clusterID}
            </DescriptionListDescription>
          </DescriptionListGroup>
        )}
        {desiredImage && (
          <DescriptionListGroup>
            <DescriptionListTerm>{t('Desired release image')}</DescriptionListTerm>
            <DescriptionListDescription className="cluster-update-plugin__select-to-copy pf-v6-u-text-break-word">
              {imageParts.length === 2 ? (
                <>
                  <span className="pf-v6-u-color-200">{imageParts[0]}@</span>
                  {imageParts[1]}
                </>
              ) : (
                desiredImage
              )}
            </DescriptionListDescription>
          </DescriptionListGroup>
        )}
        <DescriptionListGroup>
          <DescriptionListTerm>{t('Upstream configuration')}</DescriptionListTerm>
          <DescriptionListDescription className="pf-v6-u-text-break-word">
            {canUpgrade ? (
              <Button
                icon={<PencilAltIcon />}
                iconPosition="end"
                type="button"
                isInline
                onClick={() => setIsUpstreamModalOpen(true)}
                variant="link"
              >
                {upstreamURL || t('Default')}
              </Button>
            ) : (
              upstreamURL || t('Default')
            )}
          </DescriptionListDescription>
        </DescriptionListGroup>
      </DescriptionList>

      {/* Update Modal */}
      <ClusterUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        clusterVersion={clusterVersion}
      />

      {/* More Updates Modal */}
      <ClusterMoreUpdatesModal
        isOpen={isMoreUpdatesModalOpen}
        onClose={() => setIsMoreUpdatesModalOpen(false)}
        clusterVersion={clusterVersion}
      />

      {/* Channel Modal */}
      <ClusterChannelModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        clusterVersion={clusterVersion}
      />

      {/* Upstream Configuration Modal */}
      <ConfigureUpstreamModal
        isOpen={isUpstreamModalOpen}
        onClose={() => setIsUpstreamModalOpen(false)}
        clusterVersion={clusterVersion}
      />
    </>
  );
}
