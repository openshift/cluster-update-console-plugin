import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { EmptyState, EmptyStateBody, Content, ContentVariants } from '@patternfly/react-core';
import { HistoryIcon } from '@patternfly/react-icons';
import { ClusterVersion, UpdateHistory } from '../../models/clusterversion';
import { I18N_NAMESPACE } from '../../utils/constants';
import { getReleaseNotesLink } from '../../utils/cluster-updates';
import { ReleaseNotesLink } from '../cluster-updates/SupportingComponents';
import './update-history.css';

type UpdateHistoryTabProps = {
  clusterVersion: ClusterVersion;
};

const UpdateHistoryTab: React.FC<UpdateHistoryTabProps> = ({ clusterVersion }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const history = clusterVersion.status?.history ?? [];

  if (history.length === 0) {
    return (
      <EmptyState titleText={t('No update history')} headingLevel="h2" icon={HistoryIcon}>
        <EmptyStateBody>{t('This cluster has no recorded update history.')}</EmptyStateBody>
      </EmptyState>
    );
  }

  const releaseNotesAvailable = history.some((update) => getReleaseNotesLink(update.version));

  return (
    <div className="cluster-update-plugin__update-history">
      <Content>
        <Content component={ContentVariants.p} className="pf-v6-u-mb-lg pf-v6-u-color-200">
          {t(
            'There is a threshold for rendering update data which may cause gaps in the information below.',
          )}
        </Content>
      </Content>
      <div className="cluster-update-plugin__table-container">
        <table className="pf-v6-c-table pf-m-compact pf-m-border-rows">
          <thead className="pf-v6-c-table__thead">
            <tr className="pf-v6-c-table__tr">
              <th className="pf-v6-c-table__th">{t('Version')}</th>
              <th className="pf-v6-c-table__th">{t('State')}</th>
              <th className="pf-v6-c-table__th">{t('Started')}</th>
              <th className="pf-v6-c-table__th">{t('Completed')}</th>
              {releaseNotesAvailable && (
                <th className="pf-v6-c-table__th pf-m-hidden pf-m-visible-on-md">
                  {t('Release notes')}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="pf-v6-c-table__tbody">
            {history.map((update: UpdateHistory, i: number) => (
              <tr className="pf-v6-c-table__tr" key={i}>
                <td
                  className="pf-v6-c-table__td pf-m-break-word cluster-update-plugin__select-to-copy"
                  data-test-id="cv-details-table-version"
                >
                  {update.version || '-'}
                </td>
                <td className="pf-v6-c-table__td" data-test-id="cv-details-table-state">
                  {update.state || '-'}
                </td>
                <td className="pf-v6-c-table__td">
                  <Timestamp timestamp={update.startedTime} />
                </td>
                <td className="pf-v6-c-table__td">
                  {update.completionTime ? <Timestamp timestamp={update.completionTime} /> : '-'}
                </td>
                {releaseNotesAvailable && (
                  <td className="pf-v6-c-table__td pf-m-hidden pf-m-visible-on-md">
                    {getReleaseNotesLink(update.version) ? (
                      <ReleaseNotesLink version={update.version} />
                    ) : (
                      '-'
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UpdateHistoryTab;
