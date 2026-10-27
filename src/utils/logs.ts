export const MAX_LOG_LINES = 20000;
export const MAX_LOG_LINE_CHARS = 65536;
export const MAX_LOG_TEXT_CHARS = 4194304;

export const getLogHttpStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = error as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  return [candidate.code, candidate.response?.status, candidate.status].find(
    (status): status is number =>
      typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599,
  );
};

export const boundLogLines = (lines: string[], latest = true) => {
  const result: string[] = [];
  let characters = 0;
  let truncated = false;
  for (let offset = 0; offset < lines.length; offset++) {
    const raw = lines[latest ? lines.length - 1 - offset : offset];
    const line = raw.slice(0, MAX_LOG_LINE_CHARS);
    truncated ||= line.length < raw.length;
    const cost = line.length + (result.length > 0 ? 1 : 0);
    if (result.length >= MAX_LOG_LINES || characters + cost > MAX_LOG_TEXT_CHARS) {
      truncated = true;
      break;
    }
    result.push(line);
    characters += cost;
  }
  return { lines: latest ? result.reverse() : result, truncated, characters };
};
