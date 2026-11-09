import {
  clusterUpdateProgress,
  poolProgress,
  verificationUpdateState,
} from '../utils/update-progress';
import { ClusterVersion } from '../models/clusterversion';
import {
  ClusterOperator,
  MachineConfigPool,
  RELEASE_VERSION_ANNOTATION,
} from '../models/update-progress';

const cv: ClusterVersion = {
  spec: {},
  status: {
    desired: { version: '5.0.0', image: 'release' },
    history: [
      {
        version: '5.0.0',
        image: 'release',
        state: 'Completed',
        verified: true,
        startedTime: '2026-11-02T10:00:00Z',
      },
    ],
    conditions: [
      { type: 'Available', status: 'True' },
      { type: 'Progressing', status: 'False' },
    ],
  },
};
const operators: ClusterOperator[] = [
  {
    metadata: { name: 'network' },
    status: {
      versions: [{ name: 'operator', version: '5.0.0' }],
      conditions: [
        { type: 'Available', status: 'True' },
        { type: 'Degraded', status: 'False' },
        { type: 'Progressing', status: 'False' },
      ],
    },
  },
];
const pool: MachineConfigPool = {
  metadata: { name: 'master' },
  spec: { configuration: { name: 'rendered-master' } },
  status: {
    machineCount: 3,
    updatedMachineCount: 3,
    readyMachineCount: 3,
    conditions: [
      { type: 'Updated', status: 'True' },
      { type: 'Degraded', status: 'False' },
    ],
  },
};
const configs = [
  { metadata: { name: 'rendered-master', annotations: { [RELEASE_VERSION_ANNOTATION]: '5.0.0' } } },
];
it('reports a healthy idle cluster independently of agent workflow phases', () => {
  const progress = clusterUpdateProgress(cv, operators, [pool], configs);
  expect(progress.state).toBe('complete');
  expect(progress.active).toBe(false);
  expect(progress.target).toBe('5.0.0');
});
it('does not count nodes on the previous release as updated to a requested target', () => {
  const progress = poolProgress(pool, '5.0.1', configs);
  expect(progress.updated).toBeUndefined();
  expect(progress.state).toBe('waiting');
});
it('does not report full completion when progress data is unavailable', () => {
  expect(clusterUpdateProgress(cv, undefined, undefined, undefined).state).toBe('unknown');
});
it('waits for cluster status to acknowledge a new target', () => {
  const requested = { ...cv, spec: { desiredUpdate: { version: '5.0.1' } } };
  expect(clusterUpdateProgress(requested, operators, [pool], configs).state).toBe('requested');
});

it('advances through a rollout and completes only after all resources reach the target', () => {
  const updating: ClusterVersion = {
    ...cv,
    spec: { desiredUpdate: { version: '5.0.1' } },
    status: {
      ...cv.status!,
      desired: { version: '5.0.1', image: 'new-release' },
      history: [
        {
          version: '5.0.1',
          image: 'new-release',
          state: 'Partial',
          verified: true,
          startedTime: '2026-11-02T11:00:00Z',
        },
        ...cv.status!.history!,
      ],
      conditions: [
        { type: 'Available', status: 'True' },
        { type: 'Progressing', status: 'True' },
      ],
    },
  };
  const targetConfigs = [
    {
      metadata: { name: 'rendered-target', annotations: { [RELEASE_VERSION_ANNOTATION]: '5.0.1' } },
    },
  ];
  const targetPool = (name: string, updated: number): MachineConfigPool => ({
    ...pool,
    metadata: { name, generation: 2 },
    spec: { configuration: { name: 'rendered-target' } },
    status: {
      ...pool.status,
      observedGeneration: 2,
      updatedMachineCount: updated,
      readyMachineCount: updated,
      conditions: [
        { type: 'Updated', status: updated === 3 ? 'True' : 'False' },
        { type: 'Degraded', status: 'False' },
      ],
    },
  });
  for (const updated of [0, 1, 2, 3]) {
    const progress = clusterUpdateProgress(
      updating,
      operators,
      [targetPool('master', 3), targetPool('worker', updated)],
      targetConfigs,
    );
    expect(progress.state).toBe('updating');
    expect(progress.active).toBe(true);
    expect(progress.controlPlane.updated).toBe(3);
    expect(progress.workers.updated).toBe(updated);
    expect(progress.workers.total).toBe(3);
  }
  const finishedOperators = operators.map((operator) => ({
    ...operator,
    status: { ...operator.status, versions: [{ name: 'operator', version: '5.0.1' }] },
  }));
  const completed = {
    ...updating,
    status: {
      ...updating.status!,
      history: updating.status!.history!.map((entry) => ({
        ...entry,
        state: 'Completed' as const,
      })),
      conditions: cv.status!.conditions,
    },
  };
  const progress = clusterUpdateProgress(
    completed,
    finishedOperators,
    [targetPool('master', 3), targetPool('worker', 3)],
    targetConfigs,
  );
  expect(progress.state).toBe('complete');
  expect(progress.active).toBe(false);
  expect(progress.operators!.filter((operator) => operator.updated)).toHaveLength(1);
});

it('does not count stale pool status against a newly rendered configuration', () => {
  const stalePool = {
    ...pool,
    metadata: { name: 'master', generation: 2 },
    status: { ...pool.status, observedGeneration: 1 },
  };
  expect(poolProgress(stalePool, '5.0.0', configs).updated).toBeUndefined();
});

it('gates verification on ClusterVersion rather than MachineConfig rollout state', () => {
  expect(verificationUpdateState(cv)).toBe('complete');
  expect(
    verificationUpdateState({
      ...cv,
      metadata: { generation: 2 },
      status: { ...cv.status!, observedGeneration: 1 },
    }),
  ).toBe('updating');
  expect(verificationUpdateState({ ...cv, spec: { desiredUpdate: { version: '5.0.1' } } })).toBe(
    'updating',
  );
  expect(verificationUpdateState({ ...cv, status: { ...cv.status!, history: [] } })).toBe(
    'unknown',
  );
  expect(verificationUpdateState(undefined)).toBe('unknown');
});

it('distinguishes a routine configuration rollout from a cluster version update', () => {
  const changingPool: MachineConfigPool = {
    ...pool,
    status: {
      ...pool.status,
      updatedMachineCount: 1,
      readyMachineCount: 2,
      conditions: [
        { type: 'Updated', status: 'False' },
        { type: 'Degraded', status: 'False' },
      ],
    },
  };
  const progress = clusterUpdateProgress(cv, operators, [changingPool], configs);
  expect(progress.active).toBe(false);
  expect(progress.state).toBe('configuring');
});
