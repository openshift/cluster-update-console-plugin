type SemVer = {
  major: number;
  minor: number;
  patch: number;
};

export const parseSemVer = (version: string): SemVer | null => {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
};

export const compareSemVer = (a: string, b: string): number => {
  const pa = parseSemVer(a);
  const pb = parseSemVer(b);
  if (!pa || !pb) return a.localeCompare(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
};

export const getUpdateType = (
  current: string,
  target: string,
): 'z-stream' | 'minor' | 'unknown' => {
  const c = parseSemVer(current);
  const t = parseSemVer(target);
  if (!c || !t) return 'unknown';
  if (c.major === t.major && c.minor === t.minor) return 'z-stream';
  return 'minor';
};

export const sanitizeVersion = (version: string): string => version.replace(/[^a-zA-Z0-9.-]/g, '-');

// Labels store versions with dots replaced by dashes (e.g. "4-21-5").
// Restore the dotted form for display (e.g. "4.21.5"), preserving any
// pre-release suffix after the patch segment (e.g. "4-21-5-rc1" => "4.21.5-rc1").
export const unsanitizeVersion = (version: string): string => {
  const parts = version.split('-');
  if (parts.length >= 3) {
    return parts.slice(0, 3).join('.') + (parts.length > 3 ? '-' + parts.slice(3).join('-') : '');
  }
  return version.replace(/-/g, '.');
};
