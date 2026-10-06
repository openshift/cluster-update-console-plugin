import {
  getSortedAvailableUpdates,
  hasAvailableUpdates,
  hasNotRecommendedUpdates,
  getClusterUpdateStatus,
  ClusterUpdateStatus,
  getAvailableClusterChannels,
  getDesiredClusterVersion,
  getClusterVersionChannel,
  getLastCompletedUpdate,
  getCurrentVersion,
  getConditionUpgradeableFalse,
  getClusterID,
  getDesiredImage,
  getUpstreamURL,
  getReleaseNotesLink,
  clusterIsUpToDateOrUpdateAvailable,
  getNewerMinorVersionUpdate,
  isMinorVersionNewer,
} from '../utils/cluster-updates';
import type { ClusterVersion } from '../models/clusterversion';
import {
  clusterVersionWithUpdates,
  clusterVersionUpgradeableFalse,
  clusterVersionUpdating,
  clusterVersionUpToDate,
  clusterVersionWithNotRecommendedUpdates,
} from './data/clusterVersionMock';

describe('getSortedAvailableUpdates', () => {
  it('sorts available updates by version in descending order', () => {
    const updates = getSortedAvailableUpdates(clusterVersionWithUpdates);
    expect(updates).toHaveLength(3);
    expect(updates[0].version).toBe('4.16.0');
    expect(updates[1].version).toBe('4.15.4');
    expect(updates[2].version).toBe('4.15.3');
  });

  it('returns empty array when no updates available', () => {
    const updates = getSortedAvailableUpdates(clusterVersionUpToDate);
    expect(updates).toEqual([]);
  });

  it('returns empty array when availableUpdates is null', () => {
    const updates = getSortedAvailableUpdates(clusterVersionUpdating);
    expect(updates).toEqual([]);
  });
});

describe('hasAvailableUpdates', () => {
  it('returns true when updates are available', () => {
    expect(hasAvailableUpdates(clusterVersionWithUpdates)).toBe(true);
  });

  it('returns false when no updates available', () => {
    expect(hasAvailableUpdates(clusterVersionUpToDate)).toBe(false);
  });

  it('returns false when availableUpdates is null', () => {
    expect(hasAvailableUpdates(clusterVersionUpdating)).toBe(false);
  });
});

describe('hasNotRecommendedUpdates', () => {
  it('returns true when conditional updates exist', () => {
    expect(hasNotRecommendedUpdates(clusterVersionWithNotRecommendedUpdates)).toBe(true);
  });

  it('returns false when no conditional updates', () => {
    expect(hasNotRecommendedUpdates(clusterVersionWithUpdates)).toBe(false);
  });

  it('returns false when conditionalUpdates is undefined', () => {
    expect(hasNotRecommendedUpdates(clusterVersionUpToDate)).toBe(false);
  });
});

describe('getClusterUpdateStatus', () => {
  it('returns UpdatesAvailable when updates exist and cluster is up to date', () => {
    const status = getClusterUpdateStatus(clusterVersionWithUpdates);
    expect(status).toBe(ClusterUpdateStatus.UpdatesAvailable);
  });

  it('returns UpToDate when no updates available', () => {
    const status = getClusterUpdateStatus(clusterVersionUpToDate);
    expect(status).toBe(ClusterUpdateStatus.UpToDate);
  });

  it('returns Updating when cluster is progressing', () => {
    const status = getClusterUpdateStatus(clusterVersionUpdating);
    expect(status).toBe(ClusterUpdateStatus.Updating);
  });

  it('returns UpdatesAvailable even when Upgradeable=False', () => {
    const status = getClusterUpdateStatus(clusterVersionUpgradeableFalse);
    expect(status).toBe(ClusterUpdateStatus.UpdatesAvailable);
  });
});

describe('getAvailableClusterChannels', () => {
  it('returns channels from status.desired.channels', () => {
    const channels = getAvailableClusterChannels(clusterVersionWithUpdates);
    expect(channels).toEqual(['stable-4.15', 'stable-4.16']);
  });

  it('returns empty array when no channels available', () => {
    const cvNoChannels = {
      ...clusterVersionWithUpdates,
      status: {
        ...clusterVersionWithUpdates.status,
        desired: {
          ...clusterVersionWithUpdates.status?.desired,
          version: '4.15.2',
          image: 'test-image',
          channels: undefined,
        },
      },
    } as ClusterVersion;
    const channels = getAvailableClusterChannels(cvNoChannels);
    expect(channels).toEqual([]);
  });
});

describe('getDesiredClusterVersion', () => {
  it('returns the desired version from status', () => {
    const version = getDesiredClusterVersion(clusterVersionWithUpdates);
    expect(version).toBe('4.15.2');
  });

  it('returns undefined when status.desired is missing', () => {
    const cvNoDesired = {
      ...clusterVersionWithUpdates,
      status: undefined,
    };
    const version = getDesiredClusterVersion(cvNoDesired);
    expect(version).toBeUndefined();
  });
});

describe('getClusterVersionChannel', () => {
  it('returns the channel from spec', () => {
    const channel = getClusterVersionChannel(clusterVersionWithUpdates);
    expect(channel).toBe('stable-4.15');
  });

  it('returns undefined when spec.channel is missing', () => {
    const cvNoChannel = {
      ...clusterVersionWithUpdates,
      spec: {
        ...clusterVersionWithUpdates.spec,
        channel: undefined,
      },
    };
    const channel = getClusterVersionChannel(cvNoChannel);
    expect(channel).toBeUndefined();
  });
});

describe('getLastCompletedUpdate', () => {
  it('returns the version of the first completed update in history', () => {
    const version = getLastCompletedUpdate(clusterVersionWithUpdates);
    expect(version).toBe('4.15.2');
  });

  it('returns the second history entry when first is Partial', () => {
    const version = getLastCompletedUpdate(clusterVersionUpdating);
    expect(version).toBe('4.15.2');
  });

  it('returns undefined when no history exists', () => {
    const cvNoHistory = {
      ...clusterVersionWithUpdates,
      status: {
        ...clusterVersionWithUpdates.status,
        desired: clusterVersionWithUpdates.status?.desired || { version: '4.15.2', image: 'test-image' },
        history: undefined,
      },
    } as ClusterVersion;
    const version = getLastCompletedUpdate(cvNoHistory);
    expect(version).toBeUndefined();
  });
});

describe('getCurrentVersion', () => {
  it('returns desired version when cluster is up to date', () => {
    const version = getCurrentVersion(clusterVersionWithUpdates);
    expect(version).toBe('4.15.2');
  });

  it('returns updating version when cluster is updating', () => {
    const version = getCurrentVersion(clusterVersionUpdating);
    expect(version).toBe('4.15.4');
  });
});

describe('getConditionUpgradeableFalse', () => {
  it('returns the Upgradeable=False condition when it exists', () => {
    const condition = getConditionUpgradeableFalse(clusterVersionUpgradeableFalse);
    expect(condition).toBeDefined();
    expect(condition?.type).toBe('Upgradeable');
    expect(condition?.status).toBe('False');
    expect(condition?.message).toContain('whatsits are broken');
  });

  it('returns undefined when Upgradeable=True', () => {
    const condition = getConditionUpgradeableFalse(clusterVersionWithUpdates);
    expect(condition).toBeUndefined();
  });

  it('returns undefined when no conditions exist', () => {
    const cvNoConditions = {
      ...clusterVersionWithUpdates,
      status: {
        ...clusterVersionWithUpdates.status,
        desired: clusterVersionWithUpdates.status?.desired || { version: '4.15.2', image: 'test-image' },
        conditions: undefined,
      },
    } as ClusterVersion;
    const condition = getConditionUpgradeableFalse(cvNoConditions);
    expect(condition).toBeUndefined();
  });
});

describe('getClusterID', () => {
  it('returns the cluster ID from spec', () => {
    const id = getClusterID(clusterVersionWithUpdates);
    expect(id).toBe('727841c6-242d-4592-90d1-699925c4cfba');
  });

  it('returns undefined when clusterID is missing', () => {
    const cvNoID = {
      ...clusterVersionWithUpdates,
      spec: {
        ...clusterVersionWithUpdates.spec,
        clusterID: undefined,
      },
    };
    const id = getClusterID(cvNoID);
    expect(id).toBeUndefined();
  });
});

describe('getDesiredImage', () => {
  it('returns the desired image from status', () => {
    const image = getDesiredImage(clusterVersionWithUpdates);
    expect(image).toBe(
      'registry.svc.ci.openshift.org/ocp/release@sha256:8f923b7b8efdeac619eb0e7697106c1d17dd3d262c49d8742b38600417cf7d1d',
    );
  });

  it('returns undefined when status.desired is missing', () => {
    const cvNoDesired = {
      ...clusterVersionWithUpdates,
      status: undefined,
    };
    const image = getDesiredImage(cvNoDesired);
    expect(image).toBeUndefined();
  });
});

describe('getUpstreamURL', () => {
  it('returns the upstream URL from spec', () => {
    const url = getUpstreamURL(clusterVersionWithUpdates);
    expect(url).toBe('https://api.openshift.com/api/upgrades_info/v1/graph');
  });

  it('returns undefined when upstream is not set', () => {
    const cvNoUpstream = {
      ...clusterVersionWithUpdates,
      spec: {
        ...clusterVersionWithUpdates.spec,
        upstream: undefined,
      },
    };
    const url = getUpstreamURL(cvNoUpstream);
    expect(url).toBeUndefined();
  });
});

describe('getReleaseNotesLink', () => {
  it('returns release notes link for valid OCP version', () => {
    const link = getReleaseNotesLink('4.15.2');
    expect(link).toBe('https://access.redhat.com/documentation/en-us/openshift_container_platform/4.15/html/release_notes/ocp-4-15-release-notes#ocp-4-15-2_release-notes');
  });

  it('returns release notes link for z-stream version', () => {
    const link = getReleaseNotesLink('4.15.10');
    expect(link).toBe('https://access.redhat.com/documentation/en-us/openshift_container_platform/4.15/html/release_notes/ocp-4-15-release-notes#ocp-4-15-10_release-notes');
  });

  it('returns undefined for invalid version', () => {
    const link = getReleaseNotesLink('invalid');
    expect(link).toBeUndefined();
  });

  it('returns undefined for non-OCP version', () => {
    const link = getReleaseNotesLink('1.2.3');
    expect(link).toBeUndefined();
  });
});

describe('clusterIsUpToDateOrUpdateAvailable', () => {
  it('returns true for UpToDate status', () => {
    expect(clusterIsUpToDateOrUpdateAvailable(ClusterUpdateStatus.UpToDate)).toBe(true);
  });

  it('returns true for UpdatesAvailable status', () => {
    expect(clusterIsUpToDateOrUpdateAvailable(ClusterUpdateStatus.UpdatesAvailable)).toBe(true);
  });

  it('returns false for Updating status', () => {
    expect(clusterIsUpToDateOrUpdateAvailable(ClusterUpdateStatus.Updating)).toBe(false);
  });

  it('returns false for Failing status', () => {
    expect(clusterIsUpToDateOrUpdateAvailable(ClusterUpdateStatus.Failing)).toBe(false);
  });

  it('returns false for ErrorRetrieving status', () => {
    expect(clusterIsUpToDateOrUpdateAvailable(ClusterUpdateStatus.ErrorRetrieving)).toBe(false);
  });
});

describe('getNewerMinorVersionUpdate', () => {
  it('returns the update with a newer minor version', () => {
    const currentVersion = '4.15.2';
    const updates = [
      { version: '4.15.4', image: 'image1' },
      { version: '4.16.0', image: 'image2' },
      { version: '4.15.3', image: 'image3' },
    ];
    const newerUpdate = getNewerMinorVersionUpdate(currentVersion, updates);
    expect(newerUpdate?.version).toBe('4.16.0');
  });

  it('returns undefined when no newer minor version exists', () => {
    const currentVersion = '4.15.2';
    const updates = [
      { version: '4.15.4', image: 'image1' },
      { version: '4.15.3', image: 'image2' },
    ];
    const newerUpdate = getNewerMinorVersionUpdate(currentVersion, updates);
    expect(newerUpdate).toBeUndefined();
  });

  it('returns undefined for empty updates array', () => {
    const newerUpdate = getNewerMinorVersionUpdate('4.15.2', []);
    expect(newerUpdate).toBeUndefined();
  });
});

describe('isMinorVersionNewer', () => {
  it('returns true when other version has newer minor', () => {
    expect(isMinorVersionNewer('4.15.2', '4.16.0')).toBe(true);
  });

  it('returns false when other version has same minor', () => {
    expect(isMinorVersionNewer('4.15.2', '4.15.4')).toBe(false);
  });

  it('returns false when other version has older minor', () => {
    expect(isMinorVersionNewer('4.15.2', '4.14.0')).toBe(false);
  });

  it('returns true when other version has newer major', () => {
    expect(isMinorVersionNewer('4.15.2', '5.0.0')).toBe(true);
  });

  it('returns false when other version has older major', () => {
    expect(isMinorVersionNewer('4.15.2', '3.11.0')).toBe(false);
  });

  it('handles invalid versions gracefully', () => {
    expect(isMinorVersionNewer('invalid', '4.15.0')).toBe(false);
    expect(isMinorVersionNewer('4.15.0', 'invalid')).toBe(false);
  });
});
