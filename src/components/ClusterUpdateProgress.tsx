import { K8sResourceCommon, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import {
  Card,
  CardBody,
  CardTitle,
  Content,
  Flex,
  FlexItem,
  Label,
  Progress,
  Spinner,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { ClusterVersion } from '../models/clusterversion';
import {
  ClusterOperator,
  ClusterOperatorGVK,
  MachineConfigPool,
  MachineConfigPoolGVK,
  MachineConfigGVK,
} from '../models/update-progress';
import { clusterUpdateProgress } from '../utils/update-progress';
import { I18N_NAMESPACE } from '../utils/constants';

export const ClusterUpdateProgress = ({ clusterVersion }: { clusterVersion: ClusterVersion }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [operators, operatorsLoaded, operatorsError] = useK8sWatchResource<ClusterOperator[]>({
    groupVersionKind: ClusterOperatorGVK,
    isList: true,
  });
  const [pools, poolsLoaded, poolsError] = useK8sWatchResource<MachineConfigPool[]>({
    groupVersionKind: MachineConfigPoolGVK,
    isList: true,
  });
  const [configs, configsLoaded, configsError] = useK8sWatchResource<K8sResourceCommon[]>({
    groupVersionKind: MachineConfigGVK,
    isList: true,
  });
  const progress = clusterUpdateProgress(
    clusterVersion,
    operatorsLoaded && !operatorsError ? operators : undefined,
    poolsLoaded && !poolsError ? pools : undefined,
    configsLoaded && !configsError ? configs : undefined,
  );
  const labels: Record<string, string> = {
    requested: t('Update requested'),
    updating: t('Updating'),
    configuring: t('Configuration rollout'),
    attention: t('Needs attention'),
    complete: t('Up to date'),
    unknown: t('Waiting for cluster status'),
  };
  const idle = !progress.active && progress.state === 'complete';
  const metrics = [
    {
      title: t('Cluster operators'),
      total: progress.operators?.length,
      updated: progress.operators?.filter((row) => row.updated).length,
    },
    { title: t('Control plane nodes'), ...progress.controlPlane },
    { title: t('Worker nodes'), ...progress.workers },
  ];
  return (
    <Card id="live-cluster-update-progress">
      <CardTitle>
        <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
          {progress.state === 'updating' && (
            <FlexItem>
              <Spinner
                isInline
                aria-label={t('Cluster update in progress')}
                aria-valuetext={t('Updating')}
              />
            </FlexItem>
          )}
          <FlexItem grow={{ default: 'grow' }}>{t('Live cluster update progress')}</FlexItem>
          <FlexItem>
            <Label
              color={
                progress.state === 'complete'
                  ? 'green'
                  : progress.state === 'attention'
                    ? 'orange'
                    : 'blue'
              }
            >
              {labels[progress.state]}
            </Label>
          </FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        <Stack hasGutter>
          <StackItem>
            <strong>
              {progress.active && progress.source ? `${progress.source} → ` : ''}
              {progress.target || t('Resolving target version')}
            </strong>
          </StackItem>
          {idle && (
            <StackItem>
              <Content component="p">
                {t(
                  'No cluster update in progress. Live rollout progress appears when a cluster update starts.',
                )}
              </Content>
            </StackItem>
          )}
          {!idle && progress.message && (
            <StackItem>
              <Content component="p">
                {progress.state === 'configuring'
                  ? t(
                      'The cluster version is up to date. Node configuration changes are rolling out.',
                    )
                  : progress.message}
              </Content>
            </StackItem>
          )}
          <StackItem>
            <Flex>
              {metrics.map((metric) => (
                <FlexItem key={metric.title} grow={{ default: 'grow' }}>
                  <Stack>
                    <StackItem>
                      <strong>{metric.title}</strong>
                    </StackItem>
                    <StackItem>
                      {idle ? (
                        <Content component="p">
                          {t('{{updated}} of {{total}} up to date', {
                            updated: metric.updated ?? '—',
                            total: metric.total ?? '—',
                          })}
                        </Content>
                      ) : metric.total === 0 ? (
                        <Content component="p">
                          {t('{{updated}} of {{total}} updated', { updated: 0, total: 0 })}
                        </Content>
                      ) : metric.updated !== undefined && metric.total ? (
                        <Progress
                          title={metric.title}
                          aria-label={metric.title}
                          value={metric.updated}
                          max={metric.total}
                          label={t('{{updated}} of {{total}} updated', {
                            updated: metric.updated,
                            total: metric.total,
                          })}
                        />
                      ) : (
                        <Content component="p">{t('Waiting for target configuration')}</Content>
                      )}
                    </StackItem>
                  </Stack>
                </FlexItem>
              ))}
            </Flex>
          </StackItem>
          {(operatorsError || poolsError || configsError) && (
            <StackItem>
              <Content component="p">{t('Some cluster progress data is unavailable.')}</Content>
            </StackItem>
          )}
          {progress.pools
            ?.filter((pool) => ['paused', 'degraded'].includes(pool.state))
            .map((pool) => (
              <StackItem key={pool.resource.metadata?.name}>
                <Label color="orange">
                  {pool.resource.metadata?.name}: {pool.state}
                </Label>{' '}
                {pool.message}
              </StackItem>
            ))}
          {progress.operators
            ?.filter((row) => row.issue)
            .map((row) => (
              <StackItem key={row.resource.metadata?.name}>
                <Label color="red">{row.resource.metadata?.name}</Label> {row.issue?.message}
              </StackItem>
            ))}
        </Stack>
      </CardBody>
    </Card>
  );
};
