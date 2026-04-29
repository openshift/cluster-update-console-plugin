import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardBody, CardTitle, Content, Icon, Label } from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import {
  AnalysisData,
  FINDING_CHECKS,
  SUPPORT_PHASES,
  getOlmOperatorStatus,
  getFindings,
  OtaOlmOperator,
  OtaFinding,
} from '../../models/proposal';
import SeverityLabel from '../shared/SeverityLabel';
import { I18N_NAMESPACE } from '../../utils/constants';
import { formatDate } from '../../utils/time';

type OLMOperatorsProps = {
  analysisData: AnalysisData;
};

const compatLabel = (op: OtaOlmOperator): React.ReactNode => {
  if (op.compatibleWithTarget === false) {
    const max = op.ocpCompat?.max;
    return (
      <Label color="red" isCompact>
        {max ? `max ${max}` : 'Incompatible'}
      </Label>
    );
  }
  if (op.compatibleWithTarget === true) {
    return (
      <Label color="green" isCompact>
        OK
      </Label>
    );
  }
  return null;
};

const SUPPORT_PHASE_COLORS: Record<string, 'green' | 'orange' | 'red'> = {
  [SUPPORT_PHASES.fullSupport]: 'green',
  [SUPPORT_PHASES.maintenance]: 'orange',
  [SUPPORT_PHASES.endOfLife]: 'red',
};

const supportLabel = (op: OtaOlmOperator): React.ReactNode => {
  const phase = op.lifecycle?.supportPhase;
  if (!phase) return null;
  return (
    <Label color={SUPPORT_PHASE_COLORS[phase] ?? 'grey'} isCompact>
      {phase}
    </Label>
  );
};

const approvalLabel = (op: OtaOlmOperator): React.ReactNode => {
  if (op.installPlanApproval === 'Manual') {
    return (
      <Label color="orange" isCompact>
        Manual
      </Label>
    );
  }
  return (
    <Label color="blue" isCompact>
      {op.installPlanApproval ?? 'Automatic'}
    </Label>
  );
};

const OLMOperators: React.FC<OLMOperatorsProps> = ({ analysisData }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const { olmStatus, olmFindings, hasLifecycle } = React.useMemo(() => {
    const status = getOlmOperatorStatus(analysisData.components);
    const ops = status?.operators ?? [];
    return {
      olmStatus: status,
      olmFindings: getFindings(analysisData.components).filter(
        (f) => f.check === FINDING_CHECKS.olmOperatorLifecycle,
      ),
      hasLifecycle: ops.some((op) => op.lifecycle?.supportPhase),
    };
  }, [analysisData]);

  const operators = olmStatus?.operators ?? [];
  const summary = olmStatus?.summary;

  if (operators.length === 0 && olmFindings.length === 0) {
    return null;
  }

  return (
    <Card isCompact className="cluster-update-plugin__olm-operators">
      <CardTitle>{t('OLM Operator Lifecycle')}</CardTitle>
      <CardBody>
        {summary && (
          <Content component="p" className="cluster-update-plugin__olm-summary">
            {t('{{total}} operators managed by OLM', {
              total: summary.totalOperators,
            })}
            {summary.incompatibleWithTarget > 0 && (
              <>
                {' \u2014 '}
                <Icon status="danger">
                  <ExclamationTriangleIcon />
                </Icon>{' '}
                {t('{{count}} incompatible with target', {
                  count: summary.incompatibleWithTarget,
                })}
              </>
            )}
            {summary.pendingUpgrades > 0 &&
              `, ${t('{{count}} pending upgrade', { count: summary.pendingUpgrades })}`}
            {summary.manualApproval > 0 &&
              `, ${t('{{count}} manual approval', { count: summary.manualApproval })}`}
          </Content>
        )}

        {operators.length > 0 && (
          <Table
            aria-label={t('OLM operators table')}
            variant="compact"
            className="cluster-update-plugin__olm-table"
          >
            <Thead>
              <Tr>
                <Th>{t('Operator')}</Th>
                <Th>{t('Version')}</Th>
                <Th>{t('Channel')}</Th>
                <Th>{t('Approval')}</Th>
                <Th>{t('OCP Compat')}</Th>
                {hasLifecycle && <Th>{t('Support')}</Th>}
              </Tr>
            </Thead>
            <Tbody>
              {operators.map((op) => (
                <Tr
                  key={`${op.namespace}/${op.name}`}
                  className={
                    op.compatibleWithTarget === false ||
                    op.lifecycle?.supportPhase === SUPPORT_PHASES.endOfLife
                      ? 'cluster-update-plugin__olm-row--incompatible'
                      : undefined
                  }
                >
                  <Td dataLabel={t('Operator')}>
                    <Link
                      to={`/k8s/ns/${op.namespace}/operators.coreos.com~v1alpha1~Subscription/${op.name}`}
                      className="cluster-update-plugin__check-link"
                    >
                      {op.displayName || op.name}
                    </Link>
                    {op.pendingUpgrade && (
                      <Label
                        color="blue"
                        isCompact
                        className="cluster-update-plugin__olm-pending-badge"
                      >
                        {op.pendingVersion
                          ? t('upgrade to {{version}}', {
                              version: op.pendingVersion,
                            })
                          : t('upgrade pending')}
                      </Label>
                    )}
                  </Td>
                  <Td dataLabel={t('Version')}>{op.installedVersion ?? '\u2014'}</Td>
                  <Td dataLabel={t('Channel')}>{op.channel ?? '\u2014'}</Td>
                  <Td dataLabel={t('Approval')}>{approvalLabel(op)}</Td>
                  <Td dataLabel={t('OCP Compat')}>{compatLabel(op)}</Td>
                  {hasLifecycle && (
                    <Td dataLabel={t('Support')}>
                      {supportLabel(op)}
                      {op.lifecycle?.maintenanceEnds && (
                        <Content component="small" className="cluster-update-plugin__olm-eol-date">
                          {t('ends {{date}}', {
                            date: formatDate(op.lifecycle.maintenanceEnds),
                          })}
                        </Content>
                      )}
                    </Td>
                  )}
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        {olmFindings.length > 0 && (
          <div className="cluster-update-plugin__olm-findings">
            {olmFindings.map((finding: OtaFinding, index: number) => (
              <Content
                key={index}
                component="p"
                className="cluster-update-plugin__olm-finding-item"
              >
                <Icon status={finding.severity === 'blocker' ? 'danger' : 'warning'}>
                  <ExclamationTriangleIcon />
                </Icon>{' '}
                <SeverityLabel severity={finding.severity} />{' '}
                {finding.detail}
              </Content>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default OLMOperators;
