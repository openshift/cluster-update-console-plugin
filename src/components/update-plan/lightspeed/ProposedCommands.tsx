import { ClipboardCopy, ExpandableSection, Stack, StackItem, Title } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ProposedAction } from '../../../models/agenticrun';
import { I18N_NAMESPACE } from '../../../utils/constants';
import { MarkdownContent } from '../../shared/MarkdownContent';
import { StepTypeLabel } from './StepTypeLabel';

export const ProposedCommands: FC<{ actions: ProposedAction[] }> = ({ actions }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  if (!actions.length) return null;

  return (
    <Stack hasGutter>
      <StackItem>
        <Title headingLevel="h4" size="md">
          {t('Proposed agent commands')}
        </Title>
      </StackItem>
      <StackItem>
        <ExpandableSection
          toggleTextCollapsed={t('View command details')}
          toggleTextExpanded={t('Hide command details')}
        >
          <Table aria-label={t('Proposed agent commands')} variant="compact">
            <Thead>
              <Tr>
                <Th modifier="fitContent">{t('Step')}</Th>
                <Th modifier="fitContent">{t('Type')}</Th>
                <Th width={50}>{t('Description')}</Th>
                <Th width={50}>{t('Command')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {actions.map((action, index) => (
                <Tr key={index}>
                  <Td dataLabel={t('Step')} modifier="fitContent">
                    {index + 1}
                  </Td>
                  <Td dataLabel={t('Type')} modifier="fitContent">
                    <StepTypeLabel type={action.type} />
                  </Td>
                  <Td dataLabel={t('Description')}>
                    <MarkdownContent text={action.description} />
                  </Td>
                  <Td dataLabel={t('Command')}>
                    {action.command ? (
                      <ClipboardCopy
                        isReadOnly
                        copyAriaLabel={t('Copy to clipboard')}
                        textAriaLabel={t('Command')}
                        hoverTip={t('Copy to clipboard')}
                        clickTip={t('Successfully copied to clipboard!')}
                      >
                        {action.command}
                      </ClipboardCopy>
                    ) : (
                      '-'
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </ExpandableSection>
      </StackItem>
    </Stack>
  );
};
