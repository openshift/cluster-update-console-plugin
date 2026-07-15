import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Card,
  CardBody,
  CardTitle,
  Content,
  Icon,
  Label,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InfoCircleIcon,
} from '@patternfly/react-icons';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import {
  AnalysisData,
  getReadinessSummary,
  getFindings,
  sortFindings,
  getOlmOperatorStatus,
  SEVERITY_LABELS,
} from '../../models/agenticrun';
import { I18N_NAMESPACE } from '../../utils/constants';

type AnalysisResultViewProps = {
  analysisData: AnalysisData;
};

const decisionColors: Record<string, 'green' | 'orange' | 'red' | 'purple'> = {
  recommend: 'green',
  caution: 'orange',
  block: 'red',
  escalate: 'purple',
};

const checkStatusIcon = (status: string) => {
  switch (status) {
    case 'pass':
      return (
        <Icon status="success" size="sm">
          <CheckCircleIcon />
        </Icon>
      );
    case 'warn':
      return (
        <Icon status="warning" size="sm">
          <ExclamationTriangleIcon />
        </Icon>
      );
    case 'fail':
      return (
        <Icon status="danger" size="sm">
          <ExclamationCircleIcon />
        </Icon>
      );
    default:
      return (
        <Icon status="info" size="sm">
          <InfoCircleIcon />
        </Icon>
      );
  }
};

const checkStatusColor = (status: string): 'green' | 'orange' | 'red' | 'blue' => {
  switch (status) {
    case 'pass':
      return 'green';
    case 'warn':
      return 'orange';
    case 'fail':
      return 'red';
    default:
      return 'blue';
  }
};

const AnalysisResultView: React.FC<AnalysisResultViewProps> = ({ analysisData }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const { components, analysisData: legacyData } = analysisData;

  // Typed components (PR 1379 format)
  const readinessSummary = getReadinessSummary(components);
  const findings = sortFindings(getFindings(components));
  const olmStatus = getOlmOperatorStatus(components);

  // If we have typed components, use them
  if (readinessSummary) {
    return (
      <Stack hasGutter>
        {/* Decision & Summary */}
        <StackItem>
          <Card>
            <CardTitle>
              {t('AI Assessment')}
              <Label
                color={decisionColors[readinessSummary.decision] ?? 'grey'}
                isCompact
                style={{ marginLeft: '12px' }}
              >
                {readinessSummary.decision.toUpperCase()}
              </Label>
            </CardTitle>
          </Card>
        </StackItem>

        {/* Readiness Checks */}
        {readinessSummary.checks?.length > 0 && (
          <StackItem>
            <Card>
              <CardTitle>{t('Readiness Checks')}</CardTitle>
              <CardBody>
                <Table aria-label={t('Readiness checks')} variant="compact">
                  <Thead>
                    <Tr>
                      <Th>{t('Check')}</Th>
                      <Th>{t('Status')}</Th>
                      <Th>{t('Details')}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {readinessSummary.checks.map((check) => (
                      <Tr key={check.name}>
                        <Td dataLabel={t('Check')}>
                          <strong>{check.name}</strong>
                        </Td>
                        <Td dataLabel={t('Status')}>
                          {checkStatusIcon(check.status)}{' '}
                          <Label color={checkStatusColor(check.status)} isCompact>
                            {check.status}
                          </Label>
                        </Td>
                        <Td dataLabel={t('Details')}>{check.detail ?? ''}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </StackItem>
        )}

        {/* Findings */}
        {findings.length > 0 && (
          <StackItem>
            {findings.map((f, i) => (
              <Alert
                key={`finding-${i}`}
                variant={
                  f.severity === 'blocker'
                    ? 'danger'
                    : f.severity === 'warning'
                      ? 'warning'
                      : 'info'
                }
                isInline
                title={`${SEVERITY_LABELS[f.severity] ?? f.severity}: ${f.check}`}
                style={{ marginBottom: '8px' }}
              >
                {f.detail}
                {f.prerequisite && (
                  <Content component="p" style={{ marginTop: '8px' }}>
                    <strong>{t('Prerequisite:')}</strong> {f.prerequisite}
                  </Content>
                )}
                {f.verifyCommand && (
                  <Content component="small" style={{ display: 'block', marginTop: '4px' }}>
                    <code>{f.verifyCommand}</code>
                  </Content>
                )}
              </Alert>
            ))}
          </StackItem>
        )}

        {/* OLM Operators */}
        {olmStatus && olmStatus.operators?.length > 0 && (
          <StackItem>
            <Card>
              <CardTitle>{t('OLM Operators')}</CardTitle>
              <CardBody>
                <Table aria-label={t('OLM operators')} variant="compact">
                  <Thead>
                    <Tr>
                      <Th>{t('Operator')}</Th>
                      <Th>{t('Version')}</Th>
                      <Th>{t('Channel')}</Th>
                      <Th>{t('Compatible')}</Th>
                      <Th>{t('Lifecycle')}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {olmStatus.operators.map((op) => (
                      <Tr key={`${op.namespace}/${op.name}`}>
                        <Td dataLabel={t('Operator')}>
                          <strong>{op.displayName ?? op.name}</strong>
                        </Td>
                        <Td dataLabel={t('Version')}>{op.installedVersion ?? '-'}</Td>
                        <Td dataLabel={t('Channel')}>{op.channel ?? '-'}</Td>
                        <Td dataLabel={t('Compatible')}>
                          {op.compatibleWithTarget === true && (
                            <Label color="green" isCompact>
                              {t('Yes')}
                            </Label>
                          )}
                          {op.compatibleWithTarget === false && (
                            <Label color="red" isCompact>
                              {t('No')}
                            </Label>
                          )}
                          {op.compatibleWithTarget === undefined && '-'}
                        </Td>
                        <Td dataLabel={t('Lifecycle')}>{op.lifecycle?.supportPhase ?? '-'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          </StackItem>
        )}
      </Stack>
    );
  }

  // Legacy flat format fallback
  if (!legacyData) {
    return <Content component="p">{t('Analysis data not available.')}</Content>;
  }

  const decision = (legacyData.decision as string) ?? '';
  const summary = (legacyData.summary as string) ?? '';
  const rawChecks = (legacyData.check_results ??
    legacyData.check_by_check_analysis ??
    {}) as Record<string, { status: string; reason?: string; findings?: string[] }>;

  return (
    <Stack hasGutter>
      <StackItem>
        <Card>
          <CardTitle>
            {t('AI Assessment')}
            {decision && (
              <Label
                color={decisionColors[decision] ?? 'grey'}
                isCompact
                style={{ marginLeft: '12px' }}
              >
                {decision.toUpperCase()}
              </Label>
            )}
          </CardTitle>
          <CardBody>
            <Content component="p">{summary}</Content>
          </CardBody>
        </Card>
      </StackItem>

      {Object.keys(rawChecks).length > 0 && (
        <StackItem>
          <Card>
            <CardTitle>{t('Readiness Checks')}</CardTitle>
            <CardBody>
              <Table aria-label={t('Readiness checks')} variant="compact">
                <Thead>
                  <Tr>
                    <Th>{t('Check')}</Th>
                    <Th>{t('Status')}</Th>
                    <Th>{t('Details')}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {Object.entries(rawChecks).map(([name, check]) => (
                    <Tr key={name}>
                      <Td dataLabel={t('Check')}>
                        <strong>{name.replace(/_/g, ' ')}</strong>
                      </Td>
                      <Td dataLabel={t('Status')}>
                        {checkStatusIcon((check.status ?? 'unknown').toLowerCase())}{' '}
                        <Label
                          color={checkStatusColor((check.status ?? 'unknown').toLowerCase())}
                          isCompact
                        >
                          {check.status ?? 'unknown'}
                        </Label>
                      </Td>
                      <Td dataLabel={t('Details')}>
                        {check.reason ?? check.findings?.join('; ') ?? ''}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardBody>
          </Card>
        </StackItem>
      )}
    </Stack>
  );
};

export default AnalysisResultView;
