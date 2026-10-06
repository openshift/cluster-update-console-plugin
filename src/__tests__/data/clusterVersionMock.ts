import type { ClusterVersion } from '../../models/clusterversion';

export const clusterVersionWithUpdates: ClusterVersion = {
  apiVersion: 'config.openshift.io/v1',
  kind: 'ClusterVersion',
  metadata: {
    creationTimestamp: '2020-08-05T17:21:42Z',
    generation: 1,
    name: 'version',
    resourceVersion: '22513',
    uid: '21194fa6-7058-47cb-9d45-782a666dd146',
  },
  spec: {
    channel: 'stable-4.15',
    clusterID: '727841c6-242d-4592-90d1-699925c4cfba',
    upstream: 'https://api.openshift.com/api/upgrades_info/v1/graph',
  },
  status: {
    availableUpdates: [
      {
        image:
          'quay.io/openshift-release-dev/ocp-release@sha256:02dfcae8f6a67e715380542654c952c981c59604b1ba7f569b13b9e5d0fbbed3',
        version: '4.15.4',
      },
      {
        image:
          'quay.io/openshift-release-dev/ocp-release@sha256:12345678901234567890123456789012345678901234567890123456789012',
        version: '4.15.3',
      },
      {
        image:
          'quay.io/openshift-release-dev/ocp-release@sha256:98765432109876543210987654321098765432109876543210987654321098',
        version: '4.16.0',
      },
    ],
    conditions: [
      {
        lastTransitionTime: '2020-08-05T17:49:47Z',
        message: 'Done applying 4.15.2',
        status: 'True',
        type: 'Available',
      },
      {
        lastTransitionTime: '2020-08-05T17:34:57Z',
        status: 'False',
        type: 'Failing',
      },
      {
        lastTransitionTime: '2020-08-05T17:49:47Z',
        message: 'Cluster version is 4.15.2',
        status: 'False',
        type: 'Progressing',
      },
      {
        lastTransitionTime: '2020-08-05T17:21:48Z',
        status: 'True',
        type: 'RetrievedUpdates',
      },
      {
        lastTransitionTime: '2020-08-05T17:21:48Z',
        status: 'True',
        type: 'Upgradeable',
      },
    ],
    desired: {
      image:
        'registry.svc.ci.openshift.org/ocp/release@sha256:8f923b7b8efdeac619eb0e7697106c1d17dd3d262c49d8742b38600417cf7d1d',
      version: '4.15.2',
      channels: ['stable-4.15', 'stable-4.16'],
    },
    history: [
      {
        completionTime: '2020-08-05T17:49:47Z',
        image:
          'registry.svc.ci.openshift.org/ocp/release@sha256:8f923b7b8efdeac619eb0e7697106c1d17dd3d262c49d8742b38600417cf7d1d',
        startedTime: '2020-08-05T17:21:48Z',
        state: 'Completed',
        verified: false,
        version: '4.15.2',
      },
    ],
    observedGeneration: 1,
  },
};

export const clusterVersionUpgradeableFalse: ClusterVersion = {
  apiVersion: 'config.openshift.io/v1',
  kind: 'ClusterVersion',
  metadata: {
    creationTimestamp: '2020-08-05T17:21:42Z',
    generation: 1,
    name: 'version',
    resourceVersion: '22513',
    uid: '21194fa6-7058-47cb-9d45-782a666dd146',
  },
  spec: {
    channel: 'stable-4.15',
    clusterID: '727841c6-242d-4592-90d1-699925c4cfba',
    upstream: 'https://api.openshift.com/api/upgrades_info/v1/graph',
  },
  status: {
    availableUpdates: [
      {
        image:
          'quay.io/openshift-release-dev/ocp-release@sha256:02dfcae8f6a67e715380542654c952c981c59604b1ba7f569b13b9e5d0fbbed3',
        version: '4.15.4',
      },
    ],
    conditions: [
      {
        lastTransitionTime: '2020-08-05T17:49:47Z',
        message: 'Done applying 4.15.2',
        status: 'True',
        type: 'Available',
      },
      {
        lastTransitionTime: '2020-08-05T17:34:57Z',
        status: 'False',
        type: 'Failing',
      },
      {
        lastTransitionTime: '2020-08-05T17:49:47Z',
        message: 'Cluster version is 4.15.2',
        status: 'False',
        type: 'Progressing',
      },
      {
        lastTransitionTime: '2020-08-05T17:21:48Z',
        status: 'True',
        type: 'RetrievedUpdates',
      },
      {
        lastTransitionTime: '2020-08-05T17:21:48Z',
        message:
          'Cluster operator testing cannot be upgraded between minor versions: The whatsits are broken.',
        reason: 'Testing',
        status: 'False',
        type: 'Upgradeable',
      },
    ],
    desired: {
      image:
        'registry.svc.ci.openshift.org/ocp/release@sha256:8f923b7b8efdeac619eb0e7697106c1d17dd3d262c49d8742b38600417cf7d1d',
      version: '4.15.2',
      channels: ['stable-4.15', 'stable-4.16'],
    },
    history: [
      {
        completionTime: '2020-08-05T17:49:47Z',
        image:
          'registry.svc.ci.openshift.org/ocp/release@sha256:8f923b7b8efdeac619eb0e7697106c1d17dd3d262c49d8742b38600417cf7d1d',
        startedTime: '2020-08-05T17:21:48Z',
        state: 'Completed',
        verified: false,
        version: '4.15.2',
      },
    ],
    observedGeneration: 1,
  },
};

export const clusterVersionUpdating: ClusterVersion = {
  apiVersion: 'config.openshift.io/v1',
  kind: 'ClusterVersion',
  metadata: {
    creationTimestamp: '2020-08-05T17:21:42Z',
    generation: 2,
    name: 'version',
    resourceVersion: '25000',
    uid: '21194fa6-7058-47cb-9d45-782a666dd146',
  },
  spec: {
    channel: 'stable-4.15',
    clusterID: '727841c6-242d-4592-90d1-699925c4cfba',
    desiredUpdate: {
      version: '4.15.4',
      image:
        'quay.io/openshift-release-dev/ocp-release@sha256:02dfcae8f6a67e715380542654c952c981c59604b1ba7f569b13b9e5d0fbbed3',
    },
  },
  status: {
    availableUpdates: undefined,
    conditions: [
      {
        lastTransitionTime: '2020-08-05T17:49:47Z',
        message: 'Done applying 4.15.2',
        status: 'True',
        type: 'Available',
      },
      {
        lastTransitionTime: '2020-08-05T17:34:57Z',
        status: 'False',
        type: 'Failing',
      },
      {
        lastTransitionTime: '2020-08-05T18:00:00Z',
        message: 'Working towards 4.15.4: 125 of 850 done (14% complete)',
        status: 'True',
        type: 'Progressing',
      },
      {
        lastTransitionTime: '2020-08-05T17:21:48Z',
        status: 'False',
        type: 'RetrievedUpdates',
      },
      {
        lastTransitionTime: '2020-08-05T17:21:48Z',
        status: 'True',
        type: 'Upgradeable',
      },
    ],
    desired: {
      image:
        'quay.io/openshift-release-dev/ocp-release@sha256:02dfcae8f6a67e715380542654c952c981c59604b1ba7f569b13b9e5d0fbbed3',
      version: '4.15.4',
      channels: ['stable-4.15', 'stable-4.16'],
    },
    history: [
      {
        image:
          'quay.io/openshift-release-dev/ocp-release@sha256:02dfcae8f6a67e715380542654c952c981c59604b1ba7f569b13b9e5d0fbbed3',
        startedTime: '2020-08-05T18:00:00Z',
        state: 'Partial',
        verified: false,
        version: '4.15.4',
      },
      {
        completionTime: '2020-08-05T17:49:47Z',
        image:
          'registry.svc.ci.openshift.org/ocp/release@sha256:8f923b7b8efdeac619eb0e7697106c1d17dd3d262c49d8742b38600417cf7d1d',
        startedTime: '2020-08-05T17:21:48Z',
        state: 'Completed',
        verified: false,
        version: '4.15.2',
      },
    ],
    observedGeneration: 2,
  },
};

export const clusterVersionUpToDate: ClusterVersion = {
  apiVersion: 'config.openshift.io/v1',
  kind: 'ClusterVersion',
  metadata: {
    creationTimestamp: '2020-08-05T17:21:42Z',
    generation: 1,
    name: 'version',
    resourceVersion: '22513',
    uid: '21194fa6-7058-47cb-9d45-782a666dd146',
  },
  spec: {
    channel: 'stable-4.15',
    clusterID: '727841c6-242d-4592-90d1-699925c4cfba',
  },
  status: {
    availableUpdates: [],
    conditions: [
      {
        lastTransitionTime: '2020-08-05T17:49:47Z',
        message: 'Done applying 4.15.2',
        status: 'True',
        type: 'Available',
      },
      {
        lastTransitionTime: '2020-08-05T17:34:57Z',
        status: 'False',
        type: 'Failing',
      },
      {
        lastTransitionTime: '2020-08-05T17:49:47Z',
        message: 'Cluster version is 4.15.2',
        status: 'False',
        type: 'Progressing',
      },
      {
        lastTransitionTime: '2020-08-05T17:21:48Z',
        status: 'True',
        type: 'RetrievedUpdates',
      },
      {
        lastTransitionTime: '2020-08-05T17:21:48Z',
        status: 'True',
        type: 'Upgradeable',
      },
    ],
    desired: {
      image:
        'registry.svc.ci.openshift.org/ocp/release@sha256:8f923b7b8efdeac619eb0e7697106c1d17dd3d262c49d8742b38600417cf7d1d',
      version: '4.15.2',
      channels: ['stable-4.15', 'stable-4.16'],
    },
    history: [
      {
        completionTime: '2020-08-05T17:49:47Z',
        image:
          'registry.svc.ci.openshift.org/ocp/release@sha256:8f923b7b8efdeac619eb0e7697106c1d17dd3d262c49d8742b38600417cf7d1d',
        startedTime: '2020-08-05T17:21:48Z',
        state: 'Completed',
        verified: false,
        version: '4.15.2',
      },
    ],
    observedGeneration: 1,
  },
};

export const clusterVersionWithNotRecommendedUpdates: ClusterVersion = {
  apiVersion: 'config.openshift.io/v1',
  kind: 'ClusterVersion',
  metadata: {
    creationTimestamp: '2020-08-05T17:21:42Z',
    generation: 1,
    name: 'version',
    resourceVersion: '22513',
    uid: '21194fa6-7058-47cb-9d45-782a666dd146',
  },
  spec: {
    channel: 'stable-4.15',
    clusterID: '727841c6-242d-4592-90d1-699925c4cfba',
  },
  status: {
    availableUpdates: [],
    conditionalUpdates: [
      {
        release: {
          image:
            'quay.io/openshift-release-dev/ocp-release@sha256:abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
          version: '4.15.5',
        },
        risks: [
          {
            name: 'KnownIssue',
            message: 'This version has known issues with cluster networking.',
            matchingRules: [
              {
                type: 'PromQL',
                promql: {
                  promql: 'some_metric > 0',
                },
              },
            ],
            url: 'https://access.redhat.com/solutions/12345',
          },
        ],
        conditions: [
          {
            type: 'Recommended',
            status: 'False',
            reason: 'KnownIssue',
            message: 'This version has known issues',
          },
        ],
      },
    ],
    conditions: [
      {
        lastTransitionTime: '2020-08-05T17:49:47Z',
        message: 'Done applying 4.15.2',
        status: 'True',
        type: 'Available',
      },
      {
        lastTransitionTime: '2020-08-05T17:34:57Z',
        status: 'False',
        type: 'Failing',
      },
      {
        lastTransitionTime: '2020-08-05T17:49:47Z',
        message: 'Cluster version is 4.15.2',
        status: 'False',
        type: 'Progressing',
      },
      {
        lastTransitionTime: '2020-08-05T17:21:48Z',
        status: 'True',
        type: 'RetrievedUpdates',
      },
      {
        lastTransitionTime: '2020-08-05T17:21:48Z',
        status: 'True',
        type: 'Upgradeable',
      },
    ],
    desired: {
      image:
        'registry.svc.ci.openshift.org/ocp/release@sha256:8f923b7b8efdeac619eb0e7697106c1d17dd3d262c49d8742b38600417cf7d1d',
      version: '4.15.2',
      channels: ['stable-4.15', 'stable-4.16'],
    },
    history: [
      {
        completionTime: '2020-08-05T17:49:47Z',
        image:
          'registry.svc.ci.openshift.org/ocp/release@sha256:8f923b7b8efdeac619eb0e7697106c1d17dd3d262c49d8742b38600417cf7d1d',
        startedTime: '2020-08-05T17:21:48Z',
        state: 'Completed',
        verified: false,
        version: '4.15.2',
      },
    ],
    observedGeneration: 1,
  },
};
