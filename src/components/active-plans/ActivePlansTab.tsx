import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { LightspeedAgenticRun, derivePhase } from '../../models/agenticrun';
import { I18N_NAMESPACE, LABELS } from '../../utils/constants';
import PhaseLabel from '../shared/PhaseLabel';
import './active-plans.css';

type ActivePlansTabProps = {
  activePlans: LightspeedAgenticRun[];
};

const ActivePlansTab: React.FC<ActivePlansTabProps> = ({ activePlans }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  if (activePlans.length === 0) {
    return (
      <EmptyState titleText={t('No active update plans')} headingLevel="h2" icon={SearchIcon}>
        <EmptyStateBody>{t('There are no update plans currently in progress.')}</EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <div className="cluster-update-plugin__active-plans">
      <Table aria-label={t('Active update plans')} variant="compact">
        <Thead>
          <Tr>
            <Th>{t('Name')}</Th>
            <Th>{t('Target Version')}</Th>
            <Th>{t('Phase')}</Th>
            <Th>{t('Update Type')}</Th>
            <Th>{t('Age')}</Th>
          </Tr>
        </Thead>
        <Tbody>
          {activePlans.map((agenticRun) => {
            const targetVersion = agenticRun.metadata?.labels?.[LABELS.targetVersion] ?? '-';
            const updateType = agenticRun.metadata?.labels?.[LABELS.updateType] ?? '-';

            return (
              <Tr key={agenticRun.metadata?.uid ?? agenticRun.metadata?.name}>
                <Td dataLabel={t('Name')}>
                  <Link
                    to={`/lightspeed/runs/${agenticRun.metadata?.namespace}/${agenticRun.metadata?.name}`}
                    className="cluster-update-plugin__check-link"
                  >
                    {agenticRun.metadata?.name}
                  </Link>
                </Td>
                <Td dataLabel={t('Target Version')}>{targetVersion}</Td>
                <Td dataLabel={t('Phase')}>
                  <PhaseLabel phase={derivePhase(agenticRun)} />
                </Td>
                <Td dataLabel={t('Update Type')}>{updateType}</Td>
                <Td dataLabel={t('Age')}>
                  <Timestamp timestamp={agenticRun.metadata?.creationTimestamp} simple />
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </div>
  );
};

export default ActivePlansTab;
