import { LightspeedAgenticRun, derivePhase } from '../models/agenticrun';

export type LogPhase = 'analysis' | 'execution';

export const getLogCondition = (run: LightspeedAgenticRun, phase: LogPhase) =>
  run.status?.conditions?.find(
    (condition) => condition.type === (phase === 'analysis' ? 'Analyzed' : 'Executed'),
  );

export const isLogStreaming = (run: LightspeedAgenticRun, phase: LogPhase): boolean =>
  phase === 'execution'
    ? derivePhase(run) === 'Executing'
    : getLogCondition(run, phase)?.status === 'Unknown' && derivePhase(run) !== 'Denied';

export const hasStepLogs = (run: LightspeedAgenticRun, phase: LogPhase): boolean => {
  const step = run.status?.steps?.[phase];
  const condition = getLogCondition(run, phase);
  return !!(
    step?.sandbox?.claimName ||
    step?.results?.length ||
    step?.conditions?.some((entry) => entry.reason !== 'Skipped') ||
    (condition && condition.reason !== 'Skipped') ||
    isLogStreaming(run, phase) ||
    (phase === 'analysis' && run.spec?.analysis)
  );
};

export const getStepLogIdentity = (run: LightspeedAgenticRun, phase: LogPhase): string =>
  JSON.stringify([
    phase,
    run.metadata?.uid,
    run.metadata?.namespace,
    run.status?.steps?.[phase]?.sandbox,
    phase === 'analysis' ? run.metadata?.generation : run.status?.steps?.execution?.retryCount,
    run.status?.steps?.[phase]?.conditions?.find(
      (condition) => condition.type === 'Started' && condition.status === 'True',
    )?.lastTransitionTime,
  ]);

export const getAnalysisStart = (run: LightspeedAgenticRun): string | undefined => {
  const condition = getLogCondition(run, 'analysis');
  return condition?.status === 'Unknown' &&
    condition.lastTransitionTime &&
    Number.isFinite(Date.parse(condition.lastTransitionTime))
    ? condition.lastTransitionTime
    : undefined;
};
