import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Bullseye, Spinner, Stack, StackItem } from '@patternfly/react-core';
import { ClusterVersion } from '../../models/clusterversion';
import { LightspeedProposal } from '../../models/proposal';
import { I18N_NAMESPACE } from '../../utils/constants';
import NoActivePlanView from './NoActivePlanView';
import ActivePlanView from './ActivePlanView';

type UpdatePlanTabProps = {
  clusterVersion: ClusterVersion;
  proposals: LightspeedProposal[];
  activeProposal?: LightspeedProposal;
};

const UpdatePlanTab: React.FC<UpdatePlanTabProps> = ({
  clusterVersion,
  proposals,
  activeProposal,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const phase = activeProposal?.status?.phase;

  if (!activeProposal) {
    return <NoActivePlanView clusterVersion={clusterVersion} proposals={proposals} />;
  }

  if (phase === 'Pending' || phase === 'Analyzing') {
    return (
      <Bullseye>
        <Stack hasGutter>
          <StackItem>
            <Bullseye>
              <Spinner aria-label={t('Analyzing')} />
            </Bullseye>
          </StackItem>
          <StackItem>
            <Bullseye>{t('AI is analyzing your cluster for upgrade readiness...')}</Bullseye>
          </StackItem>
        </Stack>
      </Bullseye>
    );
  }

  return <ActivePlanView proposal={activeProposal} clusterVersion={clusterVersion} />;
};

export default UpdatePlanTab;
