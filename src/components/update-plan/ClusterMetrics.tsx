import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardBody, CardTitle, Grid, GridItem, Spinner, Title } from '@patternfly/react-core';
import {
  usePrometheusPoll,
  PrometheusEndpoint,
  PrometheusResponse,
} from '@openshift-console/dynamic-plugin-sdk';
import { I18N_NAMESPACE } from '../../utils/constants';
import ReadinessStatusIcon from '../shared/ReadinessStatusIcon';

const ETCD_FSYNC_QUERY =
  'histogram_quantile(0.99, rate(etcd_disk_wal_fsync_duration_seconds_bucket[5m]))';
const CPU_UTIL_QUERY = '1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))';
const MEM_UTIL_QUERY = '1 - sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes)';
const POLL_DELAY = 30_000;

type MetricStatus = 'success' | 'warning' | 'danger';

const getValue = (response?: PrometheusResponse): number | null => {
  const result = response?.data?.result?.[0];
  const value = result?.value?.[1];
  return value !== undefined ? parseFloat(value) : null;
};

const getThresholdStatus = (value: number, warnAt: number, dangerAt: number): MetricStatus => {
  if (value < warnAt) return 'success';
  if (value <= dangerAt) return 'warning';
  return 'danger';
};

type MetricCellProps = {
  value: number | null;
  loading: boolean;
  error: unknown;
  format: (_num: number) => string;
  warnAt: number;
  dangerAt: number;
  label: string;
};

const MetricCell: React.FC<MetricCellProps> = ({
  value,
  loading,
  error,
  format,
  warnAt,
  dangerAt,
  label,
}) => {
  if (loading && value === null) {
    return (
      <div className="cluster-update-plugin__metric-cell">
        <Spinner size="lg" />
        <span className="cluster-update-plugin__metric-label">{label}</span>
      </div>
    );
  }

  if (error || value === null) {
    return (
      <div className="cluster-update-plugin__metric-cell">
        <Title headingLevel="h2" className="cluster-update-plugin__metric-value">
          -
        </Title>
        <span className="cluster-update-plugin__metric-label">{label}</span>
      </div>
    );
  }

  const status = getThresholdStatus(value, warnAt, dangerAt);

  return (
    <div className="cluster-update-plugin__metric-cell">
      <Title headingLevel="h2" className="cluster-update-plugin__metric-value">
        {format(value)}
      </Title>
      <ReadinessStatusIcon status={status} />
      <span className="cluster-update-plugin__metric-label">{label}</span>
    </div>
  );
};

const ClusterMetrics: React.FC = () => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const [etcdResponse, etcdLoading, etcdError] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: ETCD_FSYNC_QUERY,
    delay: POLL_DELAY,
  });

  const [cpuResponse, cpuLoading, cpuError] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: CPU_UTIL_QUERY,
    delay: POLL_DELAY,
  });

  const [memResponse, memLoading, memError] = usePrometheusPoll({
    endpoint: PrometheusEndpoint.QUERY,
    query: MEM_UTIL_QUERY,
    delay: POLL_DELAY,
  });

  const etcdRaw = getValue(etcdResponse);
  const etcdMs = etcdRaw !== null ? etcdRaw * 1000 : null;

  const cpuRaw = getValue(cpuResponse);
  const cpuPct = cpuRaw !== null ? cpuRaw * 100 : null;

  const memRaw = getValue(memResponse);
  const memPct = memRaw !== null ? memRaw * 100 : null;

  return (
    <Card>
      <CardTitle>
        {t('Cluster Metrics')}{' '}
        <Link to="/observe/dashboards" className="cluster-update-plugin__metrics-link">
          {t('View monitoring')}
        </Link>
      </CardTitle>
      <CardBody>
        <Grid className="cluster-update-plugin__metrics-grid">
          <GridItem md={4}>
            <MetricCell
              value={etcdMs}
              loading={etcdLoading}
              error={etcdError}
              format={(v) => `${v.toFixed(1)} ms`}
              warnAt={10}
              dangerAt={20}
              label={t('etcd fsync p99')}
            />
          </GridItem>
          <GridItem md={4}>
            <MetricCell
              value={cpuPct}
              loading={cpuLoading}
              error={cpuError}
              format={(v) => `${Math.round(v)}%`}
              warnAt={70}
              dangerAt={85}
              label={t('CPU utilization')}
            />
          </GridItem>
          <GridItem md={4}>
            <MetricCell
              value={memPct}
              loading={memLoading}
              error={memError}
              format={(v) => `${Math.round(v)}%`}
              warnAt={75}
              dangerAt={90}
              label={t('Memory utilization')}
            />
          </GridItem>
        </Grid>
      </CardBody>
    </Card>
  );
};

export default ClusterMetrics;
