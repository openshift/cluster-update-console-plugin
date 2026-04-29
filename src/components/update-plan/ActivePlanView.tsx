import * as React from 'react';
import { Stack, StackItem } from '@patternfly/react-core';
import { LightspeedProposal, getAnalysisData } from '../../models/proposal';
import { ClusterVersion } from '../../models/clusterversion';
import PlanHeader from './PlanHeader';
import PlanStepChecklist from './PlanStepChecklist';
import ClusterMetrics from './ClusterMetrics';
import CompatibilityTable from './CompatibilityTable';
import OLMOperators from './OLMOperators';
import APIDeprecations from './APIDeprecations';
import RiskAssessment from './RiskAssessment';
import MaintenanceWindow from './MaintenanceWindow';
import DecisionActions from './DecisionActions';
import PrerequisitesSidebar from './PrerequisitesSidebar';
import './update-plan.css';

type ActivePlanViewProps = {
  proposal: LightspeedProposal;
  clusterVersion: ClusterVersion;
};

const ActivePlanView: React.FC<ActivePlanViewProps> = ({ proposal, clusterVersion }) => {
  const analysisData = React.useMemo(() => getAnalysisData(proposal), [proposal]);

  return (
    <div className="cluster-update-plugin__active-plan">
      <PlanHeader proposal={proposal} />
      <RiskAssessment analysisData={analysisData} />
      <div className="cluster-update-plugin__plan-main">
        <div className="cluster-update-plugin__plan-content">
          <Stack hasGutter>
            <StackItem>
              <PlanStepChecklist analysisData={analysisData} />
            </StackItem>
            <StackItem>
              <ClusterMetrics />
            </StackItem>
            <StackItem>
              <CompatibilityTable analysisData={analysisData} />
            </StackItem>
            <StackItem>
              <OLMOperators analysisData={analysisData} />
            </StackItem>
            <StackItem>
              <APIDeprecations analysisData={analysisData} />
            </StackItem>
            <StackItem>
              <MaintenanceWindow analysisData={analysisData} />
            </StackItem>
            <StackItem>
              <DecisionActions proposal={proposal} clusterVersion={clusterVersion} />
            </StackItem>
          </Stack>
        </div>
        <div className="cluster-update-plugin__plan-sidebar">
          <PrerequisitesSidebar analysisData={analysisData} />
        </div>
      </div>
    </div>
  );
};

export default ActivePlanView;
