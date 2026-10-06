import * as React from 'react';
import { Button, Tooltip } from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';
import './cluster-updates.css';

type ChannelProps = {
  children: React.ReactNode;
};

export const Channel: React.FC<ChannelProps> = ({ children }) => (
  <div className="cluster-update-plugin__channel">{children}</div>
);

type ChannelPathProps = {
  children: React.ReactNode;
  current?: boolean;
};

export const ChannelPath: React.FC<ChannelPathProps> = ({ children, current }) => (
  <div
    className={`cluster-update-plugin__channel-path ${
      current ? 'cluster-update-plugin__channel-path--current' : ''
    }`}
  >
    {children}
  </div>
);

type ChannelLineProps = {
  children?: React.ReactNode;
  start?: boolean;
};

export const ChannelLine: React.FC<ChannelLineProps> = ({ children, start }) => (
  <div
    className={`cluster-update-plugin__channel-line ${
      start ? 'cluster-update-plugin__channel-start' : ''
    }`}
  >
    {children}
  </div>
);

type ChannelVersionProps = {
  children: React.ReactNode;
  current?: boolean;
  updateBlocked?: boolean;
};

export const ChannelVersion: React.FC<ChannelVersionProps> = ({
  children,
  current,
  updateBlocked,
}) => (
  <div
    className={`cluster-update-plugin__channel-version ${
      current ? 'cluster-update-plugin__channel-version--current' : ''
    } ${updateBlocked ? 'cluster-update-plugin__channel-version--update-blocked' : ''}`}
  >
    {updateBlocked && (
      <Tooltip content="Update to this version is blocked">
        <ExclamationTriangleIcon
          className="cluster-update-plugin__channel-version__warning-icon"
          color="var(--pf-t--global--icon--color--status--warning--default)"
        />
      </Tooltip>
    )}
    {children}
  </div>
);

type ChannelVersionDotProps = {
  channel: string;
  version: string;
  current?: boolean;
  updateBlocked?: boolean;
};

export const ChannelVersionDot: React.FC<ChannelVersionDotProps> = ({
  channel,
  version,
  current,
  updateBlocked,
}) => (
  <Tooltip content={`${version} on ${channel}`}>
    <Button
      className={`cluster-update-plugin__channel-version-dot ${
        current ? 'cluster-update-plugin__channel-version-dot--current' : ''
      } ${updateBlocked ? 'cluster-update-plugin__channel-version-dot--update-blocked' : ''}`}
      variant="plain"
      aria-label={`${version} on ${channel}`}
    />
  </Tooltip>
);

type ChannelNameProps = {
  children: React.ReactNode;
  current?: boolean;
};

export const ChannelName: React.FC<ChannelNameProps> = ({ children, current }) => (
  <div
    className={`cluster-update-plugin__channel-name ${
      current ? 'cluster-update-plugin__channel-name--current' : ''
    }`}
  >
    {children}
  </div>
);
