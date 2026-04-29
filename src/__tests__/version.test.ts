import {
  parseSemVer,
  compareSemVer,
  getUpdateType,
  sanitizeVersion,
  unsanitizeVersion,
} from '../utils/version';

describe('parseSemVer', () => {
  it('parses a standard version string', () => {
    expect(parseSemVer('4.21.5')).toEqual({ major: 4, minor: 21, patch: 5 });
  });

  it('parses a version with pre-release suffix', () => {
    expect(parseSemVer('4.21.5-rc1')).toEqual({ major: 4, minor: 21, patch: 5 });
  });

  it('returns null for invalid input', () => {
    expect(parseSemVer('not-a-version')).toBeNull();
    expect(parseSemVer('')).toBeNull();
    expect(parseSemVer('4.21')).toBeNull();
  });
});

describe('compareSemVer', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemVer('4.21.5', '4.21.5')).toBe(0);
  });

  it('compares by major version', () => {
    expect(compareSemVer('5.0.0', '4.0.0')).toBeGreaterThan(0);
    expect(compareSemVer('3.0.0', '4.0.0')).toBeLessThan(0);
  });

  it('compares by minor version', () => {
    expect(compareSemVer('4.22.0', '4.21.0')).toBeGreaterThan(0);
    expect(compareSemVer('4.20.0', '4.21.0')).toBeLessThan(0);
  });

  it('compares by patch version', () => {
    expect(compareSemVer('4.21.6', '4.21.5')).toBeGreaterThan(0);
    expect(compareSemVer('4.21.4', '4.21.5')).toBeLessThan(0);
  });

  it('falls back to localeCompare for invalid versions', () => {
    const result = compareSemVer('abc', 'def');
    expect(typeof result).toBe('number');
  });
});

describe('getUpdateType', () => {
  it('detects z-stream updates', () => {
    expect(getUpdateType('4.21.5', '4.21.6')).toBe('z-stream');
    expect(getUpdateType('4.21.5', '4.21.10')).toBe('z-stream');
  });

  it('detects minor updates', () => {
    expect(getUpdateType('4.21.5', '4.22.0')).toBe('minor');
  });

  it('detects major updates as minor', () => {
    expect(getUpdateType('4.21.5', '5.0.0')).toBe('minor');
  });

  it('returns unknown for invalid versions', () => {
    expect(getUpdateType('invalid', '4.21.5')).toBe('unknown');
    expect(getUpdateType('4.21.5', 'invalid')).toBe('unknown');
  });
});

describe('sanitizeVersion', () => {
  it('replaces non-alphanumeric chars except dots and hyphens', () => {
    expect(sanitizeVersion('4.21.5')).toBe('4.21.5');
    expect(sanitizeVersion('4.21.5-rc1')).toBe('4.21.5-rc1');
  });

  it('replaces special characters with hyphens', () => {
    expect(sanitizeVersion('4.21.5+build.1')).toBe('4.21.5-build.1');
    expect(sanitizeVersion('4.21.5@beta')).toBe('4.21.5-beta');
  });
});

describe('unsanitizeVersion', () => {
  it('converts label-safe version back to dotted form', () => {
    expect(unsanitizeVersion('4-21-5')).toBe('4.21.5');
  });

  it('preserves pre-release suffix', () => {
    expect(unsanitizeVersion('4-21-5-rc1')).toBe('4.21.5-rc1');
    expect(unsanitizeVersion('4-21-5-rc-2')).toBe('4.21.5-rc-2');
  });

  it('handles fewer than 3 parts by replacing all dashes with dots', () => {
    expect(unsanitizeVersion('4-21')).toBe('4.21');
  });
});
