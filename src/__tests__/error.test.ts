import { getErrorMessage } from '../utils/error';

describe('getErrorMessage', () => {
  it('extracts message from Error instances', () => {
    expect(getErrorMessage(new Error('something broke'))).toBe('something broke');
  });

  it('converts strings to string', () => {
    expect(getErrorMessage('raw string')).toBe('raw string');
  });

  it('converts numbers to string', () => {
    expect(getErrorMessage(404)).toBe('404');
  });

  it('converts null to string', () => {
    expect(getErrorMessage(null)).toBe('null');
  });

  it('converts undefined to string', () => {
    expect(getErrorMessage(undefined)).toBe('undefined');
  });
});
