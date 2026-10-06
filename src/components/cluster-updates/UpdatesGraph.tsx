import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@patternfly/react-core';
import { ClusterVersion } from '../../models/clusterversion';
import { I18N_NAMESPACE } from '../../utils/constants';
import {
  getSortedAvailableUpdates,
  getLastCompletedUpdate,
  isMinorVersionNewer,
  splitClusterVersionChannel,
  getSimilarClusterVersionChannels,
  getNewerClusterVersionChannel,
  getConditionUpgradeableFalse,
} from '../../utils/cluster-updates';
import {
  Channel,
  ChannelPath,
  ChannelLine,
  ChannelVersion,
  ChannelVersionDot,
  ChannelName,
} from './ChannelComponents';
import './cluster-updates.css';

type UpdatesGraphProps = {
  clusterVersion: ClusterVersion;
  onShowMoreUpdates?: () => void;
};

export const UpdatesGraph: React.FC<UpdatesGraphProps> = ({
  clusterVersion,
  onShowMoreUpdates,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const availableUpdates = getSortedAvailableUpdates(clusterVersion);
  const lastVersion = getLastCompletedUpdate(clusterVersion) || '';
  const newestVersion = availableUpdates[0]?.version;
  const minorVersionIsNewer =
    lastVersion && newestVersion ? isMinorVersionNewer(lastVersion, newestVersion) : false;
  const secondNewestVersion = availableUpdates[1]?.version;
  const currentChannel = clusterVersion.spec?.channel || '';
  const currentPrefix = currentChannel ? splitClusterVersionChannel(currentChannel)?.prefix : '';
  const similarChannels = currentPrefix
    ? getSimilarClusterVersionChannels(clusterVersion, currentPrefix)
    : [];
  const newerChannel = currentChannel
    ? getNewerClusterVersionChannel(similarChannels, currentChannel)
    : undefined;
  const clusterUpgradeableFalse = !!getConditionUpgradeableFalse(clusterVersion);
  const newestVersionIsBlocked = clusterUpgradeableFalse && minorVersionIsNewer;

  return (
    <div className="cluster-update-plugin__updates-graph" data-test="cv-updates-graph">
      <Channel>
        <ChannelPath current>
          <ChannelLine>
            <ChannelVersion current>{lastVersion}</ChannelVersion>
            <ChannelVersionDot current channel={currentChannel} version={lastVersion} />
          </ChannelLine>
          <ChannelLine>
            {availableUpdates.length === 2 && (
              <>
                <ChannelVersion>{secondNewestVersion}</ChannelVersion>
                <ChannelVersionDot channel={currentChannel} version={secondNewestVersion} />
              </>
            )}
            {availableUpdates.length > 2 && (
              <Button
                variant="secondary"
                className="cluster-update-plugin__channel-more-versions"
                onClick={onShowMoreUpdates}
                data-test="cv-more-updates-button"
              >
                {t('+ More')}
              </Button>
            )}
          </ChannelLine>
          <ChannelLine>
            {newestVersion && (
              <>
                <ChannelVersion updateBlocked={newestVersionIsBlocked}>
                  {newestVersion}
                </ChannelVersion>
                <ChannelVersionDot
                  channel={currentChannel}
                  updateBlocked={newestVersionIsBlocked}
                  version={newestVersion}
                />
              </>
            )}
          </ChannelLine>
        </ChannelPath>
        <ChannelName current>{t('{{currentChannel}} channel', { currentChannel })}</ChannelName>
      </Channel>
      {newerChannel && (
        <Channel>
          <ChannelPath>
            <ChannelLine start>
              <div className="cluster-update-plugin__channel-switch"></div>
            </ChannelLine>
            <ChannelLine />
            <ChannelLine />
          </ChannelPath>
          <ChannelName>{t('{{newerChannel}} channel', { newerChannel })}</ChannelName>
        </Channel>
      )}
    </div>
  );
};
