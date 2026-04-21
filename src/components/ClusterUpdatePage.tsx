import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentTitle } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Content,
  PageSection,
  Spinner,
  Tab,
  TabContent,
  TabContentBody,
  Tabs,
  TabTitleText,
  Title,
} from '@patternfly/react-core';
import { useClusterVersion } from '../hooks/useClusterVersion';
import { useUpdateProposals } from '../hooks/useUpdateProposals';
import { I18N_NAMESPACE, LABELS, isTerminalPhase } from '../utils/constants';
import { LightspeedProposal } from '../models/proposal';
import { ClusterVersion } from '../models/clusterversion';
import UpdatePlanTab from './update-plan/UpdatePlanTab';
import ActivePlansTab from './active-plans/ActivePlansTab';
import UpdateHistoryTab from './update-history/UpdateHistoryTab';
import './ClusterUpdatePage.css';

export default function ClusterUpdatePage() {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [activeTab, setActiveTab] = React.useState<string | number>(0);

  const [clusterVersion, cvLoaded, cvError] = useClusterVersion();
  const [proposalsRaw, proposalsLoaded, proposalsError] = useUpdateProposals();

  const proposalsAvailable = proposalsLoaded && !proposalsError;
  const proposals: LightspeedProposal[] = React.useMemo(
    () =>
      (proposalsAvailable ? (proposalsRaw ?? []) : []).filter(
        (p: LightspeedProposal) => p.metadata?.labels?.[LABELS.updateType] !== undefined,
      ),
    [proposalsAvailable, proposalsRaw],
  );

  const activePlans = React.useMemo(
    () => proposals.filter((p: LightspeedProposal) => !isTerminalPhase(p.status?.phase)),
    [proposals],
  );
  const activeProposal = activePlans[0];

  const pageTitle = t('Cluster Update');
  const loading = !cvLoaded;

  return (
    <>
      <DocumentTitle>{pageTitle}</DocumentTitle>
      <PageSection hasBodyWrapper={false} className="cluster-update-plugin__header">
        <Title headingLevel="h1">{pageTitle}</Title>
        <Content component="p" className="cluster-update-plugin__description">
          {t(
            'Review available versions, assess operator compatibility, and plan how this cluster version is newer OpenShift releases. Use Updates plan to prepare or start an update, Active update plans for in-flight work, and Update history for completed ones.',
          )}
        </Content>
      </PageSection>
      {cvError && (
        <PageSection hasBodyWrapper={false}>
          <Alert variant="danger" isInline title={t('Error loading cluster version')}>
            {String(cvError)}
          </Alert>
        </PageSection>
      )}
      {proposalsError && (
        <PageSection hasBodyWrapper={false}>
          <Alert variant="warning" isInline title={t('Lightspeed proposals unavailable')}>
            {t(
              'The Lightspeed Proposal CRD is not installed on this cluster. AI-driven update planning features are disabled.',
            )}
          </Alert>
        </PageSection>
      )}
      {loading ? (
        <PageSection hasBodyWrapper={false}>
          <Spinner aria-label={t('Loading')} />
        </PageSection>
      ) : (
        <PageSection hasBodyWrapper={false} className="cluster-update-plugin__tabs">
          <Tabs
            activeKey={activeTab}
            onSelect={(_event, tabIndex) => setActiveTab(tabIndex)}
            usePageInsets
          >
            <Tab eventKey={0} title={<TabTitleText>{t('Updates plan')}</TabTitleText>}>
              <TabContent id="updates-plan-tab">
                <TabContentBody>
                  {activeTab === 0 && (
                    <UpdatePlanTab
                      clusterVersion={clusterVersion as ClusterVersion}
                      proposals={proposals as LightspeedProposal[]}
                      activeProposal={activeProposal}
                    />
                  )}
                </TabContentBody>
              </TabContent>
            </Tab>
            <Tab eventKey={1} title={<TabTitleText>{t('Active update plans')}</TabTitleText>}>
              <TabContent id="active-plans-tab">
                <TabContentBody>
                  {activeTab === 1 && <ActivePlansTab activePlans={activePlans} />}
                </TabContentBody>
              </TabContent>
            </Tab>
            <Tab eventKey={2} title={<TabTitleText>{t('Update history')}</TabTitleText>}>
              <TabContent id="update-history-tab">
                <TabContentBody>
                  {activeTab === 2 && (
                    <UpdateHistoryTab clusterVersion={clusterVersion as ClusterVersion} />
                  )}
                </TabContentBody>
              </TabContent>
            </Tab>
          </Tabs>
        </PageSection>
      )}
    </>
  );
}
