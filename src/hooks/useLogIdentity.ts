import { useState } from 'react';
import { LightspeedAgenticRun } from '../models/agenticrun';
import { getAnalysisStart, getStepLogIdentity, LogPhase } from '../utils/logPhase';

export const useLogIdentity = (run: LightspeedAgenticRun, phase: LogPhase) => {
  const base = getStepLogIdentity(run, phase);
  const start = phase === 'analysis' ? getAnalysisStart(run) : undefined;
  const [attempt, setAttempt] = useState({ base, start });
  let current = attempt;
  if (attempt.base !== base || (start && attempt.start !== start)) {
    current = { base, start };
    setAttempt(current);
  }
  return {
    identity: JSON.stringify([base, current.start]),
    analysisStart: current.start,
  };
};
