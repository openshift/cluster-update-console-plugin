import { Label, type LabelProps } from '@patternfly/react-core';
import { type FC } from 'react';

const typeColors: Record<string, LabelProps['color']> = {
  'pre-check': 'blue',
  mutation: 'orange',
  'post-check': 'teal',
  command: 'blue',
  resource: 'teal',
  metric: 'purple',
};

export const StepTypeLabel: FC<{ type: string }> = ({ type }) => (
  <Label isCompact color={typeColors[type.toLowerCase()] ?? 'grey'}>
    {type}
  </Label>
);
