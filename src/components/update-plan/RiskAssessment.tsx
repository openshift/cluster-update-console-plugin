import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Card,
  CardBody,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Label,
} from '@patternfly/react-core';
import {
  AnalysisData,
  getRiskColor,
  getReadinessSummary,
  OtaReadinessSummary,
} from '../../models/proposal';
import { I18N_NAMESPACE } from '../../utils/constants';

type RiskAssessmentProps = {
  analysisData: AnalysisData;
};

const RISK_LABELS: Record<string, string> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
};

type DecisionAlertConfig = {
  variant: 'success' | 'warning' | 'danger' | 'info';
  title: string;
};

const DECISION_ALERTS: Record<OtaReadinessSummary['decision'], DecisionAlertConfig> = {
  recommend: { variant: 'success', title: 'Upgrade Recommended' },
  caution: { variant: 'warning', title: 'Proceed with Caution' },
  block: { variant: 'danger', title: 'Upgrade Blocked' },
  escalate: { variant: 'info', title: 'Needs Manual Review' },
};

const RiskAssessment: React.FC<RiskAssessmentProps> = ({ analysisData }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const { option, decision } = React.useMemo(() => {
    const summary = getReadinessSummary(analysisData.components);
    return { option: analysisData.option, decision: summary?.decision };
  }, [analysisData]);

  const risk = option?.proposal?.risk;
  const riskColor = getRiskColor(risk);
  const riskLabel = t(RISK_LABELS[risk?.toLowerCase() ?? ''] ?? 'Unknown');

  const estimatedImpact = option?.proposal?.estimatedImpact;
  const description = option?.proposal?.description;
  const reversible = option?.proposal?.reversible;

  const alertConfig = decision ? DECISION_ALERTS[decision] : undefined;

  return (
    <Card className="cluster-update-plugin__risk-assessment">
      <CardBody>
        {!option ? (
          <Content component="p">{t('Risk assessment not yet available.')}</Content>
        ) : (
          <>
            {alertConfig && (
              <Alert
                variant={alertConfig.variant}
                isInline
                title={t(alertConfig.title)}
                className="cluster-update-plugin__risk-alert"
              />
            )}
            {description && (
              <Content component="p" className="cluster-update-plugin__risk-description">
                {description}
              </Content>
            )}
            <DescriptionList
              isHorizontal
              isCompact
              className="cluster-update-plugin__risk-details-list"
            >
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Risk Level')}</DescriptionListTerm>
                <DescriptionListDescription>
                  <Label color={riskColor} isCompact>
                    {riskLabel}
                  </Label>
                </DescriptionListDescription>
              </DescriptionListGroup>
              {estimatedImpact && (
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Estimated Impact')}</DescriptionListTerm>
                  <DescriptionListDescription>{estimatedImpact}</DescriptionListDescription>
                </DescriptionListGroup>
              )}
              {reversible !== undefined && (
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Reversibility')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {reversible ? t('Reversible') : t('Not reversible')}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              )}
            </DescriptionList>
          </>
        )}
      </CardBody>
    </Card>
  );
};

export default RiskAssessment;
