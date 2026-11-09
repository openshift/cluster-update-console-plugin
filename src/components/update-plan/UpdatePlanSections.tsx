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
  getFailedStage,
  getPhaseDisplay,
  hasRemediationPlan,
} from '../../models/agenticrun';
import { I18N_NAMESPACE } from '../../utils/constants';
import { hasExecution } from '../../utils/execution';
import { getLogCondition, hasStepLogs } from '../../utils/logPhase';
import { AnalysisLogs, ExecutionLogs, VerificationLogs } from '../shared/ExecutionLogs';
import PhaseIcon from '../shared/PhaseIcon';
import AnalysisResultView from './AnalysisResultView';
import DecisionActions from './DecisionActions';
import PlanHeader from './PlanHeader';
import { ActionsTaken } from './ActionsTaken';
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
      ['AwaitingSync', 'Verifying', 'Completed', 'Escalating', 'Escalated'].includes(phase));
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

  // Follow phase transitions, but preserve manual toggles during status refreshes.
  React.useEffect(() => {
    setExpanded({
      analysis: activeSection === 'analysis',
      execution: activeSection === 'execution',
      verification: activeSection === 'verification',
    });
  }, [activeSection]);

  const analysisPhase: AgenticRunPhase =
    analysisCondition?.status === 'True'
      ? 'Completed'
      : analysisCondition?.status === 'False'
        ? 'Failed'
        : phase === 'Analyzing' || submitted
          ? 'Analyzing'
          : 'Pending';
  const executionPhase: AgenticRunPhase =
    executionCondition?.status === 'True'
      ? 'Completed'
      : executionCondition?.status === 'False'
        ? 'Failed'
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
    <AnalysisLogs run={agenticRun} />
  ) : null;
  const executionResultName = agenticRun.status?.steps?.execution?.results?.at(-1)?.name;

  return (
    <>
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
                {phase !== 'Pending' && <FlexItem>{reanalyseButton}</FlexItem>}
              </Flex>
            </StackItem>
            {analysisPhase === 'Analyzing' && (
              <StackItem>
                <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapMd' }}>
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
                          </Content>
                        </StackItem>
                      )}
                    </Stack>
                  </FlexItem>
                </Flex>
              </StackItem>
            )}
            {analysisFailed && (
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
                      {phase === 'Pending'
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
            {failedStage && !analysisFailed && failedStage.label !== 'Verification' && (
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
                  <ExecutionLogs run={agenticRun} />
                </StackItem>
              </>
            ) : (
              <StackItem>
                <Content component="p">
                  {noActionRequired
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
          {verificationStarted && !noActionRequired ? (
            <VerificationLogs run={agenticRun} />
          ) : verificationConfigured &&
            !verificationSkipped &&
            !noActionRequired &&
            executionCondition?.status === 'True' ? (
            <VerificationApproval run={agenticRun} />
          ) : (
            <Content component="p">
              {noActionRequired
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
        </UpdatePhaseSection>
      </StackItem>
    </>
  );
};

export default UpdatePlanSections;
