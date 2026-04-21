import { isTerminalPhase, TERMINAL_PHASES } from '../utils/constants';

describe('isTerminalPhase', () => {
  it('returns true for terminal phases', () => {
    for (const phase of TERMINAL_PHASES) {
      expect(isTerminalPhase(phase)).toBe(true);
    }
  });

  it('returns false for non-terminal phases', () => {
    expect(isTerminalPhase('Pending')).toBe(false);
    expect(isTerminalPhase('Analyzing')).toBe(false);
    expect(isTerminalPhase('Executing')).toBe(false);
  });

  it('returns true for undefined (no active phase)', () => {
    expect(isTerminalPhase(undefined)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(isTerminalPhase('')).toBe(true);
  });
});
