import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18N_NAMESPACE, LIGHTSPEED_NAMESPACE } from '../utils/constants';
import { getLogHttpStatus, MAX_LOG_LINE_CHARS, MAX_LOG_TEXT_CHARS } from '../utils/logs';
import { LogPhase } from '../utils/logPhase';
import {
  buildServiceProxyBase,
  MAX_RETAINED_LOG_LINES,
  parseRetainedLogsPage,
  RETAINED_LOG_PAGE_LIMIT,
  retainedRecordToLine,
} from '../utils/retainedLogs';

export interface RetainedLogsResult {
  available: boolean;
  lines: string[];
  loading: boolean;
  error?: string;
  truncated: boolean;
  retry: () => void;
}

const emptyResult = { available: false, lines: [], loading: false, truncated: false };

class RetainedLogsError extends Error {}

export const useRetainedLogs = (
  runUid?: string,
  active?: boolean,
  phase: LogPhase = 'execution',
): RetainedLogsResult => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    runUid?: string;
    phase: LogPhase;
    attempt: number;
    result: Omit<RetainedLogsResult, 'retry'>;
  }>({ phase, attempt, result: emptyResult });
  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);

  useEffect(() => {
    if (!active || !runUid) {
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    const publish = (result: Omit<RetainedLogsResult, 'retry'>) => {
      if (!cancelled) {
        setState({ runUid, phase, attempt, result });
      }
    };
    const fetchLogs = async () => {
      let available = false;
      try {
        await Promise.resolve();
        if (cancelled) {
          return;
        }
        publish({ ...emptyResult, loading: true });
        const response = await consoleFetch(
          `/api/kubernetes/api/v1/namespaces/${encodeURIComponent(LIGHTSPEED_NAMESPACE)}` +
            '/configmaps/lightspeed-agentic-configuration',
          { signal: controller.signal },
        );
        if (cancelled) {
          return;
        }
        if (response.status === 404) {
          publish(emptyResult);
          return;
        }
        if (!response.ok) {
          throw new RetainedLogsError(
            t('Failed to discover retained logs (HTTP {{status}})', { status: response.status }),
          );
        }
        const config = await response.json();
        if (cancelled) {
          return;
        }
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
          throw new RetainedLogsError(t('Invalid retained log configuration'));
        }
        if (
          config.data !== undefined &&
          (!config.data || typeof config.data !== 'object' || Array.isArray(config.data))
        ) {
          throw new RetainedLogsError(t('Invalid retained log configuration'));
        }
        const endpoint = config.data?.['otel-admin-endpoint'];
        if (endpoint === undefined || endpoint === '') {
          publish(emptyResult);
          return;
        }
        const proxyBase =
          typeof endpoint === 'string' ? buildServiceProxyBase(endpoint) : undefined;
        if (!proxyBase) {
          throw new RetainedLogsError(t('Invalid OTEL admin endpoint'));
        }
        available = true;
        const lines: string[] = [];
        let characters = 0;
        let textTruncated = false;
        let after = 0;
        while (!cancelled) {
          const query = new URLSearchParams({
            agentic_run_id: runUid,
            phase,
            limit: String(RETAINED_LOG_PAGE_LIMIT),
          });
          if (after > 0) {
            query.set('after', String(after));
          }
          const logsResponse = await consoleFetch(`${proxyBase}/api/v1/logs?${query.toString()}`, {
            signal: controller.signal,
          });
          if (cancelled) {
            return;
          }
          if (!logsResponse.ok) {
            throw new RetainedLogsError(
              t('Failed to fetch retained logs (HTTP {{status}})', { status: logsResponse.status }),
            );
          }
          const data: unknown = await logsResponse.json();
          if (cancelled) {
            return;
          }
          const page = parseRetainedLogsPage(data, runUid, after, phase);
          if (!page) {
            throw new RetainedLogsError(t('Invalid retained log response or pagination cursor'));
          }
          let consumed = 0;
          for (const record of page.records) {
            const raw = retainedRecordToLine(record);
            const line = raw.slice(0, MAX_LOG_LINE_CHARS);
            const cost = line.length + (lines.length > 0 ? 1 : 0);
            textTruncated ||= line.length < raw.length;
            if (lines.length >= MAX_RETAINED_LOG_LINES || characters + cost > MAX_LOG_TEXT_CHARS) {
              textTruncated = true;
              break;
            }
            lines.push(line);
            characters += cost;
            consumed++;
          }
          if (
            !page.has_more ||
            lines.length >= MAX_RETAINED_LOG_LINES ||
            consumed < page.records.length ||
            characters >= MAX_LOG_TEXT_CHARS
          ) {
            publish({
              available,
              lines,
              loading: false,
              truncated: textTruncated || consumed < page.records.length || page.has_more,
            });
            return;
          }
          after = page.records[page.records.length - 1].id;
        }
      } catch (error) {
        const status = getLogHttpStatus(error);
        if (!available && status === 404) {
          publish(emptyResult);
          return;
        }
        publish({
          ...emptyResult,
          available,
          error:
            error instanceof RetainedLogsError
              ? error.message
              : status
                ? t('Failed to load retained logs (HTTP {{status}})', { status })
                : t('Failed to load retained logs'),
        });
      }
    };
    fetchLogs();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, runUid, phase, attempt, t]);

  const current =
    active && runUid
      ? state.runUid === runUid && state.phase === phase && state.attempt === attempt
        ? state.result
        : { ...emptyResult, loading: true }
      : emptyResult;
  return { ...current, retry };
};
