import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  ClipboardCopy,
  Content,
  ExpandableSection,
  Label,
  Stack,
  StackItem,
  Title,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ExecutionResultGVK, LightspeedExecutionResult } from '../../models/agenticrun';
import { I18N_NAMESPACE } from '../../utils/constants';
import { MarkdownContent } from '../shared/MarkdownContent';
import { StepTypeLabel } from './lightspeed/StepTypeLabel';

type ActionsTakenProps = { name: string; namespace: string; agenticRunName: string };

export const ActionsTaken: FC<ActionsTakenProps> = ({ name, namespace, agenticRunName }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [result, loaded, error] = useK8sWatchResource<LightspeedExecutionResult>({
    groupVersionKind: ExecutionResultGVK,
    name,
    namespace,
    namespaced: true,
  });
  const current =
    result?.metadata?.name === name &&
    result.metadata.namespace === namespace &&
    result.spec.agenticRunName === agenticRunName;
  const actions = current ? (result.status?.actionsTaken ?? []) : [];

  return (
    <Stack hasGutter>
      <StackItem>
        <Title headingLevel="h3" size="md">
          {t('Actions taken')}
        </Title>
      </StackItem>
      <StackItem>
        {error ? (
          <Alert isInline variant="warning" title={t('Failed to load actions taken')}>
            {error instanceof Error ? error.message : String(error)}
          </Alert>
        ) : !loaded || !current ? (
          <Content component="p">{t('Loading execution details...')}</Content>
        ) : actions.length === 0 ? (
          <Content component="p">{t('No actions were recorded for this execution.')}</Content>
        ) : (
          <ExpandableSection
            toggleTextCollapsed={t('View action details')}
            toggleTextExpanded={t('Hide action details')}
          >
            <Table aria-label={t('Actions taken')} variant="compact">
              <Thead>
                <Tr>
                  <Th modifier="fitContent">{t('Step')}</Th>
                  <Th modifier="fitContent">{t('Type')}</Th>
                  <Th modifier="fitContent">{t('Outcome')}</Th>
                  <Th width={50}>{t('Description')}</Th>
                  <Th width={50}>{t('Output')}</Th>
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
                    <Td dataLabel={t('Outcome')} modifier="fitContent">
                      <Label isCompact status={action.outcome === 'Failed' ? 'danger' : 'success'}>
                        {action.outcome === 'Failed' ? t('Failed') : t('Succeeded')}
                      </Label>
                    </Td>
                    <Td dataLabel={t('Description')}>
                      <MarkdownContent text={action.description} />
                      {action.error && <Alert isInline variant="danger" title={action.error} />}
                    </Td>
                    <Td dataLabel={t('Output')}>
                      {action.output ? (
                        <ClipboardCopy
                          isReadOnly
                          copyAriaLabel={t('Copy to clipboard')}
                          textAriaLabel={t('Output')}
                          hoverTip={t('Copy to clipboard')}
                          clickTip={t('Successfully copied to clipboard!')}
                        >
                          {action.output}
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
        )}
      </StackItem>
    </Stack>
  );
};
