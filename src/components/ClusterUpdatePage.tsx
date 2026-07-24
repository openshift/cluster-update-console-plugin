import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentTitle } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Content,
  Flex,
  FlexItem,
  Label,
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
import { useAgenticRuns } from '../hooks/useAgenticRuns';
import { I18N_NAMESPACE, LABELS, TERMINAL_PHASES } from '../utils/constants';
import { LightspeedAgenticRun, derivePhase } from '../models/agenticrun';
import { ClusterVersion } from '../models/clusterversion';
import UpdatePlanTab from './update-plan/UpdatePlanTab';
import ActivePlansTab from './active-plans/ActivePlansTab';
import './ClusterUpdatePage.css';

export default function ClusterUpdatePage() {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [activeTab, setActiveTab] = React.useState<string | number>(0);

  const [clusterVersion, cvLoaded, cvError] = useClusterVersion();
  const [agenticRunsRaw, agenticRunsLoaded, agenticRunsError] = useAgenticRuns();

  const agenticRunsAvailable = agenticRunsLoaded && !agenticRunsError;
  const agenticRuns: LightspeedAgenticRun[] = React.useMemo(
    () =>
      (agenticRunsAvailable ? (agenticRunsRaw ?? []) : []).filter(
        (p: LightspeedAgenticRun) => p.metadata?.labels?.[LABELS.updateType] !== undefined,
      ),
    [agenticRunsAvailable, agenticRunsRaw],
  );

  const activePlans = React.useMemo(
    () => agenticRuns.filter((p: LightspeedAgenticRun) => !TERMINAL_PHASES.has(derivePhase(p))),
    [agenticRuns],
  );

  const pageTitle = t('Cluster Update');
  const loading = !cvLoaded;

  return (
    <>
      <DocumentTitle>{pageTitle}</DocumentTitle>
      <PageSection hasBodyWrapper={false} className="cluster-update-plugin__header">
        <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem>
            <Title headingLevel="h1">{pageTitle}</Title>
          </FlexItem>
          <FlexItem>
            <Label className="cluster-update-plugin__preview-badge">{t('Tech preview')}</Label>
          </FlexItem>
        </Flex>
        <Content component="p" className="cluster-update-plugin__description">
          {t(
            'Review available versions, assess operator compatibility, and plan your update to newer OpenShift releases. Use Updates plan to prepare or start an update and Active update plans for in-flight work.',
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
      {agenticRunsError && (
        <PageSection hasBodyWrapper={false}>
          <Alert variant="warning" isInline title={t('Lightspeed agentic runs unavailable')}>
            {t(
              'The Lightspeed AgenticRun CRD is not installed on this cluster. AI-driven update planning features are disabled.',
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
                  <UpdatePlanTab
                    clusterVersion={clusterVersion as ClusterVersion}
                    agenticRuns={agenticRuns}
                  />
                </TabContentBody>
              </TabContent>
            </Tab>
            <Tab eventKey={1} title={<TabTitleText>{t('Active update plans')}</TabTitleText>}>
              <TabContent id="active-plans-tab">
                <TabContentBody>
                  <ActivePlansTab activePlans={activePlans} />
                </TabContentBody>
              </TabContent>
            </Tab>
          </Tabs>
        </PageSection>
      )}
    </>
  );
}
