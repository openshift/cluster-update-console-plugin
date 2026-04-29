import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  Flex,
  FlexItem,
  Icon,
  Label,
} from '@patternfly/react-core';
import { BoltIcon } from '@patternfly/react-icons';
import { I18N_NAMESPACE } from '../../utils/constants';

type AIAssessmentCardProps = {
  currentVersion: string;
  availableCount: number;
};

const AIAssessmentCard: React.FC<AIAssessmentCardProps> = ({ currentVersion, availableCount }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  return (
    <Card isCompact>
      <CardTitle>
        <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
          <FlexItem>
            <Icon>
              <BoltIcon />
            </Icon>
          </FlexItem>
          <FlexItem>{t('AI Assessment')}</FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        <Content component="p">
          {t(
            'In the OCP 5.0 agent led experience, the update agent proposes plans and drives execution. OpenShift Lightspeed can still run a pre-check on cluster and operator readiness before you approve, so risks and prerequisites stay visible alongside automated planning.',
          )}
        </Content>
        <Flex
          alignItems={{ default: 'alignItemsCenter' }}
          gap={{ default: 'gapMd' }}
          className="cluster-update-plugin__assessment-version"
        >
          <FlexItem>
            <Label variant="outline">
              {t('Version {{version}}, {{count}} available', {
                version: currentVersion,
                count: availableCount,
              })}
            </Label>
          </FlexItem>
        </Flex>
        <Button variant="secondary" size="sm" className="cluster-update-plugin__precheck-btn">
          {t('Pre-check with AI')}
        </Button>
      </CardBody>
    </Card>
  );
};

export default AIAssessmentCard;
