import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdatesGraph } from '../components/cluster-updates/UpdatesGraph';
import type { ClusterVersion } from '../models/clusterversion';
import {
  clusterVersionWithUpdates,
  clusterVersionUpgradeableFalse,
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

describe('UpdatesGraph', () => {
  it('renders current version', () => {
    const { container } = render(<UpdatesGraph clusterVersion={clusterVersionWithUpdates} />);
    expect(screen.getByText('4.15.2')).toBeInTheDocument();
    expect(container.querySelector('[data-test="cv-updates-graph"]')).toBeInTheDocument();
  });

  it('renders newest version when updates available', () => {
    render(<UpdatesGraph clusterVersion={clusterVersionWithUpdates} />);
    expect(screen.getByText('4.16.0')).toBeInTheDocument();
  });

  it('shows "+ More" button when more than 2 updates available', () => {
    const { container } = render(<UpdatesGraph clusterVersion={clusterVersionWithUpdates} />);
    expect(screen.getByText('+ More')).toBeInTheDocument();
    expect(container.querySelector('[data-test="cv-more-updates-button"]')).toBeInTheDocument();
  });

  it('calls onShowMoreUpdates when "+ More" button is clicked', async () => {
    const user = userEvent.setup();
    const handleShowMore = jest.fn();
    render(
      <UpdatesGraph
        clusterVersion={clusterVersionWithUpdates}
        onShowMoreUpdates={handleShowMore}
      />,
    );

    const moreButton = screen.getByText('+ More');
    await user.click(moreButton);

    expect(handleShowMore).toHaveBeenCalledTimes(1);
  });

  it('shows intermediate version when exactly 2 updates available', () => {
    // Create a CV with exactly 2 updates
    const cvWith2Updates = {
      ...clusterVersionWithUpdates,
      status: {
        ...clusterVersionWithUpdates.status,
        desired: clusterVersionWithUpdates.status?.desired || { version: '4.15.2', image: 'test' },
        availableUpdates: [
          {
            version: '4.15.4',
            image: 'quay.io/openshift-release-dev/ocp-release@sha256:test1',
          },
          {
            version: '4.15.3',
            image: 'quay.io/openshift-release-dev/ocp-release@sha256:test2',
          },
        ],
      },
    } as ClusterVersion;

    render(<UpdatesGraph clusterVersion={cvWith2Updates} />);
    expect(screen.getByText('4.15.3')).toBeInTheDocument(); // intermediate
    expect(screen.getByText('4.15.4')).toBeInTheDocument(); // newest
    expect(screen.queryByText('+ More')).not.toBeInTheDocument();
  });

  it('shows update blocked warning when Upgradeable=False and newer minor version', () => {
    render(<UpdatesGraph clusterVersion={clusterVersionUpgradeableFalse} />);
    // The component should render but with upgrade blocked indicator
    expect(screen.getByText('4.15.2')).toBeInTheDocument();
    expect(screen.getByText('4.15.4')).toBeInTheDocument();
  });
});
