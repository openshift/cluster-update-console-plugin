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
  Flex,
  FlexItem,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { CubesIcon, RedoIcon, SearchIcon } from '@patternfly/react-icons';
import { k8sDelete } from '@openshift-console/dynamic-plugin-sdk';
import {
  LightspeedAgenticRun,
  LightspeedAgenticRunModel,
  derivePhase,
  getPhaseDisplay,
} from '../../models/agenticrun';
import { I18N_NAMESPACE, LABELS } from '../../utils/constants';
import { compareSemVer, unsanitizeVersion } from '../../utils/version';
import { useApprovalActions } from '../../hooks/useApprovalActions';
import { useAgenticRunApprovals, useAnalysisResults } from '../../hooks/useAgenticRuns';
import PhaseLabel from '../shared/PhaseLabel';
import ApprovalPolicyWarningBanner from './ApprovalPolicyWarningBanner';
import UpdatePlanSections from './UpdatePlanSections';

type ReanalyseButtonProps = {
  agenticRun: LightspeedAgenticRun;
};

const ReanalyseButton: React.FC<ReanalyseButtonProps> = ({ agenticRun }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const canReanalyse = [
    'Proposed',
    'Analysed',
    'Failed',
    'Denied',
    'Completed',
    'Escalated',
  ].includes(derivePhase(agenticRun));

  const openModal = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
  }, []);

  const handleReanalyse = React.useCallback(async () => {
    if (!canReanalyse) return;
    setLoading(true);
    setError(null);
    try {
      await k8sDelete({
        model: LightspeedAgenticRunModel,
        resource: agenticRun,
        // Reject a deletion if the run changed after the user reviewed it.
        json: {
          preconditions: {
            uid: agenticRun.metadata?.uid,
            resourceVersion: agenticRun.metadata?.resourceVersion,
          },
        },
      });
      setIsModalOpen(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [agenticRun, canReanalyse]);

  if (!canReanalyse) return null;

  return (
    <>
      <Button
        variant="link"
        icon={<RedoIcon />}
        isDisabled={loading}
        isLoading={loading}
        onClick={openModal}
        size="sm"
      >
        {t('Re-analyse')}
      </Button>
      <Modal
        variant="small"
        isOpen={isModalOpen}
        onClose={() => !loading && setIsModalOpen(false)}
        aria-label={t('Confirm re-analysis')}
      >
        <ModalBody>
          {t(
            'This action will delete the current assessment. A new analysis path will be available shortly for a fresh analysis with up-to-date cluster data.',
          )}
          {error && (
            <Alert
              variant="danger"
              isInline
              title={t('Re-analyse failed')}
              style={{ marginTop: '16px' }}
            >
              {error}
            </Alert>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={handleReanalyse}
            isDisabled={loading}
            isLoading={loading}
          >
            {t('Confirm')}
          </Button>
          <Button variant="link" onClick={() => setIsModalOpen(false)} isDisabled={loading}>
            {t('Cancel')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

type UpdatePlanLayoutProps = {
  children: React.ReactNode;
};

const UpdatePlanLayout: React.FC<UpdatePlanLayoutProps> = ({ children }) => (
  <Stack hasGutter>
    <ApprovalPolicyWarningBanner />
    {children}
  </Stack>
);

type UpdatePlanTabProps = {
  agenticRuns: LightspeedAgenticRun[];
};

const UpdatePlanTab: React.FC<UpdatePlanTabProps> = ({ agenticRuns }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [selectedName, setSelectedName] = React.useState('');
  const [submittedNames, setSubmittedNames] = React.useState<Set<string>>(new Set());
  const [approvalsRaw] = useAgenticRunApprovals();
  const [analysisResultsRaw] = useAnalysisResults();
  const analysisResults = analysisResultsRaw ?? [];

  const selectedRun = React.useMemo(
    () => agenticRuns.find((p) => p.metadata?.name === selectedName),
    [agenticRuns, selectedName],
  );

  const selectedApproval = React.useMemo(
    () =>
      (approvalsRaw ?? []).find(
        (a) =>
          a.metadata?.name === selectedRun?.metadata?.name &&
          a.metadata?.namespace === selectedRun?.metadata?.namespace,
      ),
    [approvalsRaw, selectedRun],
  );

  const selectedPhase = derivePhase(selectedRun);

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

  const {
    approveStage,
    error: approveError,
    inProgress,
    canApprove,
    canApproveLoading,
  } = useApprovalActions(selectedApproval);

  const handleAnalyse = React.useCallback(async () => {
    if (!selectedRun?.metadata?.name) return;
    const name = selectedRun.metadata.name;
    const ok = await approveStage('Analysis');
    if (ok) {
      setSubmittedNames((prev) => new Set(prev).add(name));
    }
  }, [selectedRun, approveStage]);

  // Recover selection when an assessment is deleted or its update path disappears.
  React.useEffect(() => {
    if (!agenticRuns.some((run) => run.metadata?.name === selectedName)) {
      setSelectedName(agenticRuns[0].metadata?.name ?? '');
    }
  }, [selectedName, agenticRuns]);

  if (agenticRuns.length === 0) {
    return (
      <UpdatePlanLayout>
        <StackItem>
          <EmptyState titleText={t('No update plans available')} headingLevel="h2" icon={CubesIcon}>
            <EmptyStateBody>
              {t(
                'Update plans are created automatically when the cluster-version-operator detects available update paths.',
              )}
            </EmptyStateBody>
          </EmptyState>
        </StackItem>
      </UpdatePlanLayout>
    );
  }

  const showAnalyseButton = selectedPhase === 'Pending';

  return (
    <UpdatePlanLayout>
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
                    isDisabled={inProgress || !selectedApproval || !canApprove || canApproveLoading}
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

      {selectedRun && (
        <UpdatePlanSections
          key={selectedRun.metadata?.uid ?? selectedName}
          agenticRun={selectedRun}
          analysisResults={analysisResults}
          submitted={submittedNames.has(selectedName)}
          reanalyseButton={<ReanalyseButton agenticRun={selectedRun} />}
        />
      )}
    </UpdatePlanLayout>
  );
};

export default UpdatePlanTab;
