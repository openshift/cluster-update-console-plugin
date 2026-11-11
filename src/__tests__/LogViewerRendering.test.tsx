/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { ExecutionLogs } from '../components/shared/ExecutionLogs';
import { useStepSandbox } from '../hooks/useExecutionSandbox';
import { useRetainedLogs } from '../hooks/useRetainedLogs';
import { useSandboxLogStream } from '../hooks/useSandboxLogStream';
import { LightspeedAgenticRun } from '../models/agenticrun';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (text: string) => text }) }));
jest.mock('../hooks/useExecutionSandbox');
jest.mock('../hooks/useRetainedLogs');
jest.mock('../hooks/useSandboxLogStream');

beforeEach(() => {
  jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Chrome/130.0.0.0');
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(280);
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    font: '',
    measureText: () => ({ width: 8 }),
  } as unknown as CanvasRenderingContext2D);
  const computedStyle = window.getComputedStyle;
  jest.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = computedStyle(element);
    style.lineHeight = '20px';
    style.paddingLeft = '0px';
    style.paddingRight = '0px';
    style.width = '24px';
    return style;
  });
});

afterEach(() => jest.restoreAllMocks());

it.each(['pod', 'retained'] as const)(
  'keeps long %s log markup literal during measurement and search in the real viewer',
  (source) => {
    const literal = '<span data-log-sentinel="literal">plain &amp; text</span>';
    const line = `${'x'.repeat(5100)}\t${literal}`;
    const retry = jest.fn();
    (useRetainedLogs as jest.Mock).mockReturnValue({
      available: source === 'retained',
      lines: source === 'retained' ? [line] : [],
      loading: false,
      retry,
    });
    (useStepSandbox as jest.Mock).mockReturnValue({
      pod: { namespace: 'ns', podName: 'pod' },
      loading: false,
      retry,
    });
    (useSandboxLogStream as jest.Mock).mockReturnValue({
      lines: source === 'pod' ? [line] : [],
      loading: false,
      state: source === 'pod' ? 'streaming' : 'idle',
      revision: 0,
      retry,
    });
    const htmlWrites = jest.spyOn(Element.prototype, 'innerHTML', 'set');
    const run = {
      metadata: { uid: 'run', namespace: 'ns' },
      status: { conditions: [{ type: 'Executed', status: source === 'pod' ? 'Unknown' : 'True' }] },
    } as LightspeedAgenticRun;
    const { container } = render(<ExecutionLogs run={run} />);
    fireEvent.click(screen.getByRole('button', { name: 'View execution logs' }));
    expect(container.querySelector('.pf-v6-c-log-viewer__text')?.textContent).toContain(literal);
    expect(htmlWrites.mock.calls.some(([html]) => String(html).includes(literal))).toBe(false);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search execution logs' }), {
      target: { value: literal },
    });
    expect(container.querySelector('.pf-v6-c-log-viewer__string')?.textContent).toBe(literal);
    expect(container.querySelector('.pf-v6-c-log-viewer__text')?.textContent).toContain(literal);
    expect(container.querySelector('[data-log-sentinel]')).toBeNull();
    expect(htmlWrites.mock.calls.some(([html]) => String(html).includes(literal))).toBe(false);
  },
);
