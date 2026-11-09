import { useMemo, useRef, useState, useEffect } from 'react';
import {
  Alert,
  Button,
  Content,
  ExpandableSection,
  Label,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from '@patternfly/react-core';
import { LogViewer, LogViewerSearch } from '@patternfly/react-log-viewer';
import { useTranslation } from 'react-i18next';
import { LightspeedAgenticRun } from '../../models/agenticrun';
import { useStepSandbox } from '../../hooks/useExecutionSandbox';
import { useSandboxLogStream } from '../../hooks/useSandboxLogStream';
import { useRetainedLogs } from '../../hooks/useRetainedLogs';
import { I18N_NAMESPACE } from '../../utils/constants';
import { getLogCondition, isLogStreaming, LogPhase } from '../../utils/logPhase';
import { useLogIdentity } from '../../hooks/useLogIdentity';
import './ExecutionLogs.css';

const StepLogs = ({ run, phase }: { run: LightspeedAgenticRun; phase: LogPhase }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [expanded, setExpanded] = useState(false);
  const [following, setFollowing] = useState(true);
  const viewer = useRef<{ scrollToItem?: (index: number) => void }>(null);
  const analysis = phase === 'analysis';
  const condition = getLogCondition(run, phase);
  const waiting = analysis && !condition;
  const streaming = isLogStreaming(run, phase);
  const retained = useRetainedLogs(run.metadata?.uid, expanded && !streaming && !waiting, phase);
  const useCollector =
    !streaming && !retained.error && retained.available && retained.lines.length > 0;
  const sandbox = useStepSandbox(run, expanded && !useCollector && !retained.loading, phase);
  const podLogs = useSandboxLogStream(
    sandbox.pod,
    expanded && !useCollector && !retained.loading && !!sandbox.pod && !sandbox.missing,
    streaming,
    sandbox.pod?.sinceTime,
  );
  const lines = useCollector ? retained.lines : podLogs.lines;
  const data = useMemo(() => lines.join('\n'), [lines]);
  const loading = expanded && (retained.loading || sandbox.loading || podLogs.loading);
  const truncated = useCollector ? retained.truncated : podLogs.truncated;
  const text = {
    analysis: {
      label: t('Analysis'),
      failed: t('Analysis failed'),
      retained: t('Retained analysis history'),
      pod: t('Pod analysis logs'),
      loaded: t('Analysis logs loaded'),
      idle: t('Waiting for analysis logs'),
      connecting: t('Connecting to analysis logs'),
      streaming: t('Streaming analysis logs'),
      reconnecting: t('Reconnecting to analysis logs'),
      error: t('Analysis log connection failed'),
      hide: t('Hide analysis logs'),
      view: t('View analysis logs'),
      waiting: t('Waiting for analysis sandbox'),
      unavailable: t('Analysis pod is unavailable'),
      history: t('Retained history includes all analysis attempts for this run.'),
      partial: t('Some analysis logs could not be loaded'),
      retry: t('Retry analysis logs'),
      boundary: t(
        'Without an analysis-start timestamp, pod history is limited to the latest 500 lines.',
      ),
      empty: t('No analysis logs available.'),
      search: t('Search analysis logs'),
      resolveError: t('Failed to resolve analysis sandbox: {{detail}}', { detail: sandbox.error }),
    },
    execution: {
      label: t('Execution'),
      failed: t('Execution failed'),
      retained: t('Retained execution history'),
      pod: t('Pod execution logs'),
      loaded: t('Execution logs loaded'),
      idle: t('Waiting for execution logs'),
      connecting: t('Connecting to execution logs'),
      streaming: t('Streaming execution logs'),
      reconnecting: t('Reconnecting to execution logs'),
      error: t('Execution log connection failed'),
      hide: t('Hide execution logs'),
      view: t('View execution logs'),
      waiting: t('Waiting for execution sandbox'),
      unavailable: t('Execution pod is unavailable'),
      history: t('Retained history includes all execution attempts for this run.'),
      partial: t('Some execution logs could not be loaded'),
      retry: t('Retry execution logs'),
      boundary: t(
        'Without an execution-start timestamp, pod history is limited to the latest 500 lines.',
      ),
      empty: t('No execution logs available.'),
      search: t('Search execution logs'),
      resolveError: t('Failed to resolve execution sandbox: {{detail}}', { detail: sandbox.error }),
    },
    verification: {
      label: t('Verification'),
      failed: t('Verification failed'),
      retained: t('Retained verification history'),
      pod: t('Pod verification logs'),
      loaded: t('Verification logs loaded'),
      idle: t('Waiting for verification logs'),
      connecting: t('Connecting to verification logs'),
      streaming: t('Streaming verification logs'),
      reconnecting: t('Reconnecting to verification logs'),
      error: t('Verification log connection failed'),
      hide: t('Hide verification logs'),
      view: t('View verification logs'),
      waiting: t('Waiting for verification sandbox'),
      unavailable: t('Verification pod is unavailable'),
      history: t('Retained history includes all verification attempts for this run.'),
      partial: t('Some verification logs could not be loaded'),
      retry: t('Retry verification logs'),
      boundary: t(
        'Without a verification-start timestamp, pod history is limited to the latest 500 lines.',
      ),
      empty: t('No verification logs available.'),
      search: t('Search verification logs'),
      resolveError: t('Failed to resolve verification sandbox: {{detail}}', {
        detail: sandbox.error,
      }),
    },
  }[phase];
  const error = useCollector ? undefined : sandbox.error ? text.resolveError : podLogs.error;
  const source = useCollector ? text.retained : text.pod;
  const connection = podLogs.state === 'complete' ? text.loaded : text[podLogs.state];

  useEffect(() => {
    if (expanded && following && lines.length > 0) viewer.current?.scrollToItem?.(lines.length - 1);
  }, [expanded, following, lines, podLogs.revision]);

  return (
    <section aria-label={text.label} className="cluster-update-plugin__execution-logs">
      {condition?.status === 'False' && condition.reason !== 'Skipped' && (
        <Alert isInline variant="danger" title={text.failed}>
          {condition.message}
        </Alert>
      )}
      <ExpandableSection
        isExpanded={expanded}
        onToggle={(_event, value) => setExpanded(value)}
        toggleText={expanded ? text.hide : text.view}
      >
        <Content component="p" role="status" aria-live="polite">
          <Label isCompact>{source}</Label>{' '}
          {useCollector
            ? text.loaded
            : loading && lines.length === 0
              ? t('Loading logs...')
              : (!sandbox.pod || sandbox.missing) && !error
                ? streaming || waiting
                  ? text.waiting
                  : text.unavailable
                : connection}
          {loading && lines.length > 0 && ` — ${t('Loading logs...')}`}
        </Content>
        {useCollector && <Content component="p">{text.history}</Content>}
        {(error || retained.error) && (
          <Alert isInline variant="warning" title={text.partial}>
            {error || retained.error}
            <Button
              variant="link"
              onClick={() => {
                sandbox.retry();
                retained.retry();
                podLogs.retry();
              }}
            >
              {text.retry}
            </Button>
          </Alert>
        )}
        {!streaming && !waiting && !retained.loading && !retained.available && !retained.error && (
          <Content component="p">
            {t('Retained logs are not configured; using pod logs when available.')}
          </Content>
        )}
        {truncated && (
          <Content component="p">
            {t('Log output was truncated to viewer line or text limits.')}
          </Content>
        )}
        {!streaming && !waiting && !useCollector && !sandbox.pod?.sinceTime && (
          <Content component="p">{text.boundary}</Content>
        )}
        {expanded && (
          <LogViewer
            data={data || (loading ? t('Loading logs...') : text.empty)}
            innerRef={viewer}
            hasLineNumbers
            isTextWrapped
            height={280}
            onScroll={({ scrollOffsetToBottom, scrollUpdateWasRequested }) => {
              if (!scrollUpdateWasRequested) setFollowing(scrollOffsetToBottom < 1);
            }}
            toolbar={
              <Toolbar>
                <ToolbarContent>
                  <ToolbarItem>
                    <LogViewerSearch
                      aria-label={text.search}
                      placeholder={text.search}
                      nextNavigationButtonAriaLabel={t('Next matching log line')}
                      previousNavigationButtonAriaLabel={t('Previous matching log line')}
                      resetButtonLabel={t('Clear log search')}
                      resultsCountContext={` ${t('Matching log lines')}`}
                      minSearchChars={2}
                    />
                  </ToolbarItem>
                </ToolbarContent>
              </Toolbar>
            }
            footer={
              !following && streaming ? (
                <Button variant="link" onClick={() => setFollowing(true)}>
                  {t('Resume auto-scroll')}
                </Button>
              ) : undefined
            }
          />
        )}
      </ExpandableSection>
    </section>
  );
};

export const ExecutionLogs = ({ run }: { run: LightspeedAgenticRun }) => {
  const { identity } = useLogIdentity(run, 'execution');
  return <StepLogs key={identity} run={run} phase="execution" />;
};

export const AnalysisLogs = ({ run }: { run: LightspeedAgenticRun }) => {
  const { identity } = useLogIdentity(run, 'analysis');
  return <StepLogs key={identity} run={run} phase="analysis" />;
};

export const VerificationLogs = ({ run }: { run: LightspeedAgenticRun }) => {
  const { identity } = useLogIdentity(run, 'verification');
  return <StepLogs key={identity} run={run} phase="verification" />;
};
