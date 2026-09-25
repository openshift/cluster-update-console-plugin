import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Card,
  CardBody,
  CardTitle,
  Content,
  ExpandableSection,
  Label,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { ExclamationTriangleIcon, CheckCircleIcon, InfoCircleIcon } from '@patternfly/react-icons';
import { RemediationOption } from '../../models/agenticrun';
import { I18N_NAMESPACE } from '../../utils/constants';

type RemediationPlanViewProps = {
  option: RemediationOption;
  optionIndex: number;
};

const getRiskColor = (risk: 'Low' | 'Medium' | 'High' | 'Critical'): 'green' | 'orange' | 'red' => {
  switch (risk) {
    case 'Low':
      return 'green';
    case 'Medium':
      return 'orange';
    case 'High':
    case 'Critical':
      return 'red';
  }
};

const getReversibilityIcon = (reversible?: 'Reversible' | 'Irreversible' | 'Partial') => {
  switch (reversible) {
    case 'Reversible':
      return <CheckCircleIcon color="var(--pf-t--global--icon--color--status--success--default)" />;
    case 'Irreversible':
      return (
        <ExclamationTriangleIcon color="var(--pf-t--global--icon--color--status--danger--default)" />
      );
    case 'Partial':
      return <InfoCircleIcon color="var(--pf-t--global--icon--color--status--info--default)" />;
    default:
      return null;
  }
};

const RemediationPlanView: React.FC<RemediationPlanViewProps> = ({ option, optionIndex }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  if (!option.proposal) {
    return null;
  }

  const { proposal } = option;

  return (
    <Card className="cluster-update-plugin__remediation-plan">
      <CardTitle>
        {option.title || t('Remediation Plan {{index}}', { index: optionIndex + 1 })}
      </CardTitle>
      <CardBody>
        <Stack hasGutter>
          {option.summary && (
            <StackItem>
              <Content component="p">{option.summary}</Content>
            </StackItem>
          )}

          <StackItem>
            <Content component="p">
              <strong>{t('Risk:')}</strong>{' '}
              <Label color={getRiskColor(proposal.risk)} isCompact>
                {proposal.risk}
              </Label>
              {proposal.reversible && (
                <>
                  {' '}
                  <strong>{t('Reversibility:')}</strong> {getReversibilityIcon(proposal.reversible)}{' '}
                  {proposal.reversible}
                </>
              )}
            </Content>
          </StackItem>

          {proposal.reversible === 'Irreversible' && (
            <StackItem>
              <Alert
                variant="warning"
                isInline
                title={t('This remediation cannot be rolled back')}
                className="cluster-update-plugin__irreversibility-warning"
              >
                {t(
                  'Once executed, this remediation cannot be automatically undone. Review the plan carefully before proceeding.',
                )}
              </Alert>
            </StackItem>
          )}

          <StackItem>
            <Content component="h3" className="cluster-update-plugin__remediation-section-title">
              {t('Remediation Steps')}
            </Content>
            <Content component="p">{proposal.description}</Content>
          </StackItem>

          {proposal.actions && proposal.actions.length > 0 && (
            <StackItem>
              <Stack hasGutter>
                {proposal.actions.map((action, idx) => (
                  <StackItem key={idx}>
                    <Card isCompact className="cluster-update-plugin__action-step">
                      <CardBody>
                        <Content component="p">
                          <Label color="blue" isCompact>
                            {action.type}
                          </Label>{' '}
                          {action.description}
                        </Content>
                      </CardBody>
                    </Card>
                  </StackItem>
                ))}
              </Stack>
            </StackItem>
          )}

          <StackItem>
            <Content component="p">
              <strong>{t('Estimated Impact:')}</strong> {proposal.estimatedImpact}
            </Content>
          </StackItem>

          {proposal.rollbackPlan && (
            <StackItem>
              <ExpandableSection toggleText={t('Rollback Plan')} isIndented>
                <Stack hasGutter>
                  <StackItem>
                    <Content component="p">{proposal.rollbackPlan.description}</Content>
                  </StackItem>
                  {proposal.rollbackPlan.command && (
                    <StackItem>
                      <Content component="p">
                        <strong>{t('Rollback command:')}</strong>
                      </Content>
                      <Content component="pre" className="cluster-update-plugin__rollback-command">
                        <code>{proposal.rollbackPlan.command}</code>
                      </Content>
                    </StackItem>
                  )}
                </Stack>
              </ExpandableSection>
            </StackItem>
          )}

          {option.verification && (
            <StackItem>
              <ExpandableSection toggleText={t('Verification Plan')} isIndented>
                <Stack hasGutter>
                  <StackItem>
                    <Content component="p">{option.verification.description}</Content>
                  </StackItem>
                  {option.verification.steps && option.verification.steps.length > 0 && (
                    <StackItem>
                      <Content component="p">
                        <strong>{t('Verification steps:')}</strong>
                      </Content>
                      <Stack hasGutter>
                        {option.verification.steps.map((step, idx) => (
                          <StackItem key={idx}>
                            <Card isCompact>
                              <CardBody>
                                <Content component="p">
                                  <strong>{step.name}</strong> ({step.type})
                                </Content>
                                {step.command && (
                                  <Content
                                    component="pre"
                                    className="cluster-update-plugin__verification-command"
                                  >
                                    <code>{step.command}</code>
                                  </Content>
                                )}
                                {step.expected && (
                                  <Content component="p">
                                    <em>
                                      {t('Expected: {{expected}}', { expected: step.expected })}
                                    </em>
                                  </Content>
                                )}
                              </CardBody>
                            </Card>
                          </StackItem>
                        ))}
                      </Stack>
                    </StackItem>
                  )}
                </Stack>
              </ExpandableSection>
            </StackItem>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
};

export default RemediationPlanView;
