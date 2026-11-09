/** @jest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import { ReadableStream } from 'node:stream/web';
import { TextDecoder, TextEncoder } from 'node:util';
import { SandboxView, useSandboxLogStream } from '../hooks/useSandboxLogStream';
import { MAX_LOG_LINE_CHARS, MAX_LOG_TEXT_CHARS } from '../utils/logs';

jest.mock('react-i18next', () => {
  const t = (message: string, options?: Record<string, unknown>) =>
    message.replace(/{{(\w+)}}/g, (match: string, key: string) => String(options?.[key] ?? match));
  return { useTranslation: () => ({ t }) };
});

const fetchLogs = consoleFetch as jest.MockedFunction<typeof consoleFetch>;
const sandbox: SandboxView = {
  namespace: 'execution-space',
  podName: 'runner',
  podUid: 'pod-uid',
  container: 'workload',
};
const encoder = new TextEncoder();
const timestamp = '2026-10-27T12:30:00.123456789Z';

const logStream = () => {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const cancel = jest.fn<() => void>();
  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController as unknown as ReadableStreamDefaultController<Uint8Array>;
    },
    cancel,
  });
  return {
    response: { ok: true, status: 200, body } as unknown as Response,
    write: (text: string) => controller.enqueue(encoder.encode(text)),
    bytes: (bytes: Uint8Array) => controller.enqueue(bytes),
    close: () => controller.close(),
    fail: () => controller.error(new Error('connection lost')),
    cancel,
  };
};

const completedResponse = (text: string, status = 200) => {
  const stream = logStream();
  stream.write(text);
  stream.close();
  return { ...stream.response, ok: status >= 200 && status < 300, status } as Response;
};

const flush = async () => {
  await act(async () => {
    for (let iteration = 0; iteration < 20; iteration++) {
      await Promise.resolve();
    }
  });
};

const advance = async (milliseconds: number) => {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds);
    for (let iteration = 0; iteration < 20; iteration++) {
      await Promise.resolve();
    }
  });
};

const requestedParameters = (index = 0) =>
  new URL(fetchLogs.mock.calls[index][0], 'https://console').searchParams;

describe('useSandboxLogStream', () => {
  beforeEach(() => {
    Object.assign(globalThis, { TextDecoder, TextEncoder });
    jest.useFakeTimers();
    fetchLogs.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stays idle without an active resolved sandbox', async () => {
    const { result, rerender } = renderHook(
      ({ view, active }: { view?: SandboxView; active: boolean }) =>
        useSandboxLogStream(view, active, true),
      { initialProps: { view: undefined, active: true } },
    );
    await flush();
    expect(result.current).toMatchObject({ lines: [], loading: false, state: 'idle' });
    rerender({ view: undefined, active: false });
    expect(fetchLogs).not.toHaveBeenCalled();
  });

  it('requests encoded scoped logs and clears loading on the first live line', async () => {
    const stream = logStream();
    fetchLogs.mockResolvedValue(stream.response);
    const sinceTime = '2026-10-27T13:00:00+01:00';
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, true, sinceTime));
    expect(result.current).toMatchObject({ loading: true, state: 'connecting' });
    await flush();
    expect(Object.fromEntries(requestedParameters())).toEqual({
      timestamps: 'true',
      follow: 'true',
      container: 'workload',
      sinceTime,
    });
    stream.write(`${timestamp} hello\n`);
    await flush();
    expect(result.current).toMatchObject({
      lines: [`${timestamp} hello`],
      loading: false,
      state: 'streaming',
      error: undefined,
    });
  });

  it('decodes split UTF-8, buffers partial lines, and flushes the final EOF fragment', async () => {
    const stream = logStream();
    fetchLogs.mockResolvedValue(stream.response);
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, false));
    await flush();
    const bytes = encoder.encode('first 🌍\nlast café');
    const split = encoder.encode('first ').length + 2;
    stream.bytes(bytes.slice(0, split));
    await flush();
    expect(result.current.lines).toEqual([]);
    expect(result.current.loading).toBe(false);
    stream.bytes(bytes.slice(split));
    await flush();
    expect(result.current.lines).toEqual(['first 🌍']);
    stream.close();
    await flush();
    expect(result.current).toMatchObject({
      lines: ['first 🌍', 'last café'],
      state: 'complete',
      loading: false,
    });
  });

  it('flushes an incomplete final UTF-8 sequence using the decoder', async () => {
    const stream = logStream();
    fetchLogs.mockResolvedValue(stream.response);
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, false));
    await flush();
    stream.bytes(new Uint8Array([0x61, 0xe2, 0x82]));
    stream.close();
    await flush();
    expect(result.current.lines).toEqual(['a�']);
  });

  it.each([undefined, '2026-10-27T12:00:00Z'])(
    'scopes snapshots with sinceTime=%s, otherwise a 500-line tail',
    async (sinceTime) => {
      fetchLogs.mockResolvedValue(completedResponse(''));
      const { result } = renderHook(() => useSandboxLogStream(sandbox, true, false, sinceTime));
      await flush();
      const parameters = requestedParameters();
      expect(parameters.has('follow')).toBe(false);
      expect(parameters.get('sinceTime')).toBe(sinceTime ?? null);
      expect(parameters.get('tailLines')).toBe(sinceTime ? null : '500');
      expect(result.current).toMatchObject({ lines: [], loading: false, state: 'complete' });
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('discloses the snapshot tail limit when the response reaches it', async () => {
    fetchLogs.mockResolvedValue(completedResponse(Array(500).fill('line').join('\n')));
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, false));
    await flush();
    expect(result.current.lines).toHaveLength(500);
    expect(result.current.truncated).toBe(true);
  });

  it('retains at most 20,000 lines and discloses truncation', async () => {
    fetchLogs.mockResolvedValue(
      completedResponse(Array.from({ length: 20003 }, (_, index) => `line ${index}`).join('\n')),
    );
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, false, timestamp));
    await flush();
    expect(result.current.lines).toHaveLength(20000);
    expect(result.current.lines[0]).toBe('line 3');
    expect(result.current.lines[19999]).toBe('line 20002');
    expect(result.current.truncated).toBe(true);
  });

  it('stops repeated unterminated chunks at the line-width limit and preserves prior output', async () => {
    const stream = logStream();
    fetchLogs.mockResolvedValue(stream.response);
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, true));
    await flush();
    stream.write('previous output\n');
    await flush();
    const chunk = 'x'.repeat(4096);
    for (let index = 0; index < MAX_LOG_LINE_CHARS / chunk.length; index++) {
      stream.write(chunk);
      await flush();
      expect(result.current.state).toBe('streaming');
    }
    stream.write(chunk);
    await flush();
    expect(result.current).toMatchObject({
      lines: ['previous output'],
      state: 'error',
      loading: false,
      truncated: true,
    });
    expect(result.current.error).toContain(String(MAX_LOG_LINE_CHARS));
    expect(result.current.error).toContain('Reduce the log line size and retry');
    expect(fetchLogs.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(stream.cancel).toHaveBeenCalledTimes(1);
    await advance(60000);
    expect(fetchLogs).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])(
    'rejects a huge delimited line, preserving preceding completed lines (streaming=%s)',
    async (streaming) => {
      const stream = logStream();
      fetchLogs.mockResolvedValue(stream.response);
      const { result } = renderHook(() => useSandboxLogStream(sandbox, true, streaming));
      await flush();
      stream.write(`safe first line\n${'x'.repeat(MAX_LOG_LINE_CHARS + 1)}\nnever displayed\n`);
      await flush();
      expect(result.current).toMatchObject({
        lines: ['safe first line'],
        state: 'error',
        truncated: true,
        loading: false,
      });
      expect(stream.cancel).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('rejects an over-limit final EOF fragment after flushing a pending UTF-8 character', async () => {
    const stream = logStream();
    fetchLogs.mockResolvedValue(stream.response);
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, false));
    await flush();
    stream.write(`saved\n${'x'.repeat(MAX_LOG_LINE_CHARS)}`);
    stream.bytes(new Uint8Array([0xe2, 0x82]));
    await flush();
    expect(result.current.state).not.toBe('error');
    stream.close();
    await flush();
    expect(result.current).toMatchObject({
      lines: ['saved'],
      state: 'error',
      truncated: true,
      loading: false,
    });
    expect(result.current.error).toContain(String(MAX_LOG_LINE_CHARS));
    expect(jest.getTimerCount()).toBe(0);
  });

  it('accepts a line exactly at the width limit across chunks and EOF', async () => {
    const stream = logStream();
    fetchLogs.mockResolvedValue(stream.response);
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, false, timestamp));
    await flush();
    stream.write('x'.repeat(MAX_LOG_LINE_CHARS - 1));
    stream.write('x');
    stream.close();
    await flush();
    expect(result.current.lines).toEqual(['x'.repeat(MAX_LOG_LINE_CHARS)]);
    expect(result.current).toMatchObject({ state: 'complete', truncated: false });
  });

  it('bounds saved text and timestamp-boundary key characters, disclosing evictions', async () => {
    const first = logStream();
    const second = logStream();
    fetchLogs.mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response);
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, true));
    await flush();
    const wideLines = Array.from(
      { length: 80 },
      (_, index) => `${timestamp} ${index} ${'x'.repeat(60000)}`,
    );
    for (let index = 0; index < wideLines.length; index += 10) {
      first.write(`${wideLines.slice(index, index + 10).join('\n')}\n`);
      await flush();
      expect(result.current.lines.join('\n').length).toBeLessThanOrEqual(MAX_LOG_TEXT_CHARS);
    }
    expect(result.current.truncated).toBe(true);
    expect(result.current.lines.length).toBeLessThan(wideLines.length);
    expect(result.current.lines[result.current.lines.length - 1]).toBe(wideLines[79]);
    expect(result.current.lines).not.toContain(wideLines[0]);
    first.close();
    await flush();
    await advance(1000);
    expect(requestedParameters(1).get('sinceTime')).toBe(timestamp);
    second.write(`${wideLines[0]}\n`);
    await flush();
    expect(result.current.lines[result.current.lines.length - 1]).toBe(wideLines[0]);
    expect(result.current.lines.join('\n').length).toBeLessThanOrEqual(MAX_LOG_TEXT_CHARS);
    expect(result.current.truncated).toBe(true);
  });

  it.each([
    '2026-10-27T12:30:00Z',
    '2026-10-27T12:30:00.123456789Z',
    '2026-10-27T14:30:00+02:00',
    '2026-10-27T07:30:00.123456789-05:00',
  ])('resumes inclusively at %s without losing boundary multiplicity', async (stamp) => {
    const first = logStream();
    const second = logStream();
    fetchLogs.mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response);
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, true));
    await flush();
    first.write(`${stamp} repeat\n${stamp} distinct\n${stamp} repeat\n`);
    first.close();
    await flush();
    expect(result.current.state).toBe('reconnecting');
    expect(result.current.revision).toBe(0);
    await advance(1000);
    expect(requestedParameters(1).get('sinceTime')).toBe(stamp);
    second.write(`${stamp} repeat\n`);
    await flush();
    second.write(`${stamp} distinct\n${stamp} repeat\n${stamp} repeat\n${stamp} new\n`);
    await flush();
    expect(result.current.lines).toEqual([
      `${stamp} repeat`,
      `${stamp} distinct`,
      `${stamp} repeat`,
      `${stamp} repeat`,
      `${stamp} new`,
    ]);
  });

  it('updates the resume boundary from a final unterminated line', async () => {
    fetchLogs.mockResolvedValueOnce(completedResponse(`${timestamp} final`));
    fetchLogs.mockResolvedValueOnce(logStream().response);
    renderHook(() => useSandboxLogStream(sandbox, true, true));
    await flush();
    await advance(1000);
    expect(requestedParameters(1).get('sinceTime')).toBe(timestamp);
  });

  it.each([400, 401, 403, 404])(
    'stops on permanent HTTP %s without exposing its body',
    async (status) => {
      fetchLogs.mockResolvedValue(completedResponse('PRIVATE HTTP ERROR BODY', status));
      const { result } = renderHook(() => useSandboxLogStream(sandbox, true, true));
      await flush();
      expect(result.current).toMatchObject({ lines: [], loading: false, state: 'error' });
      expect(result.current.error).toContain(`HTTP ${status}`);
      await advance(60000);
      expect(fetchLogs).toHaveBeenCalledTimes(1);
    },
  );

  it('recognizes SDK-rejected HTTP errors as permanent', async () => {
    fetchLogs.mockRejectedValue({ response: { status: 403 }, message: 'not a log line' });
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, true));
    await flush();
    expect(result.current.state).toBe('error');
    expect(result.current.error).toContain('403');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('treats a code-only forbidden error as permanent without displaying or retrying its payload', async () => {
    fetchLogs.mockRejectedValue({ code: 403, message: 'private server response' });
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, true));
    await flush();
    expect(result.current).toMatchObject({ lines: [], state: 'error', loading: false });
    expect(result.current.error).toContain('HTTP 403');
    expect(result.current.error).not.toContain('private server response');
    await advance(60000);
    expect(fetchLogs).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([408, 429, 500, 503])(
    'retries HTTP %s and clears the error on recovered data',
    async (status) => {
      const recovered = logStream();
      fetchLogs
        .mockResolvedValueOnce(completedResponse('HTTP error', status))
        .mockResolvedValueOnce(recovered.response);
      const { result } = renderHook(() => useSandboxLogStream(sandbox, true, true));
      await flush();
      expect(result.current).toMatchObject({ state: 'reconnecting', loading: false });
      expect(result.current.error).toContain(String(status));
      await advance(999);
      expect(fetchLogs).toHaveBeenCalledTimes(1);
      await advance(1);
      recovered.write('recovered\n');
      await flush();
      expect(result.current).toMatchObject({
        lines: ['recovered'],
        error: undefined,
        state: 'streaming',
      });
    },
  );

  it('preserves previous data when a reader fails and resumes from the last timestamp', async () => {
    const first = logStream();
    fetchLogs.mockResolvedValueOnce(first.response).mockResolvedValueOnce(logStream().response);
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, true));
    await flush();
    first.write(`${timestamp} saved\n`);
    await flush();
    first.fail();
    await flush();
    expect(result.current).toMatchObject({ lines: [`${timestamp} saved`], state: 'reconnecting' });
    expect(result.current.error).toBeDefined();
    await advance(1000);
    expect(requestedParameters(1).get('sinceTime')).toBe(timestamp);
  });

  it('keeps reconnecting beyond five network failures and recovers automatically', async () => {
    fetchLogs.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, true));
    await flush();
    for (const milliseconds of [1000, 2000, 4000, 8000, 15000]) {
      await advance(milliseconds);
    }
    expect(fetchLogs).toHaveBeenCalledTimes(6);
    expect(result.current.state).toBe('reconnecting');
    expect(jest.getTimerCount()).toBe(1);
    const recovered = logStream();
    fetchLogs.mockResolvedValue(recovered.response);
    await advance(15000);
    recovered.write('recovered live output\n');
    await flush();
    expect(fetchLogs).toHaveBeenCalledTimes(7);
    expect(result.current).toMatchObject({
      lines: ['recovered live output'],
      error: undefined,
      loading: false,
      state: 'streaming',
    });
  });

  it('caps empty-stream reconnect delays at 15 seconds', async () => {
    fetchLogs.mockImplementation(async () => completedResponse(''));
    renderHook(() => useSandboxLogStream(sandbox, true, true));
    await flush();
    for (const milliseconds of [1000, 2000, 4000, 8000, 15000, 15000]) {
      const calls = fetchLogs.mock.calls.length;
      await advance(milliseconds - 1);
      expect(fetchLogs).toHaveBeenCalledTimes(calls);
      await advance(1);
      expect(fetchLogs).toHaveBeenCalledTimes(calls + 1);
    }
  });

  it('permits manual retry after a permanent connection error', async () => {
    fetchLogs.mockRejectedValue({ code: 403 });
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, true));
    await flush();
    expect(result.current.state).toBe('error');
    const revision = result.current.revision;
    fetchLogs.mockResolvedValue(logStream().response);
    act(() => result.current.retry());
    await flush();
    expect(fetchLogs).toHaveBeenCalledTimes(2);
    expect(result.current.revision).toBe(revision + 1);
    expect(result.current).toMatchObject({ error: undefined, loading: true, state: 'connecting' });
  });

  it('settles missing-body errors and does not retry snapshots', async () => {
    fetchLogs.mockResolvedValue({ ok: true, status: 200, body: null } as Response);
    const { result } = renderHook(() => useSandboxLogStream(sandbox, true, false));
    await flush();
    expect(result.current).toMatchObject({ lines: [], state: 'error', loading: false });
    expect(result.current.error).toContain('no readable body');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('retains live lines during snapshot loading and while inactive', async () => {
    const live = logStream();
    const snapshot = logStream();
    fetchLogs.mockResolvedValueOnce(live.response).mockResolvedValueOnce(snapshot.response);
    const { result, rerender } = renderHook(
      ({ active, streaming }) => useSandboxLogStream(sandbox, active, streaming, timestamp),
      { initialProps: { active: true, streaming: true } },
    );
    await flush();
    live.write(`${timestamp} live\n`);
    await flush();
    rerender({ active: true, streaming: false });
    await flush();
    expect(live.cancel).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ lines: [`${timestamp} live`], loading: true });
    expect(requestedParameters(1).get('sinceTime')).toBe(timestamp);
    snapshot.write(`${timestamp} live\n${timestamp} finished\n`);
    snapshot.close();
    await flush();
    expect(result.current.lines).toEqual([`${timestamp} live`, `${timestamp} finished`]);
    rerender({ active: false, streaming: false });
    expect(result.current).toMatchObject({
      lines: [`${timestamp} live`, `${timestamp} finished`],
      state: 'idle',
      loading: false,
    });
  });

  it('resumes the live cursor after collapse without duplicating saved lines', async () => {
    const first = logStream();
    const second = logStream();
    fetchLogs.mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response);
    const { result, rerender } = renderHook(
      ({ active }) => useSandboxLogStream(sandbox, active, true),
      { initialProps: { active: true } },
    );
    await flush();
    first.write(`${timestamp} saved\n`);
    await flush();
    rerender({ active: false });
    expect(result.current.lines).toEqual([`${timestamp} saved`]);
    rerender({ active: true });
    await flush();
    expect(requestedParameters(1).get('sinceTime')).toBe(timestamp);
    second.write(`${timestamp} saved\n${timestamp} new\n`);
    await flush();
    expect(result.current.lines).toEqual([`${timestamp} saved`, `${timestamp} new`]);
  });

  it.each([
    { namespace: 'other-space' },
    { podName: 'other-pod' },
    { podUid: 'replacement-uid' },
    { container: 'other-container' },
  ])('resets and cancels on resource identity change %o', async (change) => {
    const first = logStream();
    fetchLogs.mockResolvedValueOnce(first.response).mockResolvedValueOnce(logStream().response);
    const { result, rerender } = renderHook((view) => useSandboxLogStream(view, true, true), {
      initialProps: sandbox,
    });
    await flush();
    first.write(`${timestamp} previous pod\n`);
    await flush();
    const signal = fetchLogs.mock.calls[0][1]?.signal;
    rerender({ ...sandbox, ...change });
    expect(result.current.lines).toEqual([]);
    expect(signal?.aborted).toBe(true);
    await flush();
    expect(first.cancel).toHaveBeenCalledTimes(1);
    expect(requestedParameters(1).has('sinceTime')).toBe(false);
  });

  it('resets on execution-start changes and never shows stale attempt data', async () => {
    const first = logStream();
    fetchLogs.mockResolvedValueOnce(first.response).mockResolvedValueOnce(logStream().response);
    const { result, rerender } = renderHook(
      (sinceTime) => useSandboxLogStream(sandbox, true, true, sinceTime),
      { initialProps: timestamp },
    );
    await flush();
    first.write(`${timestamp} old attempt\n`);
    await flush();
    const nextStart = '2026-10-27T13:00:00Z';
    rerender(nextStart);
    expect(result.current.lines).toEqual([]);
    await flush();
    expect(requestedParameters(1).get('sinceTime')).toBe(nextStart);
  });

  it('ignores and cancels a late fetch response after a pod switch', async () => {
    let resolveFirst = (response: Response): void => {
      void response;
    };
    const stale = logStream();
    fetchLogs
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(completedResponse('current pod\n'));
    const { result, rerender } = renderHook((view) => useSandboxLogStream(view, true, false), {
      initialProps: sandbox,
    });
    rerender({ ...sandbox, podUid: 'new-uid' });
    await flush();
    resolveFirst(stale.response);
    await flush();
    expect(stale.cancel).toHaveBeenCalledTimes(1);
    expect(result.current.lines).toEqual(['current pod']);
  });

  it('aborts fetch, cancels its reader, and removes reconnect timers on unmount', async () => {
    const stream = logStream();
    fetchLogs.mockResolvedValue(stream.response);
    const { unmount } = renderHook(() => useSandboxLogStream(sandbox, true, true));
    await flush();
    const signal = fetchLogs.mock.calls[0][1]?.signal;
    unmount();
    await flush();
    expect(signal?.aborted).toBe(true);
    expect(stream.cancel).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);

    fetchLogs.mockResolvedValue(completedResponse(''));
    const reconnecting = renderHook(() => useSandboxLogStream(sandbox, true, true));
    await flush();
    expect(jest.getTimerCount()).toBe(1);
    const calls = fetchLogs.mock.calls.length;
    reconnecting.unmount();
    await advance(60000);
    expect(jest.getTimerCount()).toBe(0);
    expect(fetchLogs).toHaveBeenCalledTimes(calls);
  });
});
