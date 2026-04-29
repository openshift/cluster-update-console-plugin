import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { Flex, FlexItem, Label } from '@patternfly/react-core';
import { ArrowRightIcon } from '@patternfly/react-icons';
import { LightspeedProposal } from '../../models/proposal';
import { I18N_NAMESPACE, LABELS } from '../../utils/constants';
import { getUpdateType, unsanitizeVersion } from '../../utils/version';

type PlanHeaderProps = {
  proposal: LightspeedProposal;
};

const PlanHeader: React.FC<PlanHeaderProps> = ({ proposal }) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const labels = proposal.metadata?.labels ?? {};
  const rawCurrent = labels[LABELS.currentVersion] ?? '';
  const rawTarget = labels[LABELS.targetVersion] ?? '';
  const currentVersion = rawCurrent ? unsanitizeVersion(rawCurrent) : t('unknown');
  const targetVersion = rawTarget ? unsanitizeVersion(rawTarget) : t('unknown');
  const updateType = labels[LABELS.updateType] ?? getUpdateType(currentVersion, targetVersion);

  const creationTimestamp = proposal.metadata?.creationTimestamp;

  return (
    <div className="cluster-update-plugin__plan-header">
      <div className="cluster-update-plugin__plan-header-meta">
        {t('Generated')} <Timestamp timestamp={creationTimestamp} />
      </div>
      <Flex alignItems={{ default: 'alignItemsCenter' }}>
        <FlexItem>
          <span className="cluster-update-plugin__plan-header-versions">
            {t('Proposed Update: {{current}}', { current: currentVersion })}
            <span className="cluster-update-plugin__plan-header-arrow">
              <ArrowRightIcon />
            </span>
            {targetVersion}
          </span>
        </FlexItem>
        <FlexItem className="cluster-update-plugin__plan-header-badge">
          <Label color="blue" isCompact>
            {updateType === 'z-stream'
              ? t('z-stream')
              : updateType === 'minor'
                ? t('Minor')
                : t('Update')}
          </Label>
        </FlexItem>
      </Flex>
    </div>
  );
};

export default PlanHeader;
