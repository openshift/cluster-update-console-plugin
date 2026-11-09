import { ClipboardCopy, ExpandableSection, Stack, StackItem, Title } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { VerificationPlan as VerificationPlanData } from '../../../models/agenticrun';
import { I18N_NAMESPACE } from '../../../utils/constants';
import { MarkdownContent } from '../../shared/MarkdownContent';
import { StepTypeLabel } from './StepTypeLabel';

export const VerificationPlan: FC<{ verification: VerificationPlanData }> = ({ verification }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  return (
    <Stack hasGutter>
      <StackItem>
        <Title headingLevel="h4" size="md">
          {t('Verification plan')}
        </Title>
      </StackItem>
      <StackItem>
        <ExpandableSection
          toggleTextCollapsed={t('View verification details')}
          toggleTextExpanded={t('Hide verification details')}
        >
          <Stack hasGutter>
            {verification.description && (
              <StackItem>
                <MarkdownContent text={verification.description} />
              </StackItem>
            )}
            {!!verification.steps?.length && (
              <StackItem>
                <Table aria-label={t('Verification plan')} variant="compact">
                  <Thead>
                    <Tr>
                      <Th>{t('Step')}</Th>
                      <Th>{t('Check')}</Th>
                      <Th>{t('Type')}</Th>
                      <Th width={60}>{t('Command')}</Th>
                      <Th width={20} modifier="wrap">
                        {t('Expected result')}
                      </Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {verification.steps.map((step, index) => (
                      <Tr key={index}>
                        <Td dataLabel={t('Step')}>{index + 1}</Td>
                        <Td dataLabel={t('Check')}>{step.name}</Td>
                        <Td dataLabel={t('Type')}>
                          {step.type ? <StepTypeLabel type={step.type} /> : '-'}
                        </Td>
                        <Td dataLabel={t('Command')}>
                          {step.command ? (
                            <ClipboardCopy
                              isReadOnly
                              copyAriaLabel={t('Copy to clipboard')}
                              textAriaLabel={t('Command')}
                              hoverTip={t('Copy to clipboard')}
                              clickTip={t('Successfully copied to clipboard!')}
                            >
                              {step.command}
                            </ClipboardCopy>
                          ) : (
                            '-'
                          )}
                        </Td>
                        <Td dataLabel={t('Expected result')}>{step.expected ?? '-'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </StackItem>
            )}
          </Stack>
        </ExpandableSection>
      </StackItem>
    </Stack>
  );
};
