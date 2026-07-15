import * as React from 'react';
import { Label } from '@patternfly/react-core';
import { getPhaseDisplay, AgenticRunPhase } from '../../models/agenticrun';
import PhaseIcon from './PhaseIcon';

type PhaseLabelProps = {
  phase?: AgenticRunPhase | string;
};

const PhaseLabel: React.FC<PhaseLabelProps> = ({ phase }) => {
  const display = getPhaseDisplay(phase);

  return (
    <Label color={display.color} icon={<PhaseIcon phase={phase} />}>
      {display.label}
    </Label>
  );
};

export default PhaseLabel;
