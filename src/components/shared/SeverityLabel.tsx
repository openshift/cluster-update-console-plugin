import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@patternfly/react-core';
import { SEVERITY_COLORS, SEVERITY_LABELS } from '../../models/proposal';
import { I18N_NAMESPACE } from '../../utils/constants';

type SeverityLabelProps = {
  severity: string;
};

const SeverityLabel: React.FC<SeverityLabelProps> = ({ severity }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  return (
    <Label color={SEVERITY_COLORS[severity] ?? 'grey'} isCompact>
      {t(SEVERITY_LABELS[severity] ?? 'Unknown')}
    </Label>
  );
};

export default SeverityLabel;
