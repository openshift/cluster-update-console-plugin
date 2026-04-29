import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { EmptyState, EmptyStateBody, Label } from '@patternfly/react-core';
import { HistoryIcon } from '@patternfly/react-icons';
import ReadinessStatusIcon from '../shared/ReadinessStatusIcon';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { ClusterVersion, UpdateHistory } from '../../models/clusterversion';
import { I18N_NAMESPACE } from '../../utils/constants';
import { formatDuration } from '../../utils/time';
import './update-history.css';

type UpdateHistoryTabProps = {
  clusterVersion: ClusterVersion;
};

const UpdateHistoryTab: React.FC<UpdateHistoryTabProps> = ({ clusterVersion }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const sortedHistory = React.useMemo(() => {
    const history = clusterVersion.status?.history ?? [];
    return [...history].sort(
      (a: UpdateHistory, b: UpdateHistory) =>
        new Date(b.startedTime).getTime() - new Date(a.startedTime).getTime(),
    );
  }, [clusterVersion.status?.history]);

  if (sortedHistory.length === 0) {
    return (
      <EmptyState titleText={t('No update history available')} headingLevel="h2" icon={HistoryIcon}>
        <EmptyStateBody>{t('This cluster has no recorded update history.')}</EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <div className="cluster-update-plugin__update-history">
      <Table aria-label={t('Update history')} variant="compact">
        <Thead>
          <Tr>
            <Th>{t('Version')}</Th>
            <Th>{t('Status')}</Th>
            <Th>{t('Started')}</Th>
            <Th>{t('Completed')}</Th>
            <Th>{t('Duration')}</Th>
            <Th>{t('Verified')}</Th>
          </Tr>
        </Thead>
        <Tbody>
          {sortedHistory.map((entry: UpdateHistory, index: number) => (
            <Tr key={`${entry.version}-${index}`}>
              <Td dataLabel={t('Version')}>{entry.version}</Td>
              <Td dataLabel={t('Status')}>
                <Label color={entry.state === 'Completed' ? 'green' : 'orange'}>
                  {entry.state}
                </Label>
              </Td>
              <Td dataLabel={t('Started')}>
                <Timestamp timestamp={entry.startedTime} />
              </Td>
              <Td dataLabel={t('Completed')}>
                {entry.completionTime ? <Timestamp timestamp={entry.completionTime} /> : '-'}
              </Td>
              <Td dataLabel={t('Duration')}>
                {formatDuration(entry.startedTime, entry.completionTime)}
              </Td>
              <Td dataLabel={t('Verified')}>
                <ReadinessStatusIcon status={entry.verified ? 'success' : 'danger'} />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
};

export default UpdateHistoryTab;
