import * as React from 'react';
import { Alert, Content, ExpandableSection, Stack, StackItem } from '@patternfly/react-core';
import { K8sResourceCommon, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { useTranslation } from 'react-i18next';
import { useAgenticRunApprovals } from '../../hooks/useAgenticRuns';
import { LightspeedAgenticRun } from '../../models/agenticrun';
import { getLogCondition, LogPhase } from '../../utils/logPhase';
import { I18N_NAMESPACE } from '../../utils/constants';

const fields = {
  analysis: 'analysisSeconds',
  execution: 'executionSeconds',
  verification: 'verificationSeconds',
} as const;
const defaults = { analysis: 600, execution: 600, verification: 1800 };
export const isStageTimeout = (run: LightspeedAgenticRun, stage: LogPhase) => {
  const condition = getLogCondition(run, stage);
  return (
    condition?.status === 'False' &&
    (['AgentTimeout', 'SandboxTimeout', 'SandboxStartupTimeout'].includes(condition.reason ?? '') ||
      (stage === 'verification' &&
        condition.reason === 'VerificationFailed' &&
        condition.message === 'Verification failed: AgentTimeout'))
  );
};

type Agent = K8sResourceCommon & {
  spec?: { timeouts?: Partial<Record<(typeof fields)[LogPhase], number>> };
};

const AgentTimeoutConfiguration: React.FC<{ name: string; stage: LogPhase }> = ({
  name,
  stage,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [agent, loaded, error] = useK8sWatchResource<Agent>({
    groupVersionKind: { group: 'agentic.openshift.io', version: 'v1alpha1', kind: 'Agent' },
    name,
  });
  const configured = agent?.spec?.timeouts?.[fields[stage]];
  return (
    <Stack hasGutter>
      <StackItem>
        {error ? (
          <Content component="p">
            {t('Unable to read the Agent configuration. Check access to the Agent resource.')}
          </Content>
        ) : !loaded ? (
          <Content component="p">{t('Loading timeout configuration…')}</Content>
        ) : !agent ? (
          <Content component="p">{t('Agent configuration is unavailable.')}</Content>
        ) : (
          <Content component="p">
            {configured && configured > 0
              ? t('Agent {{name}} is currently configured for {{seconds}} seconds.', {
                  name,
                  seconds: configured,
                })
              : t('Agent {{name}} uses the built-in default of {{seconds}} seconds.', {
                  name,
                  seconds: defaults[stage],
                })}
          </Content>
        )}
      </StackItem>
      <StackItem>
        <a
          href={`/k8s/cluster/agentic.openshift.io~v1alpha1~Agent/${encodeURIComponent(name)}/yaml`}
        >
          {t('View Agent {{name}} YAML', { name })}
        </a>
      </StackItem>
      <StackItem>{t('Changes affect other runs using this Agent.')}</StackItem>
    </Stack>
  );
};

const EffectiveAgentConfiguration: React.FC<{ run: LightspeedAgenticRun; stage: LogPhase }> = ({
  run,
  stage,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [approvals, loaded, error] = useAgenticRunApprovals();
  if (error)
    return (
      <Content component="p">
        {t(
          'Unable to resolve the effective Agent because approval configuration could not be read.',
        )}
      </Content>
    );
  if (!loaded) return <Content component="p">{t('Resolving the effective Agent…')}</Content>;
  const approval = approvals?.find(
    (entry) =>
      entry.metadata?.name === run.metadata?.name &&
      entry.metadata?.namespace === run.metadata?.namespace,
  );
  const type = { analysis: 'Analysis', execution: 'Execution', verification: 'Verification' }[
    stage
  ];
  const decision = approval?.spec?.stages?.find((entry) => entry.type === type);
  const name = decision?.[stage]?.agent || run.spec?.[stage]?.agent || 'default';
  return <AgentTimeoutConfiguration key={name} name={name} stage={stage} />;
};

export const TimeoutGuidance: React.FC<{ run: LightspeedAgenticRun; stage: LogPhase }> = ({
  run,
  stage,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [detailsExpanded, setDetailsExpanded] = React.useState(false);
  const condition = getLogCondition(run, stage);
  if (!condition || !isStageTimeout(run, stage)) return null;
  const startup = condition.reason === 'SandboxStartupTimeout';
  const titles = {
    analysis: t('Update analysis timed out'),
    execution: t('Update execution timed out'),
    verification: t('Update verification timed out'),
  };
  const startupTitles = {
    analysis: t('Analysis sandbox failed to start'),
    execution: t('Execution sandbox failed to start'),
    verification: t('Verification sandbox failed to start'),
  };
  return (
    <Alert isInline variant="danger" title={startup ? startupTitles[stage] : titles[stage]}>
      <Stack hasGutter>
        <StackItem>
          {startup
            ? t(
                'Review sandbox events for scheduling or image pull problems. Increasing the Agent execution timeout will not resolve this startup failure.',
              )
            : stage === 'analysis'
              ? t(
                  'Review the analysis logs. If more time is needed, ask an administrator to increase the analysis timeout, then select Re-analyse.',
                )
              : stage === 'execution'
                ? t(
                    'Some actions may have completed. Review execution logs, Actions taken, and current cluster state before retrying. If more time is needed, ask an administrator to increase the execution timeout.',
                  )
                : t(
                    'Review verification logs and escalation status. A verification timeout alone does not mean the cluster update failed. To allow more time for a new verification attempt, review the verification timeout.',
                  )}
        </StackItem>
        {startup ? (
          run.metadata?.namespace && (
            <StackItem>
              <a href={`/k8s/ns/${encodeURIComponent(run.metadata.namespace)}/pods`}>
                {t('View sandbox namespace pods')}
              </a>
            </StackItem>
          )
        ) : (
          <StackItem>
            <EffectiveAgentConfiguration run={run} stage={stage} />
          </StackItem>
        )}
        <StackItem>
          <ExpandableSection
            toggleText={t('Technical details')}
            isExpanded={detailsExpanded}
            onToggle={(_event, value) => setDetailsExpanded(value)}
          >
            <Stack hasGutter>
              <StackItem>
                <strong>{t('Timeout reason:')}</strong> {condition.reason}
              </StackItem>
              {condition.message && (
                <StackItem>
                  <strong>{t('Operator message:')}</strong> {condition.message}
                </StackItem>
              )}
              {!startup && (
                <>
                  <StackItem>
                    {t('Timeout field:')} <code>spec.timeouts.{fields[stage]}</code>
                  </StackItem>
                  <StackItem>
                    {t(
                      'Supported maximum: 3600 seconds. Configuration changes apply to a new attempt; they do not restart a failed stage.',
                    )}
                  </StackItem>
                </>
              )}
              {condition.reason === 'SandboxTimeout' && (
                <StackItem>
                  {t(
                    'The sandbox exceeded its outer deadline. Review sandbox logs as well as the Agent timeout configuration.',
                  )}
                </StackItem>
              )}
            </Stack>
          </ExpandableSection>
        </StackItem>
      </Stack>
    </Alert>
  );
};
