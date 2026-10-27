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
import { LightspeedAgenticRun, derivePhase } from '../../models/agenticrun';
import { useExecutionSandbox } from '../../hooks/useExecutionSandbox';
import { useSandboxLogStream } from '../../hooks/useSandboxLogStream';
import { useRetainedLogs } from '../../hooks/useRetainedLogs';
import { I18N_NAMESPACE } from '../../utils/constants';
import './ExecutionLogs.css';

export const ExecutionLogs = ({ run }: { run: LightspeedAgenticRun }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [expanded, setExpanded] = useState(false);
  const [following, setFollowing] = useState(true);
  const viewer = useRef<{ scrollToItem?: (index: number) => void }>(null);
  const streaming = derivePhase(run) === 'Executing';
  const retained = useRetainedLogs(run.metadata?.uid, expanded && !streaming, 'execution');
  const useCollector =
    !streaming && !retained.error && retained.available && retained.lines.length > 0;
  const sandbox = useExecutionSandbox(run, expanded && !useCollector && !retained.loading);
  const podLogs = useSandboxLogStream(
    sandbox.pod,
    expanded && !useCollector && !retained.loading && !!sandbox.pod && !sandbox.missing,
    streaming,
    sandbox.pod?.sinceTime,
  );
  const lines = useCollector ? retained.lines : podLogs.lines;
  const data = useMemo(() => lines.join('\n'), [lines]);
  const loading = expanded && (retained.loading || sandbox.loading || podLogs.loading);
  const executed = run.status?.conditions?.find((condition) => condition.type === 'Executed');
  const truncated = useCollector ? retained.truncated : podLogs.truncated;
  const error = useCollector
    ? undefined
    : sandbox.error
      ? t('Failed to resolve execution sandbox: {{detail}}', { detail: sandbox.error })
      : podLogs.error;
  const source = useCollector ? t('Retained execution history') : t('Pod execution logs');
  const connection = {
    idle: t('Waiting for execution logs'),
    connecting: t('Connecting to execution logs'),
    streaming: t('Streaming execution logs'),
    reconnecting: t('Reconnecting to execution logs'),
    complete: t('Execution logs loaded'),
    error: t('Execution log connection failed'),
  }[podLogs.state];

  useEffect(() => {
    if (expanded && following && lines.length > 0) viewer.current?.scrollToItem?.(lines.length - 1);
  }, [expanded, following, lines, podLogs.revision]);

  return (
    <section aria-label={t('Execution')} className="cluster-update-plugin__execution-logs">
      {executed?.reason !== 'Skipped' && executed?.status === 'True' && (
        <Alert
          isInline
          variant="success"
          title={t('Execution completed; see run status for verification')}
        />
      )}
      {executed?.status === 'False' && executed.reason !== 'Skipped' && (
        <Alert isInline variant="danger" title={t('Execution failed')}>
          {executed.message}
        </Alert>
      )}
      <ExpandableSection
        isExpanded={expanded}
        onToggle={(_event, value) => setExpanded(value)}
        toggleText={expanded ? t('Hide execution logs') : t('View execution logs')}
      >
        <Content component="p" role="status" aria-live="polite">
          <Label isCompact>{source}</Label>{' '}
          {useCollector
            ? t('Execution logs loaded')
            : loading && lines.length === 0
              ? t('Loading logs...')
              : (!sandbox.pod || sandbox.missing) && !error
                ? streaming
                  ? t('Waiting for execution sandbox')
                  : t('Execution pod is unavailable')
                : connection}
          {loading && lines.length > 0 && ` — ${t('Loading logs...')}`}
        </Content>
        {useCollector && (
          <Content component="p">
            {t('Retained history includes all execution attempts for this run.')}
          </Content>
        )}
        {(error || retained.error) && (
          <Alert isInline variant="warning" title={t('Some execution logs could not be loaded')}>
            {error || retained.error}
            <Button
              variant="link"
              onClick={() => {
                sandbox.retry();
                retained.retry();
                podLogs.retry();
              }}
            >
              {t('Retry execution logs')}
            </Button>
          </Alert>
        )}
        {!streaming && !retained.loading && !retained.available && !retained.error && (
          <Content component="p">
            {t('Retained logs are not configured; using pod logs when available.')}
          </Content>
        )}
        {truncated && (
          <Content component="p">
            {t('Log output was truncated to viewer line or text limits.')}
          </Content>
        )}
        {!streaming && !useCollector && !sandbox.pod?.sinceTime && (
          <Content component="p">
            {t(
              'Without an execution-start timestamp, pod history is limited to the latest 500 lines.',
            )}
          </Content>
        )}
        <LogViewer
          data={data || (loading ? t('Loading logs...') : t('No execution logs available.'))}
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
                    aria-label={t('Search execution logs')}
                    placeholder={t('Search execution logs')}
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
