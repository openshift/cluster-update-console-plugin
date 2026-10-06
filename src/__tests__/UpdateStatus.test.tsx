import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { UpdateStatus } from '../components/cluster-updates/UpdateStatus';
import {
  clusterVersionWithUpdates,
  clusterVersionUpdating,
  clusterVersionUpToDate,
} from './data/clusterVersionMock';

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const text = key.replace('plugin__cluster-update-console-plugin~', '');
      if (opts) {
        return Object.entries(opts).reduce(
          (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
          text,
        );
      }
      return text;
    },
  }),
}));

describe('UpdateStatus', () => {
  it('renders "Available updates" when updates are available', () => {
    const { container } = render(<UpdateStatus cv={clusterVersionWithUpdates} />);
    expect(screen.getByText('Available updates')).toBeInTheDocument();
    expect(container.querySelector('[data-test="cv-update-status-available-updates"]')).toBeInTheDocument();
  });

  it('renders "Up to date" when no updates are available', () => {
    const { container } = render(<UpdateStatus cv={clusterVersionUpToDate} />);
    expect(screen.getByText('Up to date')).toBeInTheDocument();
    expect(container.querySelector('[data-test="cv-update-status-up-to-date"]')).toBeInTheDocument();
  });

  it('renders update in progress message when updating', () => {
    const { container } = render(<UpdateStatus cv={clusterVersionUpdating} />);
    expect(screen.getByText(/Update to 4\.15\.4 in progress/)).toBeInTheDocument();
    expect(container.querySelector('[data-test="cv-update-status-updating"]')).toBeInTheDocument();
  });
});
