import { useCallback, useEffect, useRef, useState } from 'react';
import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import { useTranslation } from 'react-i18next';
import { I18N_NAMESPACE } from '../utils/constants';
import {
  boundLogLines,
  getLogHttpStatus,
  MAX_LOG_LINES,
  MAX_LOG_LINE_CHARS,
  MAX_LOG_TEXT_CHARS,
} from '../utils/logs';
import { buildPodLogUrl } from '../utils/pod';

export interface SandboxView {
  namespace: string;
  podName: string;
  podUid?: string;
  container?: string;
}

export type SandboxLogStreamState =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'reconnecting'
  | 'complete'
  | 'error';

interface LogResult {
  lines: string[];
  loading: boolean;
  error?: string;
  state: SandboxLogStreamState;
  truncated: boolean;
}

const EMPTY_RESULT: LogResult = {
  lines: [],
  loading: false,
  state: 'idle',
  truncated: false,
};
const MAX_FAILURES = 5;
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})(?:\s|$)/;

const timestampOf = (line: string): { value: string; key: string } | undefined => {
  const match = line.match(TIMESTAMP);
  if (!match) {
    return undefined;
  }
  const seconds = Date.parse(`${match[1]}${match[3]}`);
  if (!Number.isFinite(seconds)) {
    return undefined;
  }
  return {
    value: `${match[1]}${match[2] ? `.${match[2]}` : ''}${match[3]}`,
    key: `${seconds}:${(match[2] ?? '').replace(/0+$/, '')}`,
  };
};

class LogRequestError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

export const useSandboxLogStream = (
  sandbox?: SandboxView,
  active?: boolean,
  streaming?: boolean,
  sinceTime?: string,
): LogResult & { retry: () => void; revision: number } => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const namespace = sandbox?.namespace;
  const podName = sandbox?.podName;
  const podUid = sandbox?.podUid;
  const container = sandbox?.container;
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((previous) => previous + 1), []);
  const identity = JSON.stringify([namespace, podName, podUid, container, sinceTime]);
  const [result, setResult] = useState<LogResult & { identity?: string }>(EMPTY_RESULT);
  const cursor = useRef<{
    identity: string;
    timestamp?: string;
    boundaryKey?: string;
    counts: Map<string, number>;
    characters: number;
  }>();

  useEffect(() => {
    if (cursor.current?.identity !== identity) {
      cursor.current = { identity, timestamp: sinceTime, counts: new Map(), characters: 0 };
    }
    if (!active || !namespace || !podName) {
      setResult((previous) => ({
        ...(previous.identity === identity ? previous : EMPTY_RESULT),
        identity,
        loading: false,
        state: 'idle',
        error: undefined,
      }));
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let cancelDelay: (() => void) | undefined;
    const currentCursor = cursor.current;
    const responseError = (status: number): LogRequestError =>
      new LogRequestError(
        t('Unable to load pod logs (HTTP {{status}}).', { status }),
        status === 408 || status === 429 || status >= 500,
      );
    let lastTimestamp = currentCursor.timestamp;
    let boundaryKey = currentCursor.boundaryKey;
    const boundaryCounts = currentCursor.counts;
    let boundaryCharacters = currentCursor.characters;
    let failures = 0;
    let delay = 1000;
    const update = (change: Partial<LogResult>) => {
      if (!cancelled) {
        setResult((previous) => ({
          ...(previous.identity === identity ? previous : EMPTY_RESULT),
          ...change,
          identity,
        }));
      }
    };

    update({ loading: true, state: 'connecting', error: undefined });

    const readLogs = async () => {
      while (!cancelled) {
        let receivedData = false;
        const replayCounts = new Map(streaming ? boundaryCounts : []);
        const resumeKey = streaming ? boundaryKey : undefined;
        let replaceSnapshot = !streaming;
        const parameters: Record<string, string> = { timestamps: 'true' };
        if (streaming) {
          parameters.follow = 'true';
        }
        const requestSince = streaming ? lastTimestamp : sinceTime;
        if (requestSince) {
          parameters.sinceTime = requestSince;
        } else if (!streaming) {
          parameters.tailLines = '500';
        }
        if (container) {
          parameters.container = container;
        }

        const append = (parts: string[]) => {
          const additions: string[] = [];
          let cursorTruncated = false;
          if (replaceSnapshot && parts.some(Boolean)) {
            boundaryCounts.clear();
            boundaryCharacters = 0;
            currentCursor.characters = 0;
            boundaryKey = undefined;
            currentCursor.timestamp = sinceTime;
            currentCursor.boundaryKey = undefined;
          }
          for (const line of parts) {
            if (!line) {
              continue;
            }
            const timestamp = timestampOf(line);
            if (timestamp) {
              const remaining = replayCounts.get(line) ?? 0;
              if (timestamp.key === resumeKey && remaining > 0) {
                replayCounts.set(line, remaining - 1);
                continue;
              }
              if (timestamp.key !== boundaryKey) {
                boundaryCounts.clear();
                boundaryCharacters = 0;
                boundaryKey = timestamp.key;
              }
              lastTimestamp = timestamp.value;
              currentCursor.timestamp = lastTimestamp;
              currentCursor.boundaryKey = boundaryKey;
              if (!boundaryCounts.has(line)) {
                while (
                  boundaryCounts.size >= MAX_LOG_LINES ||
                  boundaryCharacters + line.length + 1 > MAX_LOG_TEXT_CHARS
                ) {
                  const oldest = boundaryCounts.keys().next().value;
                  if (oldest === undefined) {
                    break;
                  }
                  boundaryCounts.delete(oldest);
                  boundaryCharacters -= oldest.length + 1;
                  cursorTruncated = true;
                }
                boundaryCharacters += line.length + 1;
              }
              boundaryCounts.set(line, (boundaryCounts.get(line) ?? 0) + 1);
              currentCursor.characters = boundaryCharacters;
            }
            additions.push(line);
          }
          if (!cancelled && additions.length) {
            receivedData = true;
            const replace = replaceSnapshot;
            replaceSnapshot = false;
            setResult((previous) => {
              const combined = [...(replace ? [] : previous.lines), ...additions];
              const bounded = boundLogLines(combined);
              return {
                identity,
                lines: bounded.lines,
                loading: false,
                error: undefined,
                state: streaming ? 'streaming' : 'connecting',
                truncated:
                  (!replace && previous.truncated) ||
                  bounded.truncated ||
                  cursorTruncated ||
                  (!streaming && !sinceTime && combined.length >= 500),
              };
            });
          }
        };

        try {
          const response = await consoleFetch(buildPodLogUrl(namespace, podName, parameters), {
            signal: controller.signal,
          });
          if (cancelled) {
            await response.body?.cancel();
            return;
          }
          if (!response.ok) {
            await response.body?.cancel().catch(() => undefined);
            throw responseError(response.status);
          }
          if (!response.body) {
            throw new LogRequestError(t('The pod log response has no readable body.'), true);
          }
          reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (!cancelled) {
            const { done, value } = await reader.read();
            if (cancelled) {
              return;
            }
            if (value?.byteLength) {
              update({
                loading: false,
                error: undefined,
                state: streaming ? 'streaming' : 'connecting',
              });
            }
            const decoded = done ? decoder.decode() : decoder.decode(value, { stream: true });
            const parts: string[] = [];
            let offset = 0;
            while (offset < decoded.length) {
              const newline = decoded.indexOf('\n', offset);
              const end = newline < 0 ? decoded.length : newline;
              if (buffer.length + end - offset > MAX_LOG_LINE_CHARS) {
                append(parts);
                update({ truncated: true });
                controller.abort();
                throw new LogRequestError(
                  t(
                    'Pod log line exceeds the {{limit}} character limit. Reduce the log line size and retry.',
                    { limit: MAX_LOG_LINE_CHARS },
                  ),
                  false,
                );
              }
              buffer += decoded.slice(offset, end);
              if (newline < 0) {
                break;
              }
              parts.push(buffer);
              buffer = '';
              offset = newline + 1;
            }
            append(parts);
            if (done) {
              append(buffer ? [buffer] : []);
              break;
            }
          }
          if (cancelled) {
            return;
          }
          if (!streaming) {
            if (!receivedData) {
              update({ lines: [], truncated: false });
              boundaryCounts.clear();
              currentCursor.characters = 0;
              currentCursor.timestamp = sinceTime;
              currentCursor.boundaryKey = undefined;
            }
            update({ loading: false, error: undefined, state: 'complete' });
            return;
          }
          failures = 0;
          update({ loading: false, error: undefined, state: 'reconnecting' });
        } catch (caught) {
          if (cancelled) {
            return;
          }
          const status = getLogHttpStatus(caught);
          const failure =
            caught instanceof LogRequestError
              ? caught
              : typeof status === 'number'
                ? responseError(status)
                : new LogRequestError(t('Unable to connect to pod logs.'), true);
          failures = receivedData ? 1 : failures + 1;
          const retrying = streaming && failure.retryable && failures < MAX_FAILURES;
          update({
            loading: false,
            error: failure.message,
            state: retrying ? 'reconnecting' : 'error',
          });
          if (!retrying) {
            return;
          }
        } finally {
          if (reader) {
            await reader.cancel().catch(() => undefined);
            reader.releaseLock();
            reader = undefined;
          }
        }

        if (cancelled) {
          return;
        }
        if (receivedData) {
          delay = 1000;
        }
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delay);
          cancelDelay = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        cancelDelay = undefined;
        delay = Math.min(delay * 2, 15000);
      }
    };

    void readLogs();

    return () => {
      cancelled = true;
      controller.abort();
      void reader?.cancel().catch(() => undefined);
      cancelDelay?.();
    };
  }, [active, namespace, podName, podUid, container, streaming, sinceTime, revision, identity, t]);

  const { lines, loading, error, state, truncated } =
    result.identity === identity ? result : EMPTY_RESULT;
  return { lines, loading, error, state, truncated, retry, revision };
};
