import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Card,
  CardBody,
  CardTitle,
  Content,
  ExpandableSection,
  Flex,
  FlexItem,
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
  getDecisionDisplay,
  hasDefaultModeData,
  SEVERITY_LABELS,
} from '../../models/agenticrun';
import { I18N_NAMESPACE } from '../../utils/constants';
import DiagnosisCard from './DiagnosisCard';
import RemediationPlanView from './RemediationPlanView';

type AnalysisResultViewProps = {
  analysisData: AnalysisData;
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

const getRiskColor = (
  risk?: 'Low' | 'Medium' | 'High' | 'Critical',
): 'green' | 'orange' | 'red' | 'grey' => {
  switch (risk) {
    case 'Low':
      return 'green';
    case 'Medium':
      return 'orange';
    case 'High':
    case 'Critical':
      return 'red';
    default:
      return 'grey';
  }
};

const getConfidenceColor = (
  confidence?: 'Low' | 'Medium' | 'High',
): 'red' | 'orange' | 'green' | 'grey' => {
  switch (confidence) {
    case 'High':
      return 'green';
    case 'Medium':
      return 'orange';
    case 'Low':
      return 'red';
    default:
      return 'grey';
  }
};

const AnalysisResultView: React.FC<AnalysisResultViewProps> = ({ analysisData }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [expandedOptions, setExpandedOptions] = React.useState<Set<number>>(new Set([0]));

  const { options, components, analysisData: legacyData } = analysisData;

  // Extract all available data upfront
  const hasRemediationMode = options.some(hasDefaultModeData);
  const readinessSummary = getReadinessSummary(components);
  const findings = sortFindings(getFindings(components));
  const olmStatus = getOlmOperatorStatus(components);

  // Determine decision for AI Assessment card
  const decision =
    readinessSummary?.decision ?? (legacyData?.decision as string | undefined) ?? '';

  // Legacy format checks
  const legacySummary = (legacyData?.summary as string) ?? '';
  const rawChecks = (legacyData?.check_results ??
    legacyData?.check_by_check_analysis ??
    {}) as Record<string, { status: string; reason?: string; findings?: string[] }>;

  // Check if we have any data to display
  const hasAnyData =
    hasRemediationMode ||
    readinessSummary ||
    findings.length > 0 ||
    (olmStatus && olmStatus.operators?.length > 0) ||
    legacyData;

  if (!hasAnyData) {
    return <Content component="p">{t('Analysis data not available.')}</Content>;
  }

  return (
    <Stack hasGutter>
      {/* AI Assessment - always show if we have a decision */}
      {(readinessSummary || decision) && (
        <StackItem>
          <Card>
            <CardTitle>
              {t('AI Assessment')}
              {decision && (
                <Label
                  color={getDecisionDisplay(decision).color}
                  isCompact
                  style={{ marginLeft: '12px' }}
                >
                  {getDecisionDisplay(decision).label}
                </Label>
              )}
            </CardTitle>
            {legacySummary && (
              <CardBody>
                <Content component="p">{legacySummary}</Content>
              </CardBody>
            )}
          </Card>
        </StackItem>
      )}

      {/* Readiness Checks - from typed components */}
      {readinessSummary?.checks && readinessSummary.checks.length > 0 && (
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

      {/* Readiness Checks - from legacy format */}
      {!readinessSummary && Object.keys(rawChecks).length > 0 && (
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
      {olmStatus && olmStatus.operators && olmStatus.operators.length > 0 && (
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

      {/* Remediation Mode: Diagnosis and Remediation Plans */}
      {hasRemediationMode &&
        options.map((option, idx) => {
          const isExpanded = expandedOptions.has(idx);
          const togglePanel = () => {
            setExpandedOptions((prev) => {
              const next = new Set(prev);
              if (next.has(idx)) {
                next.delete(idx);
              } else {
                next.add(idx);
              }
              return next;
            });
          };

          const hasContent = option.diagnosis || option.remediationPlan;
          if (!hasContent) return null;

          return (
            <StackItem key={idx}>
              <ExpandableSection
                toggleContent={
                  <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
                    <FlexItem>
                      <strong>
                        {option.title || t('Remediation Plan {{index}}', { index: idx + 1 })}
                      </strong>
                    </FlexItem>
                    {option.remediationPlan?.risk && (
                      <FlexItem>
                        <Label color={getRiskColor(option.remediationPlan.risk)} isCompact>
                          {option.remediationPlan.risk}
                        </Label>
                      </FlexItem>
                    )}
                    {option.diagnosis?.confidence && (
                      <FlexItem>
                        <Label color={getConfidenceColor(option.diagnosis.confidence)} isCompact>
                          {t('{{confidence}} confidence', {
                            confidence: option.diagnosis.confidence,
                          })}
                        </Label>
                      </FlexItem>
                    )}
                  </Flex>
                }
                isExpanded={isExpanded}
                onToggle={togglePanel}
                isIndented
              >
                <Stack hasGutter>
                  {option.diagnosis && (
                    <StackItem>
                      <DiagnosisCard diagnosis={option.diagnosis} />
                    </StackItem>
                  )}
                  {option.remediationPlan && (
                    <StackItem>
                      <RemediationPlanView option={option} optionIndex={idx} />
                    </StackItem>
                  )}
                </Stack>
              </ExpandableSection>
            </StackItem>
          );
        })}
    </Stack>
  );
};

export default AnalysisResultView;
