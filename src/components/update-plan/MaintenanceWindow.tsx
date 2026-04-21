import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardBody,
  CardTitle,
  ClipboardCopy,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
} from '@patternfly/react-core';
import {
  AnalysisData,
  AgentAction,
  ACTION_TYPES,
} from '../../models/proposal';
import { I18N_NAMESPACE } from '../../utils/constants';

type MaintenanceWindowProps = {
  analysisData: AnalysisData;
};

const MaintenanceWindow: React.FC<MaintenanceWindowProps> = ({ analysisData }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const { estimatedImpact, upgradeAction, monitorAction } = React.useMemo(() => {
    const { option } = analysisData;
    const impact = option?.proposal?.estimatedImpact;
    const upgrade: AgentAction | undefined = option?.proposal?.actions?.find(
      (a) => a.type === ACTION_TYPES.upgrade,
    );
    const monitor: AgentAction | undefined = option?.proposal?.actions?.find(
      (a) => a.type === ACTION_TYPES.monitor,
    );
    return { estimatedImpact: impact, upgradeAction: upgrade, monitorAction: monitor };
  }, [analysisData]);

  const hasContent = estimatedImpact || upgradeAction || monitorAction;

  return (
    <Card className="cluster-update-plugin__maintenance-window">
      <CardTitle>{t('Maintenance Details')}</CardTitle>
      <CardBody>
        {!hasContent ? (
          <Content component="p" className="cluster-update-plugin__maintenance-empty">
            {t('No maintenance details available.')}
          </Content>
        ) : (
          <DescriptionList isCompact>
            {estimatedImpact && (
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Estimated Duration')}</DescriptionListTerm>
                <DescriptionListDescription>{estimatedImpact}</DescriptionListDescription>
              </DescriptionListGroup>
            )}
            {upgradeAction && (
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Upgrade Command')}</DescriptionListTerm>
                <DescriptionListDescription>
                  <ClipboardCopy isReadOnly isCode variant="inline-compact">
                    {upgradeAction.description}
                  </ClipboardCopy>
                </DescriptionListDescription>
              </DescriptionListGroup>
            )}
            {monitorAction && (
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Monitor Command')}</DescriptionListTerm>
                <DescriptionListDescription>
                  <ClipboardCopy isReadOnly isCode variant="inline-compact">
                    {monitorAction.description}
                  </ClipboardCopy>
                </DescriptionListDescription>
              </DescriptionListGroup>
            )}
          </DescriptionList>
        )}
      </CardBody>
    </Card>
  );
};

export default MaintenanceWindow;
