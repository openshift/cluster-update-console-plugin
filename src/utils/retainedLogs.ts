import { MAX_LOG_LINES } from './logs';
import { LogPhase } from './logPhase';

export const RETAINED_LOG_PAGE_LIMIT = 1000;
export const MAX_RETAINED_LOG_LINES = MAX_LOG_LINES;

export interface RetainedLogRecord {
  id: number;
  timestamp: string;
  event: string;
  phase: LogPhase;
  body: unknown;
}

export interface RetainedLogsPage {
  agentic_run_id: string;
  has_more: boolean;
  records: RetainedLogRecord[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const buildServiceProxyBase = (endpoint: string): string | undefined => {
  try {
    const url = new URL(endpoint);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    const labels = url.hostname.replace(/\.$/, '').split('.');
    const [service, namespace, ...suffix] = labels;
    const dnsLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
    if (
      !service ||
      !namespace ||
      !dnsLabel.test(service) ||
      !dnsLabel.test(namespace) ||
      !['', 'svc', 'svc.cluster.local'].includes(suffix.join('.'))
    ) {
      return undefined;
    }
    const protocol = url.protocol.slice(0, -1);
    const explicitPort = endpoint.trim().match(/^https?:\/\/[^/?#]+:(\d+)(?:[/?#]|$)/i)?.[1];
    const port = url.port || (explicitPort ? String(Number(explicitPort)) : '8080');
    if (Number(port) < 1 || Number(port) > 65535) {
      return undefined;
    }
    return (
      `/api/kubernetes/api/v1/namespaces/${encodeURIComponent(namespace)}` +
      `/services/${protocol}:${encodeURIComponent(service)}:${port}/proxy`
    );
  } catch {
    return undefined;
  }
};

export const parseRetainedLogsPage = (
  value: unknown,
  runUid: string,
  after = 0,
  phase: LogPhase = 'execution',
): RetainedLogsPage | undefined => {
  if (
    !isObject(value) ||
    value.agentic_run_id !== runUid ||
    typeof value.has_more !== 'boolean' ||
    !Array.isArray(value.records) ||
    value.records.length > RETAINED_LOG_PAGE_LIMIT ||
    (value.has_more && value.records.length === 0)
  ) {
    return undefined;
  }
  let previousId = after;
  for (const record of value.records) {
    if (
      !isObject(record) ||
      !Number.isSafeInteger(record.id) ||
      (record.id as number) <= previousId ||
      typeof record.timestamp !== 'string' ||
      !record.timestamp ||
      typeof record.event !== 'string' ||
      record.phase !== phase ||
      !Object.prototype.hasOwnProperty.call(record, 'body') ||
      record.body === undefined
    ) {
      return undefined;
    }
    previousId = record.id as number;
  }
  return value as unknown as RetainedLogsPage;
};

export const retainedRecordToLine = (record: RetainedLogRecord): string => {
  const message = isObject(record.body) ? record.body.msg : undefined;
  const body = typeof message === 'string' ? message : JSON.stringify(message ?? record.body);
  return `${record.timestamp} [${record.event}] ${body}`;
};
