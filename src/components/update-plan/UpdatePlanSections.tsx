import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Card,
  CardBody,
  Content,
  ExpandableSection,
  Flex,
  FlexItem,
  Icon,
  Spinner,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { BanIcon } from '@patternfly/react-icons';
import {
  AgenticRunPhase,
  LightspeedAgenticRun,
  LightspeedAnalysisResult,
  derivePhase,
  getAnalysisDataFromResult,
  getReadinessSummary,
  getFindings,
  getFailedStage,
  getPhaseDisplay,
  hasRemediationPlan,
} from '../../models/agenticrun';
import { I18N_NAMESPACE } from '../../utils/constants';
import { hasExecution } from '../../utils/execution';
import { getLogCondition, hasStepLogs, LogPhase } from '../../utils/logPhase';
import { AnalysisLogs, ExecutionLogs, VerificationLogs } from '../shared/ExecutionLogs';
import PhaseIcon from '../shared/PhaseIcon';
import AnalysisResultView from './AnalysisResultView';
import DecisionActions from './DecisionActions';
import PlanHeader from './PlanHeader';
import { ActionsTaken } from './ActionsTaken';
import { TimeoutGuidance, isStageTimeout } from './TimeoutGuidance';
import { VerificationApproval } from './VerificationApproval';

type UpdatePhaseSectionProps = {
  title: string;
  phase: AgenticRunPhase;
  skipped?: boolean;
  isExpanded: boolean;
  onToggle: (expanded: boolean) => void;
  children: React.ReactNode;
};

const UpdatePhaseSection: React.FC<UpdatePhaseSectionProps> = ({
  title,
  phase,
  skipped,
  isExpanded,
  onToggle,
  children,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const status = skipped ? t('Skipped') : getPhaseDisplay(phase).label;

  return (
    <Card>
      <CardBody>
        <ExpandableSection
          className="cluster-update-plugin__phase-section"
          toggleWrapper="h2"
          toggleContent={
            <span className="cluster-update-plugin__phase-heading">
              <span role="img" aria-label={status}>
                {skipped ? (
                  <Icon>
                    <BanIcon />
                  </Icon>
                ) : (
                  <PhaseIcon phase={phase} />
                )}
              </span>
              {title}
            </span>
          }
          isExpanded={isExpanded}
          onToggle={(_event, expanded) => onToggle(expanded)}
        >
          {children}
        </ExpandableSection>
      </CardBody>
    </Card>
  );
};

const StageLoading: React.FC<{ run: LightspeedAgenticRun; stage: LogPhase }> = ({ run, stage }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const sandbox = run.status?.steps?.[stage]?.sandbox?.claimName;
  const messages = {
    analysis: {
      label: t('Analyzing'),
      active: t('AI agent is analysing cluster readiness...'),
      waiting: t('Starting analysis — waiting for agent sandbox...'),
    },
    execution: {
      label: t('Executing'),
      active: t('AI agent is executing the selected upgrade plan...'),
      waiting: t('Starting execution — waiting for agent sandbox...'),
    },
    verification: {
      label: t('Verifying'),
      active: t('AI agent is verifying the cluster update...'),
      waiting: t('Starting verification — waiting for agent sandbox...'),
    },
  }[stage];
  return (
    <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapMd' }}>
      <FlexItem>
        <Spinner size="lg" aria-label={messages.label} />
      </FlexItem>
      <FlexItem>
        <Stack>
          <StackItem>
            <strong>{sandbox ? messages.active : messages.waiting}</strong>
          </StackItem>
          {sandbox && (
            <StackItem>
              <Content component="small">{t('Sandbox: {{name}}', { name: sandbox })}</Content>
            </StackItem>
          )}
        </Stack>
      </FlexItem>
    </Flex>
  );
};

type UpdatePlanSectionsProps = {
  agenticRun: LightspeedAgenticRun;
  analysisResults: LightspeedAnalysisResult[];
  submitted: boolean;
  reanalyseButton: React.ReactNode;
};

const UpdatePlanSections: React.FC<UpdatePlanSectionsProps> = ({
  agenticRun,
  analysisResults,
  submitted,
  reanalyseButton,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [selection, setSelection] = React.useState<{ resultKey: string; index: number }>();
  const phase = derivePhase(agenticRun);
  const stopped = phase === 'EmergencyStopped';
  const analysisTimedOut = isStageTimeout(agenticRun, 'analysis');
  const executionTimedOut = isStageTimeout(agenticRun, 'execution');
  const verificationTimedOut = isStageTimeout(agenticRun, 'verification');
  const analysisCondition = getLogCondition(agenticRun, 'analysis');
  const executionCondition = getLogCondition(agenticRun, 'execution');
  const verificationCondition = getLogCondition(agenticRun, 'verification');
  const executionSkipped = executionCondition?.reason === 'Skipped';
  const verificationSkipped = verificationCondition?.reason === 'Skipped';
  const verificationStarted = !verificationSkipped && hasStepLogs(agenticRun, 'verification');
  const verificationConfigured = !!agenticRun.spec?.verification || verificationStarted;
  const executionStarted =
    !executionSkipped &&
    (hasExecution(agenticRun) ||
      ['Approved', 'AwaitingSync', 'Verifying', 'Completed', 'Escalating', 'Escalated'].includes(
        phase,
      ));
  const activeSection =
    verificationStarted ||
    (verificationConfigured && !verificationSkipped && executionCondition?.status === 'True')
      ? 'verification'
      : executionStarted
        ? 'execution'
        : 'analysis';
  const [expanded, setExpanded] = React.useState({
    analysis: activeSection === 'analysis',
    execution: activeSection === 'execution',
    verification: activeSection === 'verification',
  });

  // Open the active phase without changing the other sections' manual toggles.
  React.useEffect(() => {
    setExpanded((prev) => ({ ...prev, [activeSection]: true }));
  }, [activeSection]);

  const analysisPhase: AgenticRunPhase =
    analysisCondition?.status === 'True'
      ? 'Completed'
      : analysisCondition?.status === 'False'
        ? 'Failed'
        : stopped
          ? 'EmergencyStopped'
          : phase === 'Analyzing' || submitted
            ? 'Analyzing'
            : 'Pending';
  const executionPhase: AgenticRunPhase =
    executionCondition?.status === 'True'
      ? 'Completed'
      : executionCondition?.status === 'False'
        ? 'Failed'
        : stopped
          ? 'EmergencyStopped'
          : executionCondition?.status === 'Unknown'
            ? 'Executing'
            : phase === 'Approved' || phase === 'Denied'
              ? phase
              : 'Pending';
  const verificationPhase: AgenticRunPhase =
    verificationCondition?.status === 'True'
      ? 'Completed'
      : verificationCondition?.status === 'False'
        ? 'Failed'
        : stopped
          ? 'EmergencyStopped'
          : verificationStarted
            ? 'Verifying'
            : 'Pending';
  const failedStage = phase === 'Failed' ? getFailedStage(agenticRun) : undefined;
  const analysisFailed = analysisPhase === 'Failed';
  const stepResults = agenticRun.status?.steps?.analysis?.results;
  const resultRef = (stepResults?.[stepResults.length - 1] as { name?: string })?.name;
  const result = resultRef
    ? analysisResults.find(
        (r) =>
          r.metadata?.name === resultRef &&
          r.metadata?.namespace === agenticRun.metadata?.namespace,
      )
    : undefined;
  const resultData = getAnalysisDataFromResult(result);
  // Selection and confirmation must refer to the exact analysis the user reviewed.
  const checklistRecheck =
    phase === 'Proposed' &&
    ((getReadinessSummary(resultData.components)?.checks?.length ?? 0) > 0 ||
      getFindings(resultData.components).length > 0);
  const resultKey = `${result?.metadata?.uid ?? resultRef}:${JSON.stringify(resultData.options)}`;
  const executableIndices = resultData.options.flatMap((option, index) =>
    option.remediationPlan ? [index] : [],
  );
  const selectedOptionIndex =
    selection?.resultKey === resultKey && executableIndices.includes(selection.index)
      ? selection.index
      : executableIndices.length === 1
        ? executableIndices[0]
        : undefined;
  const noActionRequired =
    result?.status?.actionRequired === 'False' || analysisCondition?.reason === 'NoActionRequired';
  const hasResultData =
    resultData.options.length > 0 ||
    resultData.components.length > 0 ||
    !!resultData.analysisData ||
    !!resultData.diagnosis;
  const analysisLogs = hasStepLogs(agenticRun, 'analysis') ? (
    <AnalysisLogs run={agenticRun} hideStageFailure />
  ) : null;
  const executionLoading =
    !executionSkipped && !noActionRequired && ['Approved', 'Executing'].includes(phase);
  const verificationLoading = !verificationSkipped && !noActionRequired && phase === 'Verifying';
  const executionResultName = agenticRun.status?.steps?.execution?.results?.at(-1)?.name;

  return (
    <>
      {stopped && (
        <StackItem>
          <Alert variant="warning" isInline title={t('Agentic run stopped')}>
            {agenticRun.status?.conditions?.find((entry) => entry.type === 'EmergencyStopped')
              ?.message || t('This run was stopped by the administrator.')}
          </Alert>
        </StackItem>
      )}
      <StackItem>
        <UpdatePhaseSection
          title={t('Update analysis')}
          phase={analysisPhase}
          skipped={analysisCondition?.reason === 'Skipped'}
          isExpanded={expanded.analysis}
          onToggle={(analysis) => setExpanded((prev) => ({ ...prev, analysis }))}
        >
          <Stack hasGutter>
            <StackItem>
              <Flex alignItems={{ default: 'alignItemsCenter' }}>
                <FlexItem grow={{ default: 'grow' }}>
                  <PlanHeader agenticRun={agenticRun} />
                </FlexItem>
                {phase !== 'Pending' && !checklistRecheck && <FlexItem>{reanalyseButton}</FlexItem>}
              </Flex>
            </StackItem>
            {analysisPhase === 'Analyzing' && (
              <StackItem>
                <StageLoading run={agenticRun} stage="analysis" />
              </StackItem>
            )}
            {analysisTimedOut && (
              <StackItem>
                <TimeoutGuidance run={agenticRun} stage="analysis" />
              </StackItem>
            )}
            {analysisFailed && !analysisTimedOut && (
              <StackItem>
                <Alert variant="danger" isInline title={t('Analysis failed')}>
                  {result?.status?.failureReason ??
                    analysisCondition?.message ??
                    t('Unknown error')}
                </Alert>
              </StackItem>
            )}
            {hasResultData && analysisPhase !== 'Analyzing' ? (
              <StackItem>
                <AnalysisResultView
                  key={resultKey}
                  analysisData={resultData}
                  assessedAt={result?.metadata?.creationTimestamp}
                  recheckAction={checklistRecheck ? reanalyseButton : undefined}
                  analysisLogs={analysisLogs}
                  selectedOptionIndex={selectedOptionIndex}
                  onSelectOption={
                    phase === 'Proposed' && !noActionRequired
                      ? (index) => setSelection({ resultKey, index })
                      : undefined
                  }
                />
              </StackItem>
            ) : (
              <>
                {analysisPhase !== 'Analyzing' && !analysisFailed && (
                  <StackItem>
                    <Content component="p">
                      {stopped
                        ? t('Analysis result is unavailable for this stopped run.')
                        : phase === 'Pending'
                          ? t('Select Analyse to assess cluster readiness for this update.')
                          : t('Analysis result not yet available.')}
                    </Content>
                  </StackItem>
                )}
                {analysisLogs && <StackItem>{analysisLogs}</StackItem>}
              </>
            )}
            {noActionRequired && (
              <StackItem>
                <Alert isInline variant="success" title={t('No action required')}>
                  {t('The analysis did not request remediation. No execution approval is needed.')}
                </Alert>
              </StackItem>
            )}
            {result && !noActionRequired && !hasRemediationPlan(result) && phase === 'Proposed' && (
              <StackItem>
                <Alert variant="info" isInline title={t('No remediation plan available')}>
                  {t(
                    'Analysis indicates this upgrade is not feasible. Review diagnosis for details.',
                  )}
                </Alert>
              </StackItem>
            )}
            {result && !noActionRequired && hasRemediationPlan(result) && phase === 'Proposed' && (
              <StackItem>
                <DecisionActions
                  key={`${resultKey}:${selectedOptionIndex}`}
                  agenticRun={agenticRun}
                  selectedOptionIndex={selectedOptionIndex}
                  selectedOption={
                    selectedOptionIndex === undefined
                      ? undefined
                      : resultData.options[selectedOptionIndex]
                  }
                />
              </StackItem>
            )}
          </Stack>
        </UpdatePhaseSection>
      </StackItem>
      <StackItem>
        <UpdatePhaseSection
          title={t('Update execution')}
          phase={executionPhase}
          skipped={executionSkipped || noActionRequired}
          isExpanded={expanded.execution}
          onToggle={(execution) => setExpanded((prev) => ({ ...prev, execution }))}
        >
          <Stack hasGutter>
            {executionLoading && (
              <StackItem>
                <StageLoading run={agenticRun} stage="execution" />
              </StackItem>
            )}
            {executionTimedOut && (
              <StackItem>
                <TimeoutGuidance run={agenticRun} stage="execution" />
              </StackItem>
            )}
            {failedStage &&
              !analysisFailed &&
              failedStage.label !== 'Verification' &&
              !executionTimedOut && (
                <StackItem>
                  <Alert
                    variant="danger"
                    isInline
                    title={t('{{stage}} failed', { stage: failedStage.label })}
                  >
                    {failedStage.message ?? t('Unknown error')}
                  </Alert>
                </StackItem>
              )}
            {hasExecution(agenticRun) && !executionSkipped && !noActionRequired ? (
              <>
                {executionResultName &&
                  agenticRun.metadata?.namespace &&
                  agenticRun.metadata.name && (
                    <StackItem>
                      <ActionsTaken
                        key={executionResultName}
                        name={executionResultName}
                        namespace={agenticRun.metadata.namespace}
                        agenticRunName={agenticRun.metadata.name}
                      />
                    </StackItem>
                  )}
                <StackItem>
                  <ExecutionLogs
                    run={agenticRun}
                    hideStageFailure={
                      executionTimedOut || (!analysisFailed && failedStage?.label === 'Execution')
                    }
                  />
                </StackItem>
              </>
            ) : (
              !executionLoading && (
                <StackItem>
                  <Content component="p">
                    {stopped
                      ? t('Execution will not start because this run was stopped.')
                      : noActionRequired
                        ? t('Execution is not required for this analysis.')
                        : executionSkipped
                          ? t('Execution was skipped for this analysis-only update plan.')
                          : phase === 'Denied'
                            ? t('Execution was denied.')
                            : phase === 'Approved'
                              ? t('Waiting for execution to start...')
                              : t(
                                  'Execution has not started. Review and approve the analysis plan to proceed.',
                                )}
                  </Content>
                </StackItem>
              )
            )}
          </Stack>
        </UpdatePhaseSection>
      </StackItem>
      <StackItem>
        <UpdatePhaseSection
          title={t('Update verification')}
          phase={verificationPhase}
          skipped={verificationSkipped || !verificationConfigured || noActionRequired}
          isExpanded={expanded.verification}
          onToggle={(verification) => setExpanded((prev) => ({ ...prev, verification }))}
        >
          <Stack hasGutter>
            {verificationLoading && (
              <StackItem>
                <StageLoading run={agenticRun} stage="verification" />
              </StackItem>
            )}
            {verificationTimedOut && (
              <StackItem>
                <TimeoutGuidance run={agenticRun} stage="verification" />
              </StackItem>
            )}
            <StackItem>
              {verificationStarted && !noActionRequired ? (
                <VerificationLogs run={agenticRun} hideStageFailure={verificationTimedOut} />
              ) : !stopped &&
                verificationConfigured &&
                !verificationSkipped &&
                !noActionRequired &&
                executionCondition?.status === 'True' ? (
                <VerificationApproval run={agenticRun} />
              ) : (
                <Content component="p">
                  {stopped
                    ? t('Verification will not start because this run was stopped.')
                    : noActionRequired
                      ? t('Verification is not required for this analysis.')
                      : verificationSkipped
                        ? t('Verification was skipped for this update plan.')
                        : !verificationConfigured
                          ? t('Verification is not configured for this update plan.')
                          : t(
                              'Verification starts after successful execution and any required approval.',
                            )}
                </Content>
              )}
            </StackItem>
          </Stack>
        </UpdatePhaseSection>
      </StackItem>
    </>
  );
};

export default UpdatePlanSections;
