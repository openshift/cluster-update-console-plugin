import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import { ConfigureUpstreamModal } from '../components/modals/ConfigureUpstreamModal';
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

describe('ConfigureUpstreamModal', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(
      <ConfigureUpstreamModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    expect(screen.getByText('Edit upstream configuration')).toBeInTheDocument();
  });

  it('shows Custom option selected when upstream is configured', () => {
    render(
      <ConfigureUpstreamModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    const customRadio = screen.getByLabelText('Custom update service');
    expect(customRadio).toBeChecked();
  });

  it('shows Default option selected when upstream is not configured', () => {
    const cvNoUpstream = {
      ...clusterVersionWithUpdates,
      spec: {
        ...clusterVersionWithUpdates.spec,
        upstream: undefined,
      },
    };

    render(
      <ConfigureUpstreamModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={cvNoUpstream}
      />,
    );

    const defaultRadio = screen.getByLabelText('Default');
    expect(defaultRadio).toBeChecked();
  });

  it('switches from Default to Custom', async () => {
    const user = userEvent.setup();
    const cvNoUpstream = {
      ...clusterVersionWithUpdates,
      spec: {
        ...clusterVersionWithUpdates.spec,
        upstream: undefined,
      },
    };

    render(
      <ConfigureUpstreamModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={cvNoUpstream}
      />,
    );

    const customRadio = screen.getByLabelText('Custom update service');
    await user.click(customRadio);

    expect(customRadio).toBeChecked();
  });

  it('submits custom URL successfully', async () => {
    const user = userEvent.setup();
    (k8sPatch as jest.Mock).mockResolvedValue({});

    const cvNoUpstream = {
      ...clusterVersionWithUpdates,
      spec: {
        ...clusterVersionWithUpdates.spec,
        upstream: undefined,
      },
    };

    render(
      <ConfigureUpstreamModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={cvNoUpstream}
      />,
    );

    // Switch to custom
    const customRadio = screen.getByLabelText('Custom update service');
    await user.click(customRadio);

    // Enter custom URL
    const urlInput = screen.getByPlaceholderText(/https:\/\/example\.com/);
    await user.type(urlInput, 'https://custom.example.com/api/graph');

    // Submit
    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(k8sPatch).toHaveBeenCalledWith({
        model: expect.objectContaining({ kind: 'ClusterVersion' }),
        resource: cvNoUpstream,
        data: [{ op: 'add', path: '/spec/upstream', value: 'https://custom.example.com/api/graph' }],
      });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('submits default (null) successfully', async () => {
    const user = userEvent.setup();
    (k8sPatch as jest.Mock).mockResolvedValue({});

    render(
      <ConfigureUpstreamModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    // Switch to default
    const defaultRadio = screen.getByLabelText('Default');
    await user.click(defaultRadio);

    // Submit
    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(k8sPatch).toHaveBeenCalledWith({
        model: expect.objectContaining({ kind: 'ClusterVersion' }),
        resource: clusterVersionWithUpdates,
        data: [{ op: 'add', path: '/spec/upstream', value: null }],
      });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('validates empty custom URL', async () => {
    const user = userEvent.setup();
    const cvNoUpstream = {
      ...clusterVersionWithUpdates,
      spec: {
        ...clusterVersionWithUpdates.spec,
        upstream: undefined,
      },
    };

    render(
      <ConfigureUpstreamModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={cvNoUpstream}
      />,
    );

    // Switch to custom
    const customRadio = screen.getByLabelText('Custom update service');
    await user.click(customRadio);

    // Click Save without entering URL
    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Please enter a URL.')).toBeInTheDocument();
    });
    expect(k8sPatch).not.toHaveBeenCalled();
  });

  it('handles patch error', async () => {
    const user = userEvent.setup();
    (k8sPatch as jest.Mock).mockRejectedValue(new Error('Permission denied'));

    render(
      <ConfigureUpstreamModal
        isOpen={true}
        onClose={mockOnClose}
        clusterVersion={clusterVersionWithUpdates}
      />,
    );

    const defaultRadio = screen.getByLabelText('Default');
    await user.click(defaultRadio);

    const saveButton = screen.getByText('Save');
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeInTheDocument();
    });
  });
});
