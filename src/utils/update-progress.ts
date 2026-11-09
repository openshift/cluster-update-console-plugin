import { K8sResourceCommon, K8sResourceCondition } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterVersion } from '../models/clusterversion';
import {
  ClusterOperator,
  MachineConfigPool,
  PoolProgress,
  RELEASE_VERSION_ANNOTATION,
} from '../models/update-progress';

export const condition = (conditions: K8sResourceCondition[] | undefined, type: string) =>
  conditions?.find((entry) => entry.type === type);
const count = (value?: number) =>
  value !== undefined && Number.isInteger(value) && value >= 0 ? value : undefined;
const fresh = (resource: K8sResourceCommon, observed?: number) =>
  resource.metadata?.generation === undefined || observed === resource.metadata.generation;

export const poolProgress = (
  resource: MachineConfigPool,
  target: string | undefined,
  configs: K8sResourceCommon[] | undefined,
): PoolProgress => {
  const status = resource.status;
  const total = count(status?.machineCount);
  const ready = count(status?.readyMachineCount);
  const config = configs?.find(
    (entry) => entry.metadata?.name === resource.spec?.configuration?.name,
  );
  const targetConfig =
    !!target && config?.metadata?.annotations?.[RELEASE_VERSION_ANNOTATION] === target;
  const statusFresh = fresh(resource, status?.observedGeneration);
  const updatedCount = count(status?.updatedMachineCount);
  const updated =
    targetConfig &&
    statusFresh &&
    total !== undefined &&
    updatedCount !== undefined &&
    updatedCount <= total
      ? updatedCount
      : undefined;
  const degraded = status?.conditions?.find(
    (entry) =>
      entry.status === 'True' &&
      ['Degraded', 'NodeDegraded', 'RenderDegraded'].includes(entry.type),
  );
  const complete =
    updated === total &&
    total !== undefined &&
    ready === total &&
    condition(status?.conditions, 'Updated')?.status === 'True' &&
    condition(status?.conditions, 'Degraded')?.status === 'False';
  const state =
    degraded || (status?.degradedMachineCount ?? 0) > 0
      ? 'degraded'
      : total === 0
        ? 'empty'
        : complete
          ? 'complete'
          : resource.spec?.paused
            ? 'paused'
            : !statusFresh || !target || !config || total === undefined
              ? 'unknown'
              : !targetConfig
                ? 'waiting'
                : updated === undefined
                  ? 'unknown'
                  : 'updating';
  return {
    resource,
    total,
    updated,
    ready,
    state,
    message: degraded?.message || condition(status?.conditions, 'Updating')?.message,
  };
};

export const poolTotals = (pools: PoolProgress[]) => {
  const total =
    pools.length && pools.every((pool) => pool.total !== undefined)
      ? pools.reduce((sum, pool) => sum + pool.total!, 0)
      : undefined;
  const updated =
    pools.length && pools.every((pool) => pool.state === 'empty' || pool.updated !== undefined)
      ? pools.reduce((sum, pool) => sum + (pool.updated ?? 0), 0)
      : undefined;
  return {
    total,
    updated,
    complete: pools.length > 0 && pools.every((pool) => ['complete', 'empty'].includes(pool.state)),
  };
};

export const clusterUpdateProgress = (
  cv: ClusterVersion,
  operators: ClusterOperator[] | undefined,
  pools: MachineConfigPool[] | undefined,
  configs: K8sResourceCommon[] | undefined,
) => {
  const history = cv.status?.history ?? [];
  const desired = cv.status?.desired;
  const request = cv.spec.desiredUpdate;
  const requestMatches =
    (!request?.version || request.version === desired?.version) &&
    (!request?.image || request.image === desired?.image);
  const target = request?.version || (requestMatches ? desired?.version : undefined);
  const targetIndex = history.findIndex((entry) =>
    request?.image ? entry.image === request.image : !!target && entry.version === target,
  );
  const latest = targetIndex >= 0 ? history[targetIndex] : undefined;
  const source = (targetIndex >= 0 ? history.slice(targetIndex + 1) : history).find(
    (entry) => entry.state === 'Completed',
  )?.version;
  const statusFresh = fresh(cv, cv.status?.observedGeneration);
  const requested = !statusFresh || !requestMatches;
  const progressing = condition(cv.status?.conditions, 'Progressing');
  const failure = cv.status?.conditions?.find(
    (entry) => ['Failing', 'Degraded'].includes(entry.type) && entry.status === 'True',
  );
  const operatorRows = operators?.map((resource) => {
    const conditions = resource.status?.conditions;
    const version = resource.status?.versions?.find((entry) => entry.name === 'operator')?.version;
    const issue = conditions?.find(
      (entry) =>
        (entry.type === 'Degraded' && entry.status === 'True') ||
        (entry.type === 'Available' && entry.status === 'False'),
    );
    const updated =
      !!target &&
      version === target &&
      condition(conditions, 'Available')?.status === 'True' &&
      condition(conditions, 'Degraded')?.status === 'False' &&
      condition(conditions, 'Progressing')?.status === 'False';
    return { resource, version, updated, issue };
  });
  const poolRows = pools?.map((pool) => poolProgress(pool, target, configs));
  const attention =
    (statusFresh && !!failure) ||
    operatorRows?.some((row) => !!row.issue) ||
    poolRows?.some((row) => ['degraded', 'paused'].includes(row.state));
  const reportsComplete =
    !!operatorRows?.length &&
    operatorRows.every((row) => row.updated) &&
    !!poolRows?.length &&
    poolRows.every((row) => ['complete', 'empty'].includes(row.state));
  const versionComplete =
    statusFresh &&
    latest?.state === 'Completed' &&
    progressing?.status === 'False' &&
    condition(cv.status?.conditions, 'Available')?.status === 'True';
  const active =
    requested ||
    (statusFresh && progressing?.status === 'True') ||
    !!(latest?.state === 'Partial' && !latest.completionTime);
  const state = requested
    ? 'requested'
    : attention
      ? 'attention'
      : versionComplete && reportsComplete
        ? 'complete'
        : active
          ? 'updating'
          : versionComplete && poolRows?.some((pool) => pool.state === 'updating')
            ? 'configuring'
            : 'unknown';
  return {
    state,
    active,
    target,
    source: source !== target ? source : undefined,
    message: statusFresh ? failure?.message || progressing?.message : undefined,
    operators: operatorRows,
    pools: poolRows,
    controlPlane: poolTotals(
      (poolRows ?? []).filter((row) => row.resource.metadata?.name === 'master'),
    ),
    workers: poolTotals((poolRows ?? []).filter((row) => row.resource.metadata?.name !== 'master')),
  };
};

// Verification approval follows the version rollout, independently of unrelated pool changes.
export const verificationUpdateState = (
  cv?: ClusterVersion,
): 'unknown' | 'updating' | 'complete' => {
  if (!cv?.status) return 'unknown';
  const { status, spec } = cv;
  const request = spec.desiredUpdate;
  if (
    !fresh(cv, status.observedGeneration) ||
    (request?.version && request.version !== status.desired.version) ||
    (request?.image && request.image !== status.desired.image)
  )
    return 'updating';
  const progressing = condition(status.conditions, 'Progressing');
  if (progressing?.status === 'True') return 'updating';
  const latest = status.history?.[0];
  if (latest?.state === 'Partial' && !latest.completionTime) return 'updating';
  if (
    progressing?.status === 'False' &&
    condition(status.conditions, 'Available')?.status === 'True' &&
    latest?.state === 'Completed' &&
    latest.version === status.desired.version &&
    latest.image === status.desired.image
  )
    return 'complete';
  return 'unknown';
};
