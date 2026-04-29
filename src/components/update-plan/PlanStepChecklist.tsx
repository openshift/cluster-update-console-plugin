import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Alert, Card, CardBody, CardTitle, Content, Divider, Label } from '@patternfly/react-core';
import {
  AnalysisData,
  getReadinessSummary,
  ReadinessCheck,
} from '../../models/proposal';
import ReadinessStatusIcon from '../shared/ReadinessStatusIcon';
import { I18N_NAMESPACE } from '../../utils/constants';

const CHECK_ROUTES: Record<string, string> = {
  'Cluster Conditions': '/k8s/cluster/config.openshift.io~v1~ClusterVersion/version',
  'Operator Health': '/k8s/cluster/config.openshift.io~v1~ClusterOperator',
  'etcd Health': '/k8s/cluster/config.openshift.io~v1~ClusterOperator/etcd',
  'Node Capacity': '/k8s/cluster/core~v1~Node',
  'CRD Compatibility': '/k8s/cluster/apiextensions.k8s.io~v1~CustomResourceDefinition',
  Network: '/k8s/cluster/config.openshift.io~v1~ClusterOperator/network',
  'PDB / Drain Risk': '/k8s/all-namespaces/policy~v1~PodDisruptionBudget',
  'API Deprecations': '/api-explorer',
  'OLM Operator Lifecycle': '/k8s/all-namespaces/operators.coreos.com~v1alpha1~Subscription',
};

type PlanStepChecklistProps = {
  analysisData: AnalysisData;
};

const STATUS_DISPLAY: Record<string, { color: 'green' | 'orange' | 'red'; text: string }> = {
  pass: { color: 'green', text: 'Pass' },
  warn: { color: 'orange', text: 'Warning' },
  fail: { color: 'red', text: 'Fail' },
  error: { color: 'red', text: 'Fail' },
};

type CheckSummary = {
  variant: 'success' | 'warning' | 'danger';
  passed: number;
  warnings: number;
  failures: number;
  total: number;
};

const computeSummary = (checks: ReadinessCheck[]): CheckSummary => {
  let passed = 0;
  let warnings = 0;
  let failures = 0;

  checks.forEach((check) => {
    switch (check.status) {
      case 'pass':
        passed++;
        break;
      case 'warn':
        warnings++;
        break;
      case 'fail':
      case 'error':
        failures++;
        break;
    }
  });

  const total = checks.length;
  let variant: CheckSummary['variant'] = 'success';
  if (failures > 0) {
    variant = 'danger';
  } else if (warnings > 0) {
    variant = 'warning';
  }

  return { variant, passed, warnings, failures, total };
};

const PlanStepChecklist: React.FC<PlanStepChecklistProps> = ({ analysisData }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const checks = React.useMemo(() => {
    const summary = getReadinessSummary(analysisData.components);
    return summary?.checks ?? [];
  }, [analysisData]);

  const summary = React.useMemo(() => computeSummary(checks), [checks]);

  const summaryMessage = React.useMemo(() => {
    if (summary.failures > 0) {
      return t('{{passed}}/{{total}} checks passed, {{failures}} failed', {
        passed: summary.passed,
        total: summary.total,
        failures: summary.failures,
      });
    }
    if (summary.warnings > 0) {
      return t('{{passed}}/{{total}} checks passed, {{warnings}} warnings', {
        passed: summary.passed,
        total: summary.total,
        warnings: summary.warnings,
      });
    }
    return t('{{passed}}/{{total}} checks passed', {
      passed: summary.passed,
      total: summary.total,
    });
  }, [summary, t]);

  return (
    <Card className="cluster-update-plugin__checklist">
      <CardTitle>{t('Readiness Checks')}</CardTitle>
      <CardBody>
        {checks.length === 0 ? (
          <Content component="p">{t('Readiness data not yet available.')}</Content>
        ) : (
          <>
            <Alert variant={summary.variant} isInline isPlain title={summaryMessage} />
            <Divider className="cluster-update-plugin__checklist-divider" />
            <div className="cluster-update-plugin__checklist-list">
              {checks.map((check, index) => (
                <div key={index} className="cluster-update-plugin__checklist-row">
                  <div className="cluster-update-plugin__checklist-row-header">
                    <span className="cluster-update-plugin__checklist-row-icon">
                      <ReadinessStatusIcon status={check.status} />
                    </span>
                    <span className="cluster-update-plugin__checklist-row-name">
                      <strong>
                        {CHECK_ROUTES[check.name] ? (
                          <Link
                            to={CHECK_ROUTES[check.name]}
                            className="cluster-update-plugin__check-link"
                          >
                            {check.name}
                          </Link>
                        ) : (
                          check.name
                        )}
                      </strong>
                    </span>
                    <Label color={STATUS_DISPLAY[check.status]?.color ?? 'grey'} isCompact>
                      {t(STATUS_DISPLAY[check.status]?.text ?? 'Unknown')}
                    </Label>
                  </div>
                  {check.detail && (
                    <Content component="p" className="cluster-update-plugin__checklist-row-detail">
                      {check.detail}
                    </Content>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
};

export default PlanStepChecklist;
