import { useCallback, useEffect, useState } from 'react';
import { LightspeedAgenticRun } from '../models/agenticrun';
import { discoverStepPod, ExecutionPod } from '../utils/execution';
import { isLogStreaming, LogPhase } from '../utils/logPhase';
import { useLogIdentity } from './useLogIdentity';

export const useExecutionSandbox = (
  run: LightspeedAgenticRun,
  active: boolean,
  phase: LogPhase = 'execution',
) => {
  const [result, setResult] = useState<{
    identity: string;
    pod?: ExecutionPod;
    error?: string;
    loading: boolean;
    missing?: boolean;
  }>({ identity: '', loading: false });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const serializedRun = JSON.stringify({
    metadata: { uid: run.metadata?.uid, namespace: run.metadata?.namespace },
    status: { steps: { [phase]: run.status?.steps?.[phase] } },
  });
  const { identity, analysisStart } = useLogIdentity(run, phase);
  const polling = isLogStreaming(run, phase);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let currentPod: ExecutionPod | undefined;
    const refresh = async () => {
      try {
        if (!currentPod)
          setResult((previous) => ({
            identity,
            pod: previous.identity === identity ? previous.pod : undefined,
            missing: previous.identity === identity ? previous.missing : undefined,
            loading: true,
          }));
        const next = await discoverStepPod(
          JSON.parse(serializedRun),
          controller.signal,
          phase,
          analysisStart,
        );
        if (controller.signal.aborted) return;
        currentPod = next;
        setResult((previous) => ({
          identity,
          pod: next ?? (previous.identity === identity ? previous.pod : undefined),
          missing: !next,
          loading: false,
        }));
        if (polling) timer = setTimeout(refresh, 3000);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setResult((previous) => ({
          identity,
          pod: previous.identity === identity ? previous.pod : undefined,
          missing: true,
          loading: false,
          error: cause instanceof Error ? cause.message : String(cause),
        }));
      }
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [active, attempt, serializedRun, polling, identity, phase, analysisStart]);

  const current = result.identity === identity ? result : undefined;
  return {
    pod: current?.pod,
    loading: active && (current?.loading ?? true),
    error: active ? current?.error : undefined,
    missing: current?.missing,
    retry,
  };
};

export const useStepSandbox = useExecutionSandbox;
