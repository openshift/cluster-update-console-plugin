import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Card,
  CardTitle,
  CardBody,
  ClipboardCopy,
  Content,
  ExpandableSection,
  Flex,
  FlexItem,
  Label,
  List,
  ListItem,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { OtaFinding, ReadinessCheck, sortFindings } from '../../models/agenticrun';
import { I18N_NAMESPACE } from '../../utils/constants';

type ReadinessState = 'blocked' | 'unknown' | 'review' | 'ready';

type Props = {
  checks: ReadinessCheck[];
  findings: OtaFinding[];
  assessedAt?: string;
  recheckAction?: React.ReactNode;
};

export const ReadinessChecklist: React.FC<Props> = ({
  checks,
  findings,
  assessedAt,
  recheckAction,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [passedExpanded, setPassedExpanded] = React.useState(false);
  const names = [
    ...new Set([
      ...checks.map((check) => check.name),
      ...sortFindings(findings).map((finding) => finding.check),
    ]),
  ];
  const items = names.map((name) => {
    const check = checks.find((item) => item.name === name);
    const related = sortFindings(findings.filter((item) => item.check === name));
    const state: ReadinessState =
      check?.status === 'fail' || related.some((item) => item.severity === 'blocker')
        ? 'blocked'
        : check?.status === 'error'
          ? 'unknown'
          : check?.status === 'warn' || related.some((item) => item.severity === 'warning')
            ? 'review'
            : check?.status === 'pass'
              ? 'ready'
              : 'unknown';
    return { name, check, related, state };
  });
  const order: ReadinessState[] = ['blocked', 'unknown', 'review', 'ready'];
  items.sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state));
  const labels = {
    blocked: t('Blocked'),
    unknown: t('Needs recheck'),
    review: t('Needs review'),
    ready: t('Ready'),
  };
  const colors = { blocked: 'red', unknown: 'grey', review: 'orange', ready: 'green' } as const;
  const timestamp =
    assessedAt && !Number.isNaN(Date.parse(assessedAt))
      ? new Date(assessedAt).toLocaleString()
      : undefined;

  const attention = items.filter((item) => item.state !== 'ready');
  const passed = items.filter((item) => item.state === 'ready');
  const blockers = items.filter((item) => item.state === 'blocked').length;
  const incomplete = items.some((item) => item.state === 'unknown');
  const summary =
    blockers > 0
      ? blockers === 1
        ? t('1 blocker must be resolved')
        : t('{{total}} blockers must be resolved', { total: blockers })
      : incomplete
        ? t('Some checks could not be completed')
        : attention.length > 0
          ? t('Review warnings before updating')
          : passed.length > 0
            ? t('All assessed checks passed')
            : t('No readiness checks available');
  const renderItems = (rows: typeof items) => (
    <List isPlain>
      {rows.map(({ name, check, related, state }) => (
        <ListItem key={name}>
          <Stack hasGutter>
            <StackItem>
              <strong>{name}</strong>{' '}
              <Label isCompact color={colors[state]}>
                {labels[state]}
              </Label>
            </StackItem>
            {check?.detail && (
              <StackItem>
                {state !== 'ready' && <strong>{t('Problem')}: </strong>}
                {check.detail}
              </StackItem>
            )}
            {related.map((finding, index) => (
              <StackItem key={index}>
                <Stack hasGutter>
                  <StackItem>{finding.detail}</StackItem>
                  {!!finding.affectedResources?.length && (
                    <StackItem>
                      <strong>{t('Affected resources')}</strong>
                      <List>
                        {finding.affectedResources.map((resource, i) => (
                          <ListItem key={i}>{resource}</ListItem>
                        ))}
                      </List>
                    </StackItem>
                  )}
                  {finding.prerequisite && (
                    <StackItem>
                      <strong>{t('Required action')}</strong>
                      <Content component="p">{finding.prerequisite}</Content>
                    </StackItem>
                  )}
                  {finding.verifyCommand && (
                    <StackItem>
                      <strong>{t('Verification command')}</strong>
                      <ClipboardCopy
                        isReadOnly
                        hoverTip={t('Copy')}
                        clickTip={t('Copied')}
                        textAriaLabel={t('Verification command')}
                      >
                        {finding.verifyCommand}
                      </ClipboardCopy>
                    </StackItem>
                  )}
                </Stack>
              </StackItem>
            ))}
          </Stack>
        </ListItem>
      ))}
    </List>
  );

  return (
    <Card>
      <CardTitle>{t('Upgrade readiness checklist')}</CardTitle>
      <CardBody>
        <Stack hasGutter>
          <StackItem>
            <Alert
              isInline
              variant={
                blockers > 0
                  ? 'danger'
                  : incomplete || attention.length > 0
                    ? 'warning'
                    : passed.length > 0
                      ? 'success'
                      : 'info'
              }
              title={summary}
            />
          </StackItem>
          <StackItem>
            <Flex>
              {order.map((state) => (
                <FlexItem key={state}>
                  <Label color={colors[state]}>
                    {labels[state]}: {items.filter((item) => item.state === state).length}
                  </Label>
                </FlexItem>
              ))}
            </Flex>
          </StackItem>
          <StackItem>
            <Content component="p">
              {timestamp
                ? t('Assessment from {{time}}.', {
                    time: timestamp,
                    interpolation: { escapeValue: false },
                  })
                : t('Based on the latest analysis result.')}{' '}
              {t(
                'This is an assessment snapshot. After resolving prerequisites, re-analyse to confirm readiness.',
              )}
            </Content>
            {recheckAction}
          </StackItem>
          {attention.length > 0 && <StackItem>{renderItems(attention)}</StackItem>}
          {passed.length > 0 && (
            <StackItem>
              <ExpandableSection
                toggleText={t('Passed checks ({{total}})', { total: passed.length })}
                isExpanded={passedExpanded}
                onToggle={(_event, value) => setPassedExpanded(value)}
              >
                {renderItems(passed)}
              </ExpandableSection>
            </StackItem>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
};
