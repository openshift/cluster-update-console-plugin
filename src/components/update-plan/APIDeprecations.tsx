import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardBody, CardTitle, Content, Icon, List, ListItem } from '@patternfly/react-core';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@patternfly/react-icons';
import {
  AnalysisData,
  FINDING_CHECKS,
  getReadinessSummary,
  getFindings,
  OtaFinding,
} from '../../models/proposal';
import ReadinessStatusIcon from '../shared/ReadinessStatusIcon';
import { I18N_NAMESPACE } from '../../utils/constants';

type APIDeprecationsProps = {
  analysisData: AnalysisData;
};

const CleanState: React.FC<{ status?: string; detail?: string; fallback: string }> = ({
  status,
  detail,
  fallback,
}) => (
  <div className="cluster-update-plugin__api-deprecations-clean">
    {status ? (
      <ReadinessStatusIcon status={status as 'pass'} />
    ) : (
      <Icon status="success">
        <CheckCircleIcon />
      </Icon>
    )}
    <Content component="p">{detail ?? fallback}</Content>
  </div>
);

const APIDeprecations: React.FC<APIDeprecationsProps> = ({ analysisData }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const { deprecationCheck, deprecationFindings } = React.useMemo(() => {
    const summary = getReadinessSummary(analysisData.components);

    const check = summary?.checks?.find(
      (c) => c.name.toLowerCase().replace(/[\s_]+/g, '_') === FINDING_CHECKS.apiDeprecations,
    );

    const findings: OtaFinding[] = getFindings(analysisData.components).filter(
      (f) => f.check === FINDING_CHECKS.apiDeprecations,
    );

    return { deprecationCheck: check, deprecationFindings: findings };
  }, [analysisData]);

  const noData = !deprecationCheck && deprecationFindings.length === 0;
  const isPassing = deprecationCheck?.status === 'pass';
  const fallbackText = t('No deprecated APIs in use');

  const renderBody = () => {
    if (noData) {
      return <CleanState fallback={fallbackText} />;
    }
    if (isPassing) {
      return (
        <CleanState
          status={deprecationCheck!.status}
          detail={deprecationCheck!.detail}
          fallback={fallbackText}
        />
      );
    }
    return (
      <>
        {deprecationCheck && (
          <Content component="p">
            <ReadinessStatusIcon status={deprecationCheck.status} />{' '}
            <strong>{deprecationCheck.name}</strong>
            {deprecationCheck.detail && ` — ${deprecationCheck.detail}`}
          </Content>
        )}
        {deprecationFindings.length > 0 && (
          <List isPlain>
            {deprecationFindings.map((finding, index) => (
              <ListItem key={index} className="cluster-update-plugin__deprecation-item">
                <Content component="p">
                  <Icon status="warning">
                    <ExclamationTriangleIcon />
                  </Icon>{' '}
                  <strong>{finding.check}</strong>
                  {finding.detail && ` - ${finding.detail}`}
                </Content>
              </ListItem>
            ))}
          </List>
        )}
      </>
    );
  };

  return (
    <Card isCompact className="cluster-update-plugin__api-deprecations">
      <CardTitle>{t('API Deprecations')}</CardTitle>
      <CardBody>{renderBody()}</CardBody>
    </Card>
  );
};

export default APIDeprecations;
