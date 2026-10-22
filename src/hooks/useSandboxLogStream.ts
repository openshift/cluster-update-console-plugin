import { useCallback, useEffect, useRef, useState } from 'react';
import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import { buildPodLogUrl } from '../utils/pod';

const MAX_RAW_LINES = 20000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;
const RFC3339_TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)/;

export interface SandboxView {
  podName: string;
  namespace: string;
}

interface SandboxLogStreamResult {
  lines: string[];
  loading: boolean;
  error?: string;
}

const appendLines = (prev: string[], newLines: string[]): string[] => {
  const next = [...prev, ...newLines];
  return next.length > MAX_RAW_LINES ? next.slice(-MAX_RAW_LINES) : next;
};

export const useSandboxLogStream = (
  sandbox?: SandboxView,
  active?: boolean,
  streaming?: boolean,
  sinceTime?: string,
): SandboxLogStreamResult => {
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const lines = rawLines;

  const podName = sandbox?.podName;
  const namespace = sandbox?.namespace;

  const doFetch = useCallback(
    (signal: { cancelled: boolean }) => {
      if (!podName || !namespace) {
        return;
      }

      const buildUrl = (overrideSinceTime?: string) => {
        const urlParams: Record<string, string> = { timestamps: 'true' };
        if (streaming) {
          urlParams.follow = 'true';
          const ts = overrideSinceTime ?? sinceTime;
          if (ts) {
            urlParams.sinceTime = ts;
          }
        } else if (sinceTime) {
          urlParams.sinceTime = sinceTime;
        } else {
          urlParams.tailLines = '500';
        }
        return buildPodLogUrl(namespace, podName, urlParams);
      };

      const handleError = (err: unknown) => {
        if (signal.cancelled) {
          return;
        }
        const msg = (err as Error)?.message;
        if (msg === 'The user aborted a request.') {
          return;
        }
        setError(msg || 'Failed to load logs');
        setLoading(false);
      };

      const fetchAc = new AbortController();
      abortRef.current = fetchAc;

      if (streaming) {
        const streamWithReconnect = async () => {
          let delay = RECONNECT_BASE_MS;
          let lastTimestamp = sinceTime;
          let lastLine: string | undefined;

          while (!signal.cancelled) {
            let receivedData = false;
            try {
              setError(undefined);
              const url = buildUrl(lastTimestamp);
              const response = await consoleFetch(url, { signal: fetchAc.signal });

              if (signal.cancelled || !response.body) {
                response.body?.cancel();
                break;
              }

              const reader = response.body.getReader();
              readerRef.current = reader;
              const decoder = new TextDecoder();
              let buffer = '';
              let skipUntilNew = !!lastLine;

              while (true) {
                const { done, value } = await reader.read();
                if (done || signal.cancelled) {
                  break;
                }

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n');
                buffer = parts.pop() ?? '';

                let startIdx = 0;
                if (skipUntilNew) {
                  for (let i = 0; i < parts.length; i++) {
                    if (parts[i] === lastLine) {
                      startIdx = i + 1;
                      skipUntilNew = false;
                      break;
                    }
                  }
                  if (skipUntilNew) {
                    skipUntilNew = false;
                    startIdx = 0;
                  }
                }

                const newParts = startIdx > 0 ? parts.slice(startIdx) : parts;

                for (let i = newParts.length - 1; i >= 0; i--) {
                  const tsMatch = newParts[i].match(RFC3339_TIMESTAMP_RE);
                  if (tsMatch) {
                    lastTimestamp = tsMatch[1];
                    break;
                  }
                }

                if (newParts.length > 0) {
                  lastLine = newParts[newParts.length - 1];
                }

                const nonEmpty = newParts.filter(Boolean);
                if (nonEmpty.length > 0) {
                  receivedData = true;
                  setRawLines((prev) => appendLines(prev, nonEmpty));
                }
              }

              if (buffer && !signal.cancelled) {
                lastLine = buffer;
                receivedData = true;
                setRawLines((prev) => appendLines(prev, [buffer]));
              }

              readerRef.current = null;

              if (signal.cancelled) {
                break;
              }
              if (receivedData) {
                delay = RECONNECT_BASE_MS;
              }
            } catch {
              if (signal.cancelled) {
                break;
              }
              readerRef.current = null;
            }

            const delayAc = new AbortController();
            abortRef.current = delayAc;
            await new Promise<void>((resolve) => {
              const timer = setTimeout(resolve, delay);
              delayAc.signal.addEventListener(
                'abort',
                () => {
                  clearTimeout(timer);
                  resolve();
                },
                { once: true },
              );
            });
            abortRef.current = fetchAc;

            if (signal.cancelled) {
              break;
            }
            delay = Math.min(delay * 2, RECONNECT_MAX_MS);
          }

          if (!signal.cancelled) {
            setLoading(false);
          }
        };

        streamWithReconnect();
      } else {
        consoleFetch(buildUrl(), { signal: fetchAc.signal })
          .then(async (response) => {
            if (signal.cancelled) {
              return;
            }
            const text = await response.text();
            const allLines = text.split('\n').filter(Boolean);
            setRawLines(
              allLines.length > MAX_RAW_LINES ? allLines.slice(-MAX_RAW_LINES) : allLines,
            );
          })
          .catch(handleError)
          .finally(() => {
            if (!signal.cancelled) {
              setLoading(false);
            }
          });
      }
    },
    [podName, namespace, streaming, sinceTime],
  );

  useEffect(() => {
    if (!active || !podName || !namespace) {
      return;
    }

    const signal = { cancelled: false };
    setLoading(true);
    setRawLines([]);
    setError(undefined);
    doFetch(signal);

    return () => {
      signal.cancelled = true;
      abortRef.current?.abort();
      if (readerRef.current) {
        readerRef.current.cancel().catch(() => {});
        readerRef.current = null;
      }
    };
  }, [active, podName, namespace, doFetch]);

  return { lines, loading, error };
};
