import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  EmptyState,
  EmptyStateBody,
  ExpandableSection,
  Flex,
  FlexItem,
  FormSelect,
  FormSelectOption,
  Label,
  Spinner,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { CubesIcon, RedoIcon, SearchIcon } from '@patternfly/react-icons';
import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterVersion } from '../../models/clusterversion';
import { Link } from 'react-router';
import {
  LightspeedAgenticRun,
  LightspeedAgenticRunModel,
  LightspeedAnalysisResult,
  ACTIVE_AGENTIC_RUN_PHASES,
  derivePhase,
  getAnalysisDataFromResult,
  getDecisionDisplay,
  getPhaseDisplay,
} from '../../models/agenticrun';
import { I18N_NAMESPACE, LABELS } from '../../utils/constants';
import { compareSemVer, unsanitizeVersion } from '../../utils/version';
import { useApprovalActions } from '../../hooks/useApprovalActions';
import { useAgenticRunApprovals, useAnalysisResults } from '../../hooks/useAgenticRuns';
import PhaseLabel from '../shared/PhaseLabel';
import PlanHeader from './PlanHeader';
import AnalysisResultView from './AnalysisResultView';
// TODO: Re-enable DecisionActions post-TP
// import DecisionActions from './DecisionActions';

type ReanalyseButtonProps = {
  agenticRun: LightspeedAgenticRun;
};

const ReanalyseButton: React.FC<ReanalyseButtonProps> = ({ agenticRun }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleReanalyse = React.useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setLoading(true);
      setError(null);
      try {
        const timestamp = new Date().toISOString();
        const hasExisting = !!agenticRun.spec?.revisionFeedback;
        await k8sPatch({
          data: [
            {
              op: hasExisting ? 'replace' : 'add',
              path: '/spec/revisionFeedback',
              value: `Re-analyse requested at ${timestamp}`,
            },
          ],
          model: LightspeedAgenticRunModel,
          resource: agenticRun,
        });
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [agenticRun],
  );

  return (
    <>
      <Button
        variant="link"
        icon={<RedoIcon />}
        isDisabled={loading}
        isLoading={loading}
        onClick={handleReanalyse}
        size="sm"
      >
        {t('Re-analyse')}
      </Button>
      {error && (
        <Alert
          variant="danger"
          isInline
          isPlain
          title={t('Re-analyse failed')}
          style={{ marginTop: '4px' }}
        >
          {error}
        </Alert>
      )}
    </>
  );
};

type UpdatePlanTabProps = {
  clusterVersion: ClusterVersion;
  agenticRuns: LightspeedAgenticRun[];
};

const UpdatePlanTab: React.FC<UpdatePlanTabProps> = ({ agenticRuns }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [selectedName, setSelectedName] = React.useState('');
  const [expandedPanels, setExpandedPanels] = React.useState<Set<string>>(new Set());
  const userCollapsedRef = React.useRef<Set<string>>(new Set());
  const [submittedNames, setSubmittedNames] = React.useState<Set<string>>(new Set());
  const [approvalsRaw] = useAgenticRunApprovals();
  const approvals = approvalsRaw ?? [];
  const [analysisResultsRaw] = useAnalysisResults();
  const analysisResults = analysisResultsRaw ?? [];

  const selectedRun = React.useMemo(
    () => agenticRuns.find((p) => p.metadata?.name === selectedName),
    [agenticRuns, selectedName],
  );

  const selectedApproval = React.useMemo(
    () =>
      approvals.find(
        (a) =>
          a.metadata?.name === selectedRun?.metadata?.name &&
          a.metadata?.namespace === selectedRun?.metadata?.namespace,
      ),
    [approvals, selectedRun],
  );

  const selectedPhase = derivePhase(selectedRun);

  // All runs that are active (analyzing, analyzed, or just submitted)
  const activeRuns = React.useMemo(
    () =>
      agenticRuns.filter((p) => {
        const phase = derivePhase(p);
        if (ACTIVE_AGENTIC_RUN_PHASES.has(phase)) return true;
        if (submittedNames.has(p.metadata?.name ?? '')) return true;
        return false;
      }),
    [agenticRuns, submittedNames],
  );

  // Clear submitted tracking once the real phase kicks in
  React.useEffect(() => {
    if (submittedNames.size === 0) return;
    const stillPending = new Set<string>();
    submittedNames.forEach((name) => {
      const p = agenticRuns.find((pr) => pr.metadata?.name === name);
      if (p && derivePhase(p) === 'Pending') stillPending.add(name);
    });
    if (stillPending.size < submittedNames.size) setSubmittedNames(stillPending);
  }, [agenticRuns, submittedNames]);

  // Auto-expand newly active runs unless the user manually collapsed them
  React.useEffect(() => {
    if (activeRuns.length > 0) {
      setExpandedPanels((prev) => {
        const next = new Set(prev);
        activeRuns.forEach((p) => {
          const name = p.metadata?.name;
          if (name && !userCollapsedRef.current.has(name)) next.add(name);
        });
        return next;
      });
    }
  }, [activeRuns]);

  const { approveStage, error: approveError, inProgress } = useApprovalActions(selectedApproval);

  const handleAnalyse = React.useCallback(async () => {
    if (!selectedRun?.metadata?.name) return;
    const name = selectedRun.metadata.name;
    const ok = await approveStage('Analysis');
    if (ok) {
      setSubmittedNames((prev) => new Set(prev).add(name));
      setExpandedPanels((prev) => new Set(prev).add(name));
    }
  }, [selectedRun, approveStage]);

  // Auto-select first run if none selected
  React.useEffect(() => {
    if (!selectedName && agenticRuns.length > 0) {
      setSelectedName(agenticRuns[0].metadata?.name ?? '');
    }
  }, [selectedName, agenticRuns]);

  const togglePanel = React.useCallback((name: string) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
        userCollapsedRef.current.add(name);
      } else {
        next.add(name);
        userCollapsedRef.current.delete(name);
      }
      return next;
    });
  }, []);

  if (agenticRuns.length === 0) {
    return (
      <EmptyState titleText={t('No update plans available')} headingLevel="h2" icon={CubesIcon}>
        <EmptyStateBody>
          {t(
            'Update plans are created automatically when the cluster-version-operator detects available update paths.',
          )}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  const showAnalyseButton = selectedPhase === 'Pending';

  return (
    <Stack hasGutter>
      {/* Run selector */}
      <StackItem>
        <Card>
          <CardTitle>{t('Select Update Path')}</CardTitle>
          <CardBody>
            <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapMd' }}>
              <FlexItem grow={{ default: 'grow' }} style={{ maxWidth: '400px' }}>
                <FormSelect
                  value={selectedName}
                  onChange={(_event, value) => setSelectedName(value)}
                  aria-label={t('Select agentic run')}
                >
                  {[...agenticRuns]
                    .sort((a, b) => {
                      const vA = unsanitizeVersion(
                        a.metadata?.labels?.[LABELS.targetVersion] ?? '',
                      );
                      const vB = unsanitizeVersion(
                        b.metadata?.labels?.[LABELS.targetVersion] ?? '',
                      );
                      return compareSemVer(vA, vB);
                    })
                    .map((p) => {
                      const rawTarget = p.metadata?.labels?.[LABELS.targetVersion] ?? '';
                      const target = rawTarget
                        ? unsanitizeVersion(rawTarget)
                        : (p.metadata?.name ?? '');
                      const updateType = p.metadata?.labels?.[LABELS.updateType] ?? '';
                      const pPhase = derivePhase(p);
                      const suffix =
                        pPhase !== 'Pending' ? ` (${getPhaseDisplay(pPhase).label})` : '';
                      return (
                        <FormSelectOption
                          key={p.metadata?.name}
                          value={p.metadata?.name ?? ''}
                          label={`${target} — ${updateType}${suffix}`}
                        />
                      );
                    })}
                </FormSelect>
              </FlexItem>
              <FlexItem>
                <PhaseLabel phase={selectedPhase} />
              </FlexItem>
              {showAnalyseButton && (
                <FlexItem>
                  <Button
                    variant="primary"
                    icon={<SearchIcon />}
                    isDisabled={inProgress || !selectedApproval}
                    isLoading={inProgress}
                    onClick={handleAnalyse}
                  >
                    {t('Analyse')}
                  </Button>
                </FlexItem>
              )}
            </Flex>
            {approveError && (
              <Content
                component="p"
                style={{
                  color: 'var(--pf-t--global--color--status--danger--default)',
                  marginTop: '8px',
                }}
              >
                {approveError}
              </Content>
            )}
          </CardBody>
        </Card>
      </StackItem>

      {/* Selected run's expandable panel */}
      {activeRuns
        .filter((r) => r.metadata?.name === selectedName)
        .map((agenticRun) => {
          const name = agenticRun.metadata?.name ?? '';
          const rawTarget = agenticRun.metadata?.labels?.[LABELS.targetVersion] ?? '';
          const target = rawTarget ? unsanitizeVersion(rawTarget) : name;
          const pPhase = derivePhase(agenticRun);
          const phaseDisplay = getPhaseDisplay(pPhase);

          const resultRef = (agenticRun.status?.steps?.analysis?.results?.[0] as { name?: string })
            ?.name;
          const result = resultRef
            ? analysisResults.find(
                (r: LightspeedAnalysisResult) =>
                  r.metadata?.name === resultRef &&
                  r.metadata?.namespace === agenticRun.metadata?.namespace,
              )
            : undefined;
          const resultData = getAnalysisDataFromResult(result);
          const readinessSummary = resultData.components.find(
            (c) => c.type === 'ota_readiness_summary',
          );
          const decision =
            ((readinessSummary as Record<string, unknown>)?.decision as string | undefined) ??
            (resultData.analysisData?.decision as string | undefined);
          const decisionDisplay = decision ? getDecisionDisplay(decision) : undefined;

          return (
            <StackItem key={name}>
              <ExpandableSection
                toggleContent={
                  <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
                    <FlexItem>
                      <strong>{t('Update to {{version}}', { version: target })}</strong>
                    </FlexItem>
                    <FlexItem>
                      <Label color={phaseDisplay.color} isCompact>
                        {phaseDisplay.label}
                      </Label>
                    </FlexItem>
                    {decisionDisplay && pPhase !== 'Analyzing' && (
                      <FlexItem>
                        <Label color={decisionDisplay.color} isCompact>
                          {decisionDisplay.label}
                        </Label>
                      </FlexItem>
                    )}
                    <FlexItem>
                      <ReanalyseButton agenticRun={agenticRun} />
                    </FlexItem>
                  </Flex>
                }
                isExpanded={expandedPanels.has(name)}
                onToggle={() => togglePanel(name)}
                isIndented
              >
                <Stack hasGutter>
                  <StackItem>
                    <PlanHeader agenticRun={agenticRun} />
                  </StackItem>
                  {pPhase === 'Analyzing' || (pPhase === 'Pending' && submittedNames.has(name)) ? (
                    <StackItem>
                      <Card>
                        <CardBody>
                          <Flex
                            alignItems={{ default: 'alignItemsCenter' }}
                            gap={{ default: 'gapMd' }}
                          >
                            <FlexItem>
                              <Spinner size="lg" aria-label={t('Analyzing')} />
                            </FlexItem>
                            <FlexItem>
                              <Stack>
                                <StackItem>
                                  <strong>
                                    {agenticRun.status?.steps?.analysis?.sandbox?.claimName
                                      ? t('AI agent is analysing cluster readiness...')
                                      : t('Starting analysis — waiting for agent sandbox...')}
                                  </strong>
                                </StackItem>
                                {agenticRun.status?.steps?.analysis?.sandbox?.claimName && (
                                  <StackItem>
                                    <Content component="small">
                                      {t('Sandbox: {{name}}', {
                                        name: agenticRun.status.steps.analysis.sandbox.claimName,
                                      })}
                                      {' — '}
                                      <Link
                                        to={`/k8s/ns/${agenticRun.status.steps.analysis.sandbox.namespace ?? 'openshift-lightspeed'}/pods/${agenticRun.status.steps.analysis.sandbox.claimName}/logs`}
                                      >
                                        {t('View pod logs')}
                                      </Link>
                                    </Content>
                                  </StackItem>
                                )}
                              </Stack>
                            </FlexItem>
                          </Flex>
                        </CardBody>
                      </Card>
                    </StackItem>
                  ) : pPhase === 'Failed' ? (
                    <StackItem>
                      <Alert variant="danger" isInline title={t('Analysis failed')}>
                        {(
                          agenticRun.status?.conditions as { type: string; message: string }[]
                        )?.find((c) => c.type === 'Analyzed')?.message ?? t('Unknown error')}
                      </Alert>
                    </StackItem>
                  ) : (
                    <StackItem>
                      {resultData.components.length > 0 || resultData.analysisData ? (
                        <AnalysisResultView analysisData={resultData} />
                      ) : (
                        <Content component="p">{t('Analysis result not yet available.')}</Content>
                      )}
                    </StackItem>
                  )}
                </Stack>
              </ExpandableSection>
            </StackItem>
          );
        })}
    </Stack>
  );
};

export default UpdatePlanTab;
