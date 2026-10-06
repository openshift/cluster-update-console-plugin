import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterChannelModal } from '../components/modals/ClusterChannelModal';
import { clusterVersionWithUpdates } from './data/clusterVersionMock';

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

jest.mock('@openshift-console/dynamic-plugin-sdk');

describe('ClusterChannelModal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(
      <ClusterChannelModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    expect(screen.getByText('Select channel')).toBeInTheDocument();
  });

  it('does not render modal when closed', () => {
    render(
      <ClusterChannelModal
        isOpen={false}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    expect(screen.queryByText('Select channel')).not.toBeInTheDocument();
  });

  it('shows channel dropdown when channels exist', () => {
    render(
      <ClusterChannelModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    // Should show available channels
    expect(screen.getByText(/stable-4.15/)).toBeInTheDocument();
  });

  it('submits channel change successfully', async () => {
    const user = userEvent.setup();
    (k8sPatch as jest.Mock).mockResolvedValue({});

    render(
      <ClusterChannelModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(k8sPatch).toHaveBeenCalledWith({
        model: expect.objectContaining({ kind: 'ClusterVersion' }),
        resource: clusterVersionWithUpdates,
        data: [{ op: 'add', path: '/spec/channel', value: 'stable-4.15' }],
      });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles patch error', async () => {
    const user = userEvent.setup();
    (k8sPatch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(
      <ClusterChannelModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('allows canceling', async () => {
    const user = userEvent.setup();

    render(
      <ClusterChannelModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
    expect(k8sPatch).not.toHaveBeenCalled();
  });
});
