import * as React from 'react';
import { Stack, StackItem } from '@patternfly/react-core';
import { ClusterVersion } from '../../models/clusterversion';
import { LightspeedProposal } from '../../models/proposal';
import AIAssessmentCard from './AIAssessmentCard';
import AIUpdateAgentCard from './AIUpdateAgentCard';

type NoActivePlanViewProps = {
  clusterVersion: ClusterVersion;
  proposals: LightspeedProposal[];
};

const NoActivePlanView: React.FC<NoActivePlanViewProps> = ({ clusterVersion, proposals }) => {
  const currentVersion = clusterVersion.status?.desired?.version ?? '';
  const availableUpdates = clusterVersion.status?.availableUpdates ?? [];

  return (
    <Stack hasGutter className="cluster-update-plugin__no-plan">
      <StackItem>
        <AIAssessmentCard
          currentVersion={currentVersion}
          availableCount={availableUpdates.length}
        />
      </StackItem>
      <StackItem>
        <AIUpdateAgentCard clusterVersion={clusterVersion} proposals={proposals} />
      </StackItem>
    </Stack>
  );
};

export default NoActivePlanView;
