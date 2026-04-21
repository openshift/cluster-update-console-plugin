import * as React from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  HourglassStartIcon,
  InProgressIcon,
  SearchIcon,
  SyncAltIcon,
  TimesCircleIcon,
  QuestionCircleIcon,
} from '@patternfly/react-icons';
import { Icon } from '@patternfly/react-core';
import { ProposalPhase } from '../../models/proposal';

type PhaseIconProps = {
  phase?: ProposalPhase | string;
};

const PhaseIcon: React.FC<PhaseIconProps> = ({ phase }) => {
  switch (phase) {
    case 'Pending':
      return (
        <Icon status="custom">
          <HourglassStartIcon />
        </Icon>
      );
    case 'Analyzing':
      return (
        <Icon status="info">
          <SearchIcon />
        </Icon>
      );
    case 'Proposed':
      return (
        <Icon status="warning">
          <ExclamationTriangleIcon />
        </Icon>
      );
    case 'Approved':
      return (
        <Icon status="info">
          <CheckCircleIcon />
        </Icon>
      );
    case 'Executing':
      return (
        <Icon status="custom">
          <InProgressIcon />
        </Icon>
      );
    case 'AwaitingSync':
      return (
        <Icon status="info">
          <SyncAltIcon />
        </Icon>
      );
    case 'Verifying':
      return (
        <Icon status="info">
          <SearchIcon />
        </Icon>
      );
    case 'Completed':
      return (
        <Icon status="success">
          <CheckCircleIcon />
        </Icon>
      );
    case 'Failed':
    case 'Denied':
      return (
        <Icon status="danger">
          <TimesCircleIcon />
        </Icon>
      );
    case 'Escalated':
      return (
        <Icon status="warning">
          <ExclamationCircleIcon />
        </Icon>
      );
    default:
      return (
        <Icon status="custom">
          <QuestionCircleIcon />
        </Icon>
      );
  }
};

export default PhaseIcon;
