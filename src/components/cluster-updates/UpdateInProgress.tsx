import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Progress, ProgressSize, ProgressVariant, Stack, StackItem } from '@patternfly/react-core';
import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterVersion } from '../../models/clusterversion';
import { MachineConfigPool } from '../../models/machineconfigpool';
import { I18N_NAMESPACE } from '../../utils/constants';
import { getDesiredClusterVersion } from '../../utils/cluster-updates';

type ClusterOperator = {
  metadata: {
    name: string;
  };
  status?: {
    versions?: Array<{
      name: string;
      version: string;
    }>;
  };
};

type UpdateInProgressProps = {
  clusterVersion: ClusterVersion;
  machineConfigPools: MachineConfigPool[];
};

const ClusterOperatorsResource = {
  isList: true,
  kind: 'ClusterOperator',
  namespaced: false,
};

const getUpdatedOperatorsCount = (
  operators: ClusterOperator[] | undefined,
  desiredVersion: string,
): number => {
  if (!operators || !desiredVersion) {
    return 0;
  }

  return operators.filter((operator) => {
    const versions = operator.status?.versions || [];
    return versions.some((v) => v.name === 'operator' && v.version === desiredVersion);
  }).length;
};

const getMachineCount = (
  mcp: MachineConfigPool,
): { ready: number; total: number; percent: number } => {
  const readyCount = mcp.status?.readyMachineCount || 0;
  const totalCount = mcp.status?.machineCount || 0;
  const percent = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;

  return {
    ready: readyCount,
    total: totalCount,
    percent,
  };
};

export const UpdateInProgress: React.FC<UpdateInProgressProps> = ({
  clusterVersion,
  machineConfigPools,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const desiredVersion = getDesiredClusterVersion(clusterVersion) || '';

  const [clusterOperators] = useK8sWatchResource<ClusterOperator[]>(ClusterOperatorsResource);
  const totalOperatorsCount = clusterOperators?.length || 0;
  const updatedOperatorsCount = getUpdatedOperatorsCount(clusterOperators, desiredVersion);
  const percentOperators = Math.round((updatedOperatorsCount / totalOperatorsCount) * 100);

  const masterMCP = machineConfigPools.find((mcp) => mcp.metadata?.name === 'master');
  const workerMCP = machineConfigPools.find((mcp) => mcp.metadata?.name === 'worker');
  const customMCPs = machineConfigPools.filter(
    (mcp) => mcp.metadata?.name !== 'master' && mcp.metadata?.name !== 'worker',
  );

  return (
    <Stack hasGutter className="pf-v6-u-mt-md">
      {/* Cluster Operators Progress */}
      <StackItem>
        <div className="pf-v6-u-font-weight-bold pf-v6-u-mb-xs">{t('Cluster Operators')}</div>
        <Progress
          title={t('{{updated}} of {{total}}', {
            updated: updatedOperatorsCount,
            total: totalOperatorsCount,
          })}
          value={!isNaN(percentOperators) ? percentOperators : 0}
          size={ProgressSize.sm}
          variant={percentOperators === 100 ? ProgressVariant.success : undefined}
        />
      </StackItem>

      {/* Master Nodes Progress */}
      {masterMCP && (() => {
        const { ready, total, percent } = getMachineCount(masterMCP);
        return (
          <StackItem>
            <div className="pf-v6-u-font-weight-bold pf-v6-u-mb-xs">{t('Control plane')}</div>
            <Progress
              title={t('{{ready}} of {{total}} nodes', { ready, total })}
              value={percent}
              size={ProgressSize.sm}
              variant={percent === 100 ? ProgressVariant.success : undefined}
            />
          </StackItem>
        );
      })()}

      {/* Worker Nodes Progress */}
      {workerMCP && (() => {
        const { ready, total, percent } = getMachineCount(workerMCP);
        return (
          <StackItem>
            <div className="pf-v6-u-font-weight-bold pf-v6-u-mb-xs">{t('Worker')}</div>
            <Progress
              title={t('{{ready}} of {{total}} nodes', { ready, total })}
              value={percent}
              size={ProgressSize.sm}
              variant={percent === 100 ? ProgressVariant.success : undefined}
            />
          </StackItem>
        );
      })()}

      {/* Custom Pool Nodes Progress */}
      {customMCPs.map((mcp) => {
        const { ready, total, percent } = getMachineCount(mcp);
        return (
          <StackItem key={mcp.metadata?.name || 'custom'}>
            <div className="pf-v6-u-font-weight-bold pf-v6-u-mb-xs">
              {mcp.metadata?.name || t('Custom pool')}
            </div>
            <Progress
              title={t('{{ready}} of {{total}} nodes', { ready, total })}
              value={percent}
              size={ProgressSize.sm}
              variant={percent === 100 ? ProgressVariant.success : undefined}
            />
          </StackItem>
        );
      })}
    </Stack>
  );
};
