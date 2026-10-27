/** @jest-environment jsdom */
import { beforeEach, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';
import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import { useRetainedLogs } from '../hooks/useRetainedLogs';
import { MAX_RETAINED_LOG_LINES } from '../utils/retainedLogs';
import { MAX_LOG_LINE_CHARS, MAX_LOG_TEXT_CHARS } from '../utils/logs';

jest.mock('react-i18next', () => {
  const translate = (message: string, values?: Record<string, unknown>) =>
    message.replace(/{{(\w+)}}/g, (_match, key: string) => String(values?.[key]));
  return { useTranslation: () => ({ t: translate }) };
});

const fetchMock = jest.mocked(consoleFetch);
const response = (data: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn<() => Promise<unknown>>().mockResolvedValue(data),
  }) as unknown as Response;
const config = (endpoint: unknown = 'http://collector.logs.svc:8080') =>
  response({ data: { 'otel-admin-endpoint': endpoint } });
const record = (id: number) => ({
  id,
  timestamp: '2026-10-27T10:00:00Z',
  event: 'log',
  phase: 'execution',
  body: { msg: `line ${id}` },
});
const page = (ids: number[], hasMore = false, uid = 'run-uid') =>
  response({ agentic_run_id: uid, has_more: hasMore, records: ids.map(record) });

beforeEach(() => {
  fetchMock.mockReset();
});

it.each([404, 403])('classifies response-only SDK discovery HTTP %s', async (status) => {
  fetchMock.mockRejectedValueOnce({ response: { status } });
  const { result } = renderHook(() => useRetainedLogs('run-uid', true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  if (status === 404) expect(result.current.error).toBeUndefined();
  else expect(result.current.error).toContain('HTTP 403');
  expect(result.current.available).toBe(false);
});

it('truncates oversized retained lines and discloses width limits', async () => {
  fetchMock.mockResolvedValueOnce(config()).mockResolvedValueOnce(
    response({
      agentic_run_id: 'run-uid',
      has_more: false,
      records: [{ ...record(1), body: { msg: 'x'.repeat(MAX_LOG_LINE_CHARS + 100) } }],
    }),
  );
  const { result } = renderHook(() => useRetainedLogs('run-uid', true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.lines[0]).toHaveLength(MAX_LOG_LINE_CHARS);
  expect(result.current.truncated).toBe(true);
  expect(result.current.error).toBeUndefined();
});

it('stops fetching after the aggregate saved-text budget is reached', async () => {
  fetchMock.mockResolvedValueOnce(config()).mockResolvedValueOnce(
    response({
      agentic_run_id: 'run-uid',
      has_more: true,
      records: Array.from({ length: 100 }, (_value, index) => ({
        ...record(index + 1),
        body: { msg: 'x'.repeat(MAX_LOG_LINE_CHARS) },
      })),
    }),
  );
  const { result } = renderHook(() => useRetainedLogs('run-uid', true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.lines.join('\n').length).toBeLessThanOrEqual(MAX_LOG_TEXT_CHARS);
  expect(result.current.lines.length).toBeGreaterThan(0);
  expect(result.current.truncated).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('does not probe without an active viewer and UID', async () => {
  const { result, rerender } = renderHook(({ uid, active }) => useRetainedLogs(uid, active), {
    initialProps: { uid: 'run-uid' as string | undefined, active: false },
  });
  expect(result.current.loading).toBe(false);
  rerender({ uid: undefined, active: true });
  await act(async () => {});
  expect(result.current.loading).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([response({}, 404), response({}), response({ data: {} }), config('')])(
  'settles missing optional configuration without error %#',
  async (configuration) => {
    fetchMock.mockResolvedValueOnce(configuration);
    const { result } = renderHook(() => useRetainedLogs('run-uid', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ available: false, lines: [] });
    expect(result.current.error).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/kubernetes/api/v1/namespaces/openshift-lightspeed/configmaps/lightspeed-agentic-configuration',
    );
  },
);

it('settles successful empty collector data for pod fallback', async () => {
  fetchMock.mockResolvedValueOnce(config()).mockResolvedValueOnce(page([]));
  const { result } = renderHook(() => useRetainedLogs('run-uid', true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current).toMatchObject({ available: true, lines: [], truncated: false });
  expect(result.current.error).toBeUndefined();
});

it('retrieves all pages with UID, execution phase, limit and advancing cursor', async () => {
  fetchMock
    .mockResolvedValueOnce(config('https://collector.logs.svc:8443'))
    .mockResolvedValueOnce(page([2, 5], true, 'uid /&'))
    .mockResolvedValueOnce(page([8], false, 'uid /&'));
  const { result } = renderHook(() => useRetainedLogs('uid /&', true));
  await waitFor(() => expect(result.current.lines).toHaveLength(3));
  const firstUrl = new URL(fetchMock.mock.calls[1][0], 'http://console');
  expect(firstUrl.pathname).toContain('/services/https:collector:8443/proxy/api/v1/logs');
  expect(Object.fromEntries(firstUrl.searchParams)).toEqual({
    agentic_run_id: 'uid /&',
    phase: 'execution',
    limit: '1000',
  });
  const nextUrl = new URL(fetchMock.mock.calls[2][0], 'http://console');
  expect(nextUrl.searchParams.get('after')).toBe('5');
  expect(result.current.lines[0]).toBe('2026-10-27T10:00:00Z [log] line 2');
});

it.each([
  response({}, 403),
  response(null),
  response({ data: [] }),
  config(42),
  config('https://external.example/path'),
])('reports forbidden or invalid configuration without fetching logs %#', async (configuration) => {
  fetchMock.mockResolvedValueOnce(configuration);
  const { result } = renderHook(() => useRetainedLogs('run-uid', true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBeTruthy();
  expect(result.current.lines).toEqual([]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each([page([], true), page([1]), response({ records: 'invalid' }), response({}, 403)])(
  'rejects invalid second pages and discards partial results %#',
  async (secondPage) => {
    fetchMock
      .mockResolvedValueOnce(config())
      .mockResolvedValueOnce(page([1], true))
      .mockResolvedValueOnce(secondPage);
    const { result } = renderHook(() => useRetainedLogs('run-uid', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.lines).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  },
);

it('reports network errors and retries only on request', async () => {
  fetchMock.mockRejectedValueOnce(new Error('Network unavailable'));
  const { result } = renderHook(() => useRetainedLogs('run-uid', true));
  await waitFor(() => expect(result.current.error).toBe('Failed to load retained logs'));
  expect(result.current.loading).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockResolvedValueOnce(config()).mockResolvedValueOnce(page([1]));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.lines).toHaveLength(1));
  expect(result.current.error).toBeUndefined();
});

it('treats a rejected discovery 404 as optional but surfaces forbidden errors', async () => {
  fetchMock.mockRejectedValueOnce(Object.assign(new Error('Not found'), { code: 404 }));
  const { result } = renderHook(() => useRetainedLogs('run-uid', true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBeUndefined();
  fetchMock.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { code: 403 }));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.error).toBe('Failed to load retained logs (HTTP 403)'));
});

it('settles malformed JSON instead of leaving loading or publishing partial data', async () => {
  fetchMock.mockResolvedValueOnce(config()).mockResolvedValueOnce({
    ...response({}),
    json: jest.fn<() => Promise<unknown>>().mockRejectedValue(new SyntaxError('Unexpected token')),
  });
  const { result } = renderHook(() => useRetainedLogs('run-uid', true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('Failed to load retained logs');
  expect(result.current.lines).toEqual([]);
});

it('aborts an in-flight request when unmounted', async () => {
  fetchMock.mockReturnValueOnce(new Promise(() => {}));
  const { unmount } = renderHook(() => useRetainedLogs('run-uid', true));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const signal = fetchMock.mock.calls[0][1]?.signal;
  unmount();
  expect(signal?.aborted).toBe(true);
});

it('aborts discovery and ignores stale responses on run switch', async () => {
  let completeOldRequest = () => {};
  fetchMock.mockReturnValueOnce(
    new Promise((resolve) => {
      completeOldRequest = () => resolve(config());
    }),
  );
  const { result, rerender } = renderHook(({ uid }) => useRetainedLogs(uid, true), {
    initialProps: { uid: 'old-run' },
  });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const oldSignal = fetchMock.mock.calls[0][1]?.signal;
  fetchMock.mockResolvedValueOnce(config()).mockResolvedValueOnce(page([2], false, 'new-run'));
  rerender({ uid: 'new-run' });
  expect(result.current.lines).toEqual([]);
  expect(oldSignal?.aborted).toBe(true);
  await waitFor(() => expect(result.current.lines).toHaveLength(1));
  await act(async () => completeOldRequest());
  expect(result.current.lines[0]).toContain('line 2');
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it('aborts log loading when deactivated and ignores the late page', async () => {
  let completePage = () => {};
  fetchMock.mockResolvedValueOnce(config()).mockReturnValueOnce(
    new Promise((resolve) => {
      completePage = () => resolve(page([1]));
    }),
  );
  const { result, rerender, unmount } = renderHook(
    ({ active }) => useRetainedLogs('run-uid', active),
    { initialProps: { active: true } },
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const signal = fetchMock.mock.calls[1][1]?.signal;
  rerender({ active: false });
  expect(signal?.aborted).toBe(true);
  expect(result.current.loading).toBe(false);
  await act(async () => completePage());
  expect(result.current.lines).toEqual([]);
  unmount();
});

it.each([true, false])('bounds pagination at 20000 lines (has_more=%s)', async (hasMore) => {
  fetchMock.mockResolvedValueOnce(config());
  for (let pageIndex = 0; pageIndex < 20; pageIndex++) {
    const ids = Array.from({ length: 1000 }, (_value, index) => pageIndex * 1000 + index + 1);
    fetchMock.mockResolvedValueOnce(page(ids, pageIndex < 19 || hasMore));
  }
  const { result } = renderHook(() => useRetainedLogs('run-uid', true));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.lines).toHaveLength(MAX_RETAINED_LOG_LINES);
  expect(result.current.truncated).toBe(hasMore);
  expect(fetchMock).toHaveBeenCalledTimes(21);
});
