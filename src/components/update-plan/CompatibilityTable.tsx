import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardBody,
  CardTitle,
  ClipboardCopy,
  Content,
  EmptyState,
  EmptyStateBody,
} from '@patternfly/react-core';
import { CheckCircleIcon } from '@patternfly/react-icons';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import {
  AnalysisData,
  getFindings,
  sortFindings,
} from '../../models/proposal';
import SeverityLabel from '../shared/SeverityLabel';
import { I18N_NAMESPACE } from '../../utils/constants';

type CompatibilityTableProps = {
  analysisData: AnalysisData;
};

const SEVERITY_BORDER_CLASS: Record<string, string> = {
  blocker: 'cluster-update-plugin__findings-row--blocker',
  warning: 'cluster-update-plugin__findings-row--warning',
  info: 'cluster-update-plugin__findings-row--info',
};

const CompatibilityTable: React.FC<CompatibilityTableProps> = ({ analysisData }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const findings = React.useMemo(
    () => sortFindings(getFindings(analysisData.components)),
    [analysisData],
  );

  return (
    <Card className="cluster-update-plugin__compat-table">
      <CardTitle>{t('Findings')}</CardTitle>
      <CardBody>
        {findings.length === 0 ? (
          <EmptyState
            titleText={t('All Clear')}
            headingLevel="h3"
            icon={CheckCircleIcon}
            status="success"
            variant="sm"
          >
            <EmptyStateBody>{t('No issues found — all readiness checks passed.')}</EmptyStateBody>
          </EmptyState>
        ) : (
          <Table aria-label={t('Findings table')} variant="compact">
            <Thead>
              <Tr>
                <Th>{t('Severity')}</Th>
                <Th>{t('Check')}</Th>
                <Th>{t('Detail')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {findings.map((finding, index) => (
                <Tr key={index} className={SEVERITY_BORDER_CLASS[finding.severity] ?? ''}>
                  <Td dataLabel={t('Severity')}>
                    <SeverityLabel severity={finding.severity} />
                  </Td>
                  <Td dataLabel={t('Check')}>{finding.check}</Td>
                  <Td dataLabel={t('Detail')}>
                    <Content component="p">{finding.detail}</Content>
                    {finding.affectedResources && finding.affectedResources.length > 0 && (
                      <Content
                        component="small"
                        className="cluster-update-plugin__findings-affected"
                      >
                        {t('Affected: {{resources}}', {
                          resources: finding.affectedResources.join(', '),
                        })}
                      </Content>
                    )}
                    {finding.verifyCommand && (
                      <ClipboardCopy
                        isReadOnly
                        isCode
                        variant="inline-compact"
                        className="cluster-update-plugin__findings-command"
                      >
                        {finding.verifyCommand}
                      </ClipboardCopy>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
};

export default CompatibilityTable;
