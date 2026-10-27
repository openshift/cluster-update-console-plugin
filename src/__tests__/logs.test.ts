import {
  boundLogLines,
  getLogHttpStatus,
  MAX_LOG_LINE_CHARS,
  MAX_LOG_LINES,
  MAX_LOG_TEXT_CHARS,
} from '../utils/logs';

it.each([
  { code: 403 },
  { response: { status: 403 } },
  { status: 403 },
  { code: 'ERR', response: { status: 403 } },
])('normalizes HTTP status %#', (error) => {
  expect(getLogHttpStatus(error)).toBe(403);
});
it.each([null, undefined, '403', { code: '403' }, { status: 1.5 }])(
  'rejects invalid HTTP status %#',
  (error) => {
    expect(getLogHttpStatus(error)).toBeUndefined();
  },
);
it('bounds line width and preserves either latest or first lines', () => {
  expect(boundLogLines(['x'.repeat(MAX_LOG_LINE_CHARS + 1)]).lines[0]).toHaveLength(
    MAX_LOG_LINE_CHARS,
  );
  expect(boundLogLines(['x'.repeat(MAX_LOG_LINE_CHARS + 1)]).truncated).toBe(true);
  const lines = Array.from({ length: MAX_LOG_LINES + 1 }, (_value, index) => String(index));
  expect(boundLogLines(lines).lines[0]).toBe('1');
  expect(boundLogLines(lines, false).lines[0]).toBe('0');
  expect(boundLogLines(lines, false).lines).toHaveLength(MAX_LOG_LINES);
});
it('bounds aggregate retained characters including separators', () => {
  const result = boundLogLines(Array.from({ length: 1000 }, () => 'x'.repeat(MAX_LOG_LINE_CHARS)));
  expect(result.lines.join('\n').length).toBeLessThanOrEqual(MAX_LOG_TEXT_CHARS);
  expect(result.characters).toBe(result.lines.join('\n').length);
  expect(result.truncated).toBe(true);
});
