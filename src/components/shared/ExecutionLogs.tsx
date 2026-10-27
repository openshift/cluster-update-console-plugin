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
  const error = useCollector
    ? undefined
    : sandbox.error
      ? analysis
        ? t('Failed to resolve analysis sandbox: {{detail}}', { detail: sandbox.error })
        : t('Failed to resolve execution sandbox: {{detail}}', { detail: sandbox.error })
      : podLogs.error;
  const source = useCollector
    ? analysis
      ? t('Retained analysis history')
      : t('Retained execution history')
    : analysis
      ? t('Pod analysis logs')
      : t('Pod execution logs');
  const loaded = analysis ? t('Analysis logs loaded') : t('Execution logs loaded');
  const connection = {
    idle: analysis ? t('Waiting for analysis logs') : t('Waiting for execution logs'),
    connecting: analysis ? t('Connecting to analysis logs') : t('Connecting to execution logs'),
    streaming: analysis ? t('Streaming analysis logs') : t('Streaming execution logs'),
    reconnecting: analysis
      ? t('Reconnecting to analysis logs')
      : t('Reconnecting to execution logs'),
    complete: loaded,
    error: analysis ? t('Analysis log connection failed') : t('Execution log connection failed'),
  }[podLogs.state];

  useEffect(() => {
    if (expanded && following && lines.length > 0) viewer.current?.scrollToItem?.(lines.length - 1);
  }, [expanded, following, lines, podLogs.revision]);

  return (
    <section
      aria-label={analysis ? t('Analysis') : t('Execution')}
      className="cluster-update-plugin__execution-logs"
    >
      {condition?.reason !== 'Skipped' && condition?.status === 'True' && (
        <Alert
          isInline
          variant="success"
          title={
            analysis
              ? t('Analysis completed; see run status for subsequent stages')
              : t('Execution completed; see run status for verification')
          }
        />
      )}
      {condition?.status === 'False' && condition.reason !== 'Skipped' && (
        <Alert
          isInline
          variant="danger"
          title={analysis ? t('Analysis failed') : t('Execution failed')}
        >
          {condition.message}
        </Alert>
      )}
      <ExpandableSection
        isExpanded={expanded}
        onToggle={(_event, value) => setExpanded(value)}
        toggleText={
          expanded
            ? analysis
              ? t('Hide analysis logs')
              : t('Hide execution logs')
            : analysis
              ? t('View analysis logs')
              : t('View execution logs')
        }
      >
        <Content component="p" role="status" aria-live="polite">
          <Label isCompact>{source}</Label>{' '}
          {useCollector
            ? loaded
            : loading && lines.length === 0
              ? t('Loading logs...')
              : (!sandbox.pod || sandbox.missing) && !error
                ? streaming || waiting
                  ? analysis
                    ? t('Waiting for analysis sandbox')
                    : t('Waiting for execution sandbox')
                  : analysis
                    ? t('Analysis pod is unavailable')
                    : t('Execution pod is unavailable')
                : connection}
          {loading && lines.length > 0 && ` — ${t('Loading logs...')}`}
        </Content>
        {useCollector && (
          <Content component="p">
            {analysis
              ? t('Retained history includes all analysis attempts for this run.')
              : t('Retained history includes all execution attempts for this run.')}
          </Content>
        )}
        {(error || retained.error) && (
          <Alert
            isInline
            variant="warning"
            title={
              analysis
                ? t('Some analysis logs could not be loaded')
                : t('Some execution logs could not be loaded')
            }
          >
            {error || retained.error}
            <Button
              variant="link"
              onClick={() => {
                sandbox.retry();
                retained.retry();
                podLogs.retry();
              }}
            >
              {analysis ? t('Retry analysis logs') : t('Retry execution logs')}
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
          <Content component="p">
            {analysis
              ? t(
                  'Without an analysis-start timestamp, pod history is limited to the latest 500 lines.',
                )
              : t(
                  'Without an execution-start timestamp, pod history is limited to the latest 500 lines.',
                )}
          </Content>
        )}
        <LogViewer
          data={
            data ||
            (loading
              ? t('Loading logs...')
              : analysis
                ? t('No analysis logs available.')
                : t('No execution logs available.'))
          }
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
                    aria-label={analysis ? t('Search analysis logs') : t('Search execution logs')}
                    placeholder={analysis ? t('Search analysis logs') : t('Search execution logs')}
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
