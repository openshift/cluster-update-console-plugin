import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
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
import { RedoIcon, SearchIcon } from '@patternfly/react-icons';
import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterVersion } from '../../models/clusterversion';
import {
  LightspeedProposal,
  LightspeedProposalModel,
  LightspeedAnalysisResult,
  ACTIVE_PROPOSAL_PHASES,
  derivePhase,
  getAnalysisDataFromResult,
  getPhaseDisplay,
} from '../../models/proposal';
import { I18N_NAMESPACE, LABELS } from '../../utils/constants';
import { unsanitizeVersion } from '../../utils/version';
import { useApprovalActions } from '../../hooks/useApprovalActions';
import {
  useProposalApprovals,
  useAnalysisResults,
} from '../../hooks/useUpdateProposals';
import PhaseLabel from '../shared/PhaseLabel';
import PlanHeader from './PlanHeader';
import AnalysisResultView from './AnalysisResultView';
import DecisionActions from './DecisionActions';

type ReanalyseButtonProps = {
  proposal: LightspeedProposal;
};

const ReanalyseButton: React.FC<ReanalyseButtonProps> = ({ proposal }) => {
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
        const hasExisting = !!proposal.spec?.revisionFeedback;
        await k8sPatch({
          data: [
            {
              op: hasExisting ? 'replace' : 'add',
              path: '/spec/revisionFeedback',
              value: `Re-analyse requested at ${timestamp}`,
            },
          ],
          model: LightspeedProposalModel,
          resource: proposal,
        });
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [proposal],
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
        <Alert variant="danger" isInline isPlain title={t('Re-analyse failed')} style={{ marginTop: '4px' }}>
          {error}
        </Alert>
      )}
    </>
  );
};

type UpdatePlanTabProps = {
  clusterVersion: ClusterVersion;
  proposals: LightspeedProposal[];
};

const UpdatePlanTab: React.FC<UpdatePlanTabProps> = ({
  clusterVersion,
  proposals,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [selectedName, setSelectedName] = React.useState('');
  const [expandedPanels, setExpandedPanels] = React.useState<Set<string>>(new Set());
  const [submittedNames, setSubmittedNames] = React.useState<Set<string>>(new Set());
  const [approvalsRaw] = useProposalApprovals();
  const approvals = approvalsRaw ?? [];
  const [analysisResultsRaw] = useAnalysisResults();
  const analysisResults = analysisResultsRaw ?? [];

  const selectedProposal = React.useMemo(
    () => proposals.find((p) => p.metadata?.name === selectedName),
    [proposals, selectedName],
  );

  const selectedApproval = React.useMemo(
    () =>
      approvals.find(
        (a) =>
          a.metadata?.name === selectedProposal?.metadata?.name &&
          a.metadata?.namespace === selectedProposal?.metadata?.namespace,
      ),
    [approvals, selectedProposal],
  );

  const selectedPhase = derivePhase(selectedProposal);

  // All proposals that are active (analyzing, analyzed, or just submitted)
  const activeProposals = React.useMemo(
    () => proposals.filter((p) => {
      const phase = derivePhase(p);
      if (ACTIVE_PROPOSAL_PHASES.has(phase)) return true;
      if (submittedNames.has(p.metadata?.name ?? '')) return true;
      return false;
    }),
    [proposals, submittedNames],
  );

  // Clear submitted tracking once the real phase kicks in
  React.useEffect(() => {
    if (submittedNames.size === 0) return;
    const stillPending = new Set<string>();
    submittedNames.forEach((name) => {
      const p = proposals.find((pr) => pr.metadata?.name === name);
      if (p && derivePhase(p) === 'Pending') stillPending.add(name);
    });
    if (stillPending.size < submittedNames.size) setSubmittedNames(stillPending);
  }, [proposals, submittedNames]);

  // Auto-expand newly analysed proposals
  React.useEffect(() => {
    if (activeProposals.length > 0) {
      setExpandedPanels((prev) => {
        const next = new Set(prev);
        activeProposals.forEach((p) => {
          if (p.metadata?.name) next.add(p.metadata.name);
        });
        return next;
      });
    }
  }, [activeProposals]);

  const { approveStage, error: approveError, inProgress } = useApprovalActions(selectedApproval);

  const handleAnalyse = React.useCallback(async () => {
    if (!selectedProposal?.metadata?.name) return;
    const name = selectedProposal.metadata.name;
    const ok = await approveStage('Analysis');
    if (ok) {
      setSubmittedNames((prev) => new Set(prev).add(name));
      setExpandedPanels((prev) => new Set(prev).add(name));
    }
  }, [selectedProposal, approveStage]);

  // Auto-select first proposal if none selected
  React.useEffect(() => {
    if (!selectedName && proposals.length > 0) {
      setSelectedName(proposals[0].metadata?.name ?? '');
    }
  }, [selectedName, proposals]);

  const togglePanel = React.useCallback((name: string) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  if (proposals.length === 0) {
    return (
      <Content component="p">{t('No update proposals available.')}</Content>
    );
  }

  const showAnalyseButton = selectedPhase === 'Pending';

  return (
    <Stack hasGutter>
      {/* Proposal selector */}
      <StackItem>
        <Card>
          <CardTitle>{t('Select Update Path')}</CardTitle>
          <CardBody>
            <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapMd' }}>
              <FlexItem grow={{ default: 'grow' }} style={{ maxWidth: '400px' }}>
                <FormSelect
                  value={selectedName}
                  onChange={(_event, value) => setSelectedName(value)}
                  aria-label={t('Select proposal')}
                >
                  {proposals.map((p) => {
                    const rawTarget = p.metadata?.labels?.[LABELS.targetVersion] ?? '';
                    const target = rawTarget ? unsanitizeVersion(rawTarget) : p.metadata?.name ?? '';
                    const updateType = p.metadata?.labels?.[LABELS.updateType] ?? '';
                    const pPhase = derivePhase(p);
                    const suffix = pPhase !== 'Pending' ? ` (${getPhaseDisplay(pPhase).label})` : '';
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
              <Content component="p" style={{ color: 'var(--pf-t--global--color--status--danger--default)', marginTop: '8px' }}>
                {approveError}
              </Content>
            )}
          </CardBody>
        </Card>
      </StackItem>

      {/* Analysed proposals as expandable panels */}
      {activeProposals.map((proposal) => {
        const name = proposal.metadata?.name ?? '';
        const rawTarget = proposal.metadata?.labels?.[LABELS.targetVersion] ?? '';
        const target = rawTarget ? unsanitizeVersion(rawTarget) : name;
        const pPhase = derivePhase(proposal);
        const phaseDisplay = getPhaseDisplay(pPhase);

        const resultRef = (proposal.status?.steps?.analysis?.results?.[0] as { name?: string })?.name;
        const result = resultRef
          ? analysisResults.find(
              (r: LightspeedAnalysisResult) =>
                r.metadata?.name === resultRef &&
                r.metadata?.namespace === proposal.metadata?.namespace,
            )
          : undefined;
        const resultData = getAnalysisDataFromResult(result);
        const readinessSummary = resultData.components.find((c) => c.type === 'ota_readiness_summary');
        const decision = (readinessSummary as Record<string, unknown>)?.decision as string | undefined
          ?? resultData.analysisData?.decision as string | undefined;

        return (
          <StackItem key={name}>
            <ExpandableSection
              toggleContent={
                <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
                  <FlexItem>
                    <strong>{t('Update to {{version}}', { version: target })}</strong>
                  </FlexItem>
                  <FlexItem>
                    <Label color={phaseDisplay.color} isCompact>{phaseDisplay.label}</Label>
                  </FlexItem>
                  {decision && (
                    <FlexItem>
                      <Label
                        color={decision === 'recommend' ? 'green' : decision === 'caution' ? 'orange' : decision === 'block' ? 'red' : 'purple'}
                        isCompact
                      >
                        {(decision as string).toUpperCase()}
                      </Label>
                    </FlexItem>
                  )}
                  <FlexItem>
                    <ReanalyseButton proposal={proposal} />
                  </FlexItem>
                </Flex>
              }
              isExpanded={expandedPanels.has(name)}
              onToggle={() => togglePanel(name)}
              isIndented
            >
              <Stack hasGutter>
                <StackItem>
                  <PlanHeader proposal={proposal} />
                </StackItem>
                {(pPhase === 'Analyzing' || (pPhase === 'Pending' && submittedNames.has(name))) ? (
                  <StackItem>
                    <Card>
                      <CardBody>
                        <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapMd' }}>
                          <FlexItem>
                            <Spinner size="lg" aria-label={t('Analyzing')} />
                          </FlexItem>
                          <FlexItem>
                            <Stack>
                              <StackItem>
                                <strong>
                                  {proposal.status?.steps?.analysis?.sandbox?.claimName
                                    ? t('AI agent is analysing cluster readiness...')
                                    : t('Starting analysis — waiting for agent sandbox...')}
                                </strong>
                              </StackItem>
                              {proposal.status?.steps?.analysis?.sandbox?.claimName && (
                                <StackItem>
                                  <Content component="small">
                                    {t('Sandbox: {{name}}', { name: proposal.status.steps.analysis.sandbox.claimName })}
                                    {' — '}
                                    <a
                                      href={`/k8s/ns/${proposal.status.steps.analysis.sandbox.namespace ?? 'openshift-lightspeed'}/pods/${proposal.status.steps.analysis.sandbox.claimName}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {t('View pod logs')}
                                    </a>
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
                      {(proposal.status?.conditions as { type: string; message: string }[])
                        ?.find((c) => c.type === 'Analyzed')?.message ?? t('Unknown error')}
                    </Alert>
                  </StackItem>
                ) : (
                  <>
                    <StackItem>
                      {(resultData.components.length > 0 || resultData.analysisData) ? (
                        <AnalysisResultView analysisData={resultData} />
                      ) : (
                        <Content component="p">{t('Analysis result not yet available.')}</Content>
                      )}
                    </StackItem>
                    <StackItem>
                      <DecisionActions proposal={proposal} clusterVersion={clusterVersion} />
                    </StackItem>
                  </>
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
