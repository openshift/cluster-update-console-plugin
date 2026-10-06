import * as semver from 'semver';
import {
  K8sResourceCondition,
  K8sResourceConditionStatus,
  k8sPatch,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  ClusterVersion,
  ClusterVersionCondition,
  ClusterVersionConditionType,
  ConditionalUpdate,
  Release,
  UpdateHistory,
} from '../models/clusterversion';
import { MachineConfigPool, MachineConfigPoolModel } from '../models/machineconfigpool';

export enum ClusterUpdateStatus {
  UpToDate = 'Up to Date',
  UpdatesAvailable = 'Updates Available',
  Updating = 'Updating',
  Failing = 'Failing',
  UpdatingAndFailing = 'Updating and Failing',
  ErrorRetrieving = 'Error Retrieving',
  Invalid = 'Invalid Cluster Version',
  ReleaseNotAccepted = 'Release Not Accepted',
}

const getAvailableClusterUpdates = (cv: ClusterVersion): Release[] =>
  cv?.status?.availableUpdates?.map((update) => ({
    version: update.version,
    image: update.image,
  })) || [];

export const getSortedAvailableUpdates = (cv: ClusterVersion): Release[] => {
  const available = getAvailableClusterUpdates(cv);
  try {
    return available.sort(({ version: left }, { version: right }) => semver.rcompare(left, right));
  } catch (e) {
    console.error('error sorting available cluster updates', e);
    return available;
  }
};

const getConditionalClusterUpdates = (cv: ClusterVersion): ConditionalUpdate[] =>
  cv?.status?.conditionalUpdates?.map((update) => ({
    conditions: update.conditions,
    release: {
      image: update.release.image,
      version: update.release.version,
    },
    risks: update.risks,
  })) ?? [];

export const getNotRecommendedUpdateCondition = (
  conditions: K8sResourceCondition[],
): K8sResourceCondition | undefined =>
  conditions?.find((condition) => condition.type === 'Recommended' && condition.status !== 'True');

const getNotRecommendedUpdates = (cv: ClusterVersion): ConditionalUpdate[] =>
  getConditionalClusterUpdates(cv).filter(
    (update) => update.conditions && getNotRecommendedUpdateCondition(update.conditions),
  );

export const getSortedNotRecommendedUpdates = (cv: ClusterVersion): ConditionalUpdate[] => {
  const notRecommended = getNotRecommendedUpdates(cv);
  try {
    return notRecommended.sort(({ release: { version: left } }, { release: { version: right } }) =>
      semver.rcompare(left, right),
    );
  } catch (e) {
    console.error('error sorting conditional cluster updates', e);
    return notRecommended;
  }
};

export const getNewerMinorVersionUpdate = (currentVersion: string, availableUpdates: Release[]) => {
  const currentVersionParsed = semver.parse(currentVersion);
  if (!currentVersionParsed) {
    return;
  }
  return availableUpdates?.find((update) => {
    const updateParsed = semver.parse(update.version);
    if (!updateParsed) {
      return false;
    }
    const updateCoerced = semver.coerce(`${updateParsed.major}.${updateParsed.minor}`);
    const currentCoerced = semver.coerce(
      `${currentVersionParsed.major}.${currentVersionParsed.minor}`,
    );
    return updateCoerced && currentCoerced && semver.gt(updateCoerced, currentCoerced);
  });
};

export const isMinorVersionNewer = (currentVersion: string, otherVersion: string): boolean => {
  const currentVersionParsed = semver.parse(currentVersion);
  const otherVersionParsed = semver.parse(otherVersion);
  if (!currentVersionParsed || !otherVersionParsed) {
    return false;
  }
  const otherCoerced = semver.coerce(`${otherVersionParsed.major}.${otherVersionParsed.minor}`);
  const currentCoerced = semver.coerce(
    `${currentVersionParsed.major}.${currentVersionParsed.minor}`,
  );
  return !!(otherCoerced && currentCoerced && semver.gt(otherCoerced, currentCoerced));
};

export const getAvailableClusterChannels = (cv: ClusterVersion): string[] =>
  cv?.status?.desired?.channels || [];

export const getDesiredClusterVersion = (cv: ClusterVersion): string | undefined =>
  cv?.status?.desired?.version;

export const getClusterVersionChannel = (cv: ClusterVersion): string | undefined =>
  cv?.spec?.channel;

export const splitClusterVersionChannel = (
  channel: string,
): { prefix: string; version: string } | null => {
  const parsed = /^(.+)-(\d\.\d+)$/.exec(channel);
  return parsed ? { prefix: parsed[1], version: parsed[2] } : null;
};

export const getSimilarClusterVersionChannels = (
  cv: ClusterVersion,
  currentPrefix: string,
): string[] =>
  getAvailableClusterChannels(cv).filter(
    (channel: string) =>
      currentPrefix && splitClusterVersionChannel(channel)?.prefix === currentPrefix,
  );

export const getNewerClusterVersionChannel = (
  similarChannels: string[],
  currentChannel: string,
): string | undefined =>
  similarChannels.find((channel) => {
    const channelCoerced = semver.coerce(channel);
    const currentCoerced = semver.coerce(currentChannel);
    return (
      channelCoerced && currentCoerced && semver.gt(channelCoerced.version, currentCoerced.version)
    );
  });

export const getLastCompletedUpdate = (cv: ClusterVersion): string | undefined => {
  const history: UpdateHistory[] = cv?.status?.history || [];
  const lastCompleted = history.find((update) => update.state === 'Completed');
  return lastCompleted?.version;
};

export const getClusterVersionCondition = (
  cv: ClusterVersion,
  type: ClusterVersionConditionType,
  status?: K8sResourceConditionStatus,
): ClusterVersionCondition | undefined => {
  const conditions = (cv?.status?.conditions || []) as ClusterVersionCondition[];
  if (status) {
    return conditions.find((c) => c.type === type && c.status === status);
  }
  return conditions.find((c) => c.type === type);
};

const isProgressing = (cv: ClusterVersion): boolean =>
  !!getClusterVersionCondition(
    cv,
    ClusterVersionConditionType.Progressing,
    K8sResourceConditionStatus.True,
  );

const invalid = (cv: ClusterVersion): boolean =>
  !!getClusterVersionCondition(
    cv,
    ClusterVersionConditionType.Invalid,
    K8sResourceConditionStatus.True,
  );

const releaseNotAccepted = (cv: ClusterVersion): boolean =>
  !!getClusterVersionCondition(
    cv,
    ClusterVersionConditionType.ReleaseAccepted,
    K8sResourceConditionStatus.False,
  );

const failedToRetrieveUpdates = (cv: ClusterVersion): boolean =>
  !!getClusterVersionCondition(
    cv,
    ClusterVersionConditionType.RetrievedUpdates,
    K8sResourceConditionStatus.False,
  );

const updateFailing = (cv: ClusterVersion): boolean =>
  !!getClusterVersionCondition(
    cv,
    ClusterVersionConditionType.Failing,
    K8sResourceConditionStatus.True,
  );

export const hasAvailableUpdates = (cv: ClusterVersion): boolean =>
  getAvailableClusterUpdates(cv).length > 0;

export const hasNotRecommendedUpdates = (cv: ClusterVersion): boolean =>
  getNotRecommendedUpdates(cv).length > 0;

export const getClusterUpdateStatus = (cv: ClusterVersion): ClusterUpdateStatus => {
  if (invalid(cv)) {
    return ClusterUpdateStatus.Invalid;
  }

  if (releaseNotAccepted(cv)) {
    return ClusterUpdateStatus.ReleaseNotAccepted;
  }

  if (isProgressing(cv) && updateFailing(cv)) {
    return ClusterUpdateStatus.UpdatingAndFailing;
  }

  if (updateFailing(cv)) {
    return ClusterUpdateStatus.Failing;
  }

  if (isProgressing(cv)) {
    return ClusterUpdateStatus.Updating;
  }

  if (failedToRetrieveUpdates(cv)) {
    return ClusterUpdateStatus.ErrorRetrieving;
  }

  return hasAvailableUpdates(cv)
    ? ClusterUpdateStatus.UpdatesAvailable
    : ClusterUpdateStatus.UpToDate;
};

export const getOpenShiftVersion = (cv: ClusterVersion): string | undefined => {
  const lastUpdate = cv?.status?.history?.[0];
  if (!lastUpdate) {
    return undefined;
  }
  return lastUpdate.state === 'Partial' ? `Updating to ${lastUpdate.version}` : lastUpdate.version;
};

export const getCurrentVersion = (cv: ClusterVersion): string | undefined =>
  cv?.status?.history?.[0]?.version || cv?.spec?.desiredUpdate?.version;

export const getReleaseNotesLink = (version: string): string | undefined => {
  const parsed = semver.parse(version);
  if (!parsed) {
    return undefined;
  }

  const { major, minor, patch, prerelease } = parsed;
  if (major !== 4 || prerelease.length > 0) {
    return undefined;
  }

  return `https://access.redhat.com/documentation/en-us/openshift_container_platform/${major}.${minor}/html/release_notes/ocp-${major}-${minor}-release-notes#ocp-${major}-${minor}-${patch}_release-notes`;
};

export const getClusterID = (cv: ClusterVersion): string | undefined => cv?.spec?.clusterID;

export const getDesiredImage = (cv: ClusterVersion): string | undefined =>
  cv?.status?.desired?.image;

export const getUpstreamURL = (cv: ClusterVersion): string | undefined => cv?.spec?.upstream;

export const getConditionUpgradeableFalse = (
  cv: ClusterVersion,
): ClusterVersionCondition | undefined =>
  cv?.status?.conditions?.find(
    (c) => c.type === 'Upgradeable' && c.status === K8sResourceConditionStatus.False,
  ) as ClusterVersionCondition | undefined;

export const clusterIsUpToDateOrUpdateAvailable = (status: ClusterUpdateStatus): boolean =>
  status === ClusterUpdateStatus.UpToDate || status === ClusterUpdateStatus.UpdatesAvailable;

export const getMCPsToPausePromises = (
  machineConfigPools: MachineConfigPool[],
  paused: boolean,
): Promise<MachineConfigPool>[] =>
  machineConfigPools.map((mcp) => {
    const patch = [{ op: 'add', path: '/spec/paused', value: paused }];
    return k8sPatch({
      model: MachineConfigPoolModel,
      resource: mcp,
      data: patch,
    });
  });
