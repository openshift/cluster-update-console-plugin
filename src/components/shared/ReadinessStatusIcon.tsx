import * as React from 'react';
import { Icon } from '@patternfly/react-core';
import { CheckCircleIcon, ExclamationTriangleIcon, TimesCircleIcon } from '@patternfly/react-icons';

type StatusType = 'pass' | 'success' | 'warn' | 'warning' | 'fail' | 'error' | 'danger';

type ReadinessStatusIconProps = {
  status: StatusType;
};

const ReadinessStatusIcon: React.FC<ReadinessStatusIconProps> = ({ status }) => {
  switch (status) {
    case 'pass':
    case 'success':
      return (
        <Icon status="success">
          <CheckCircleIcon />
        </Icon>
      );
    case 'warn':
    case 'warning':
      return (
        <Icon status="warning">
          <ExclamationTriangleIcon />
        </Icon>
      );
    case 'fail':
    case 'error':
    case 'danger':
      return (
        <Icon status="danger">
          <TimesCircleIcon />
        </Icon>
      );
    default:
      return null;
  }
};

export default ReadinessStatusIcon;
