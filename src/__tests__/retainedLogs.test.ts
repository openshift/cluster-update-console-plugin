import { describe, expect, it } from '@jest/globals';
import {
  buildServiceProxyBase,
  parseRetainedLogsPage,
  retainedRecordToLine,
  RetainedLogRecord,
  RETAINED_LOG_PAGE_LIMIT,
} from '../utils/retainedLogs';

const record: RetainedLogRecord = {
  id: 1,
  timestamp: '2026-10-27T10:00:00Z',
  event: 'log',
  phase: 'execution',
  body: { msg: 'Executing update' },
};
const page = { agentic_run_id: 'run-uid', has_more: false, records: [record] };

describe('buildServiceProxyBase', () => {
  it.each([
    ['http://collector.logs.svc:8080', 'http:collector:8080'],
    ['https://collector.logs.svc.cluster.local:8443/', 'https:collector:8443'],
    ['http://collector.logs', 'http:collector:8080'],
    ['https://collector.logs.svc.', 'https:collector:8080'],
    ['http://collector.logs.svc:80', 'http:collector:80'],
    ['https://collector.logs.svc:443', 'https:collector:443'],
  ])('preserves protocol and port for %s', (endpoint, target) => {
    expect(buildServiceProxyBase(endpoint)).toBe(
      `/api/kubernetes/api/v1/namespaces/logs/services/${target}/proxy`,
    );
  });

  it.each([
    'not a URL',
    'ftp://collector.logs.svc:8080',
    'https://example.com/external',
    'https://collector.logs.svc.evil.example',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://[::1]:8080',
    'http://user:password@collector.logs.svc',
    'http://collector.logs.svc?query=1',
    'http://collector.logs.svc#fragment',
    'http://invalid_label.logs.svc',
    'http://collector.logs.svc:0',
  ])('rejects unsupported endpoint %s', (endpoint) => {
    expect(buildServiceProxyBase(endpoint)).toBeUndefined();
  });
});

describe('parseRetainedLogsPage', () => {
  it('accepts empty success and valid advancing records', () => {
    expect(parseRetainedLogsPage({ ...page, records: [] }, 'run-uid')).toBeDefined();
    expect(parseRetainedLogsPage(page, 'run-uid')).toEqual(page);
    expect(parseRetainedLogsPage(page, 'run-uid', 1)).toBeUndefined();
  });

  it.each([
    null,
    [],
    {},
    { ...page, agentic_run_id: 'other-run' },
    { ...page, has_more: 'false' },
    { ...page, has_more: true, records: [] },
    { ...page, records: {} },
    { ...page, records: [null] },
    { ...page, records: [{ ...record, id: 0 }] },
    { ...page, records: [{ ...record, id: 1.5 }] },
    { ...page, records: [{ ...record, id: Number.MAX_SAFE_INTEGER + 1 }] },
    { ...page, records: [record, record] },
    { ...page, records: [{ ...record, timestamp: null }] },
    { ...page, records: [{ ...record, event: 1 }] },
    { ...page, records: [{ ...record, phase: 'analysis' }] },
    { ...page, records: [{ ...record, body: undefined }] },
    { ...page, records: Array(RETAINED_LOG_PAGE_LIMIT + 1).fill(record) },
  ])('rejects malformed, mis-scoped or nonadvancing data %#', (value) => {
    expect(parseRetainedLogsPage(value, 'run-uid')).toBeUndefined();
  });

  it('rejects descending IDs within a page', () => {
    expect(
      parseRetainedLogsPage({ ...page, records: [{ ...record, id: 2 }, record] }, 'run-uid'),
    ).toBeUndefined();
  });
});

describe('retainedRecordToLine', () => {
  it.each([
    [{ msg: 'hello' }, 'hello'],
    [{ msg: { nested: true } }, '{"nested":true}'],
    [{ value: 3 }, '{"value":3}'],
    ['message', '"message"'],
    [null, 'null'],
  ])('formats event, timestamp and body %j', (body, expected) => {
    expect(retainedRecordToLine({ ...record, body })).toBe(`${record.timestamp} [log] ${expected}`);
  });
});
