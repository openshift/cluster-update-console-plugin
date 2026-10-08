import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardBody,
  CardTitle,
  Content,
  Label,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { RemediationDiagnosis } from '../../models/agenticrun';
import { I18N_NAMESPACE } from '../../utils/constants';

type DiagnosisCardProps = {
  diagnosis: RemediationDiagnosis;
};

const getConfidenceColor = (confidence: 'Low' | 'Medium' | 'High'): 'red' | 'orange' | 'green' => {
  switch (confidence) {
    case 'High':
      return 'green';
    case 'Medium':
      return 'orange';
    case 'Low':
      return 'red';
  }
};

const DiagnosisCard: React.FC<DiagnosisCardProps> = ({ diagnosis }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  return (
    <Card className="cluster-update-plugin__diagnosis-card">
      <CardTitle>
        {t('Root Cause Analysis')}
        <Label
          color={getConfidenceColor(diagnosis.confidence)}
          isCompact
          style={{ marginLeft: '12px' }}
        >
          {t('{{confidence}} confidence', { confidence: diagnosis.confidence })}
        </Label>
      </CardTitle>
      <CardBody>
        <Stack hasGutter>
          <StackItem>
            <Content component="p">{diagnosis.summary}</Content>
          </StackItem>
          {diagnosis.rootCause && (
            <StackItem>
              <Content component="p">
                <strong>{t('Root cause:')}</strong>{' '}
                <span className="cluster-update-plugin__diagnosis-root-cause">
                  {diagnosis.rootCause}
                </span>
              </Content>
            </StackItem>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
};

export default DiagnosisCard;
