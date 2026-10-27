import { useCallback, useEffect, useState } from 'react';
import { LightspeedAgenticRun, derivePhase } from '../models/agenticrun';
import { discoverExecutionPod, ExecutionPod } from '../utils/execution';

export const useExecutionSandbox = (run: LightspeedAgenticRun, active: boolean) => {
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
    status: { steps: { execution: run.status?.steps?.execution } },
  });
  const identity = JSON.stringify([
    run.metadata?.uid,
    run.metadata?.namespace,
    run.status?.steps?.execution?.sandbox,
    run.status?.steps?.execution?.retryCount,
  ]);
  const polling = derivePhase(run) === 'Executing';

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
        const next = await discoverExecutionPod(JSON.parse(serializedRun), controller.signal);
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
  }, [active, attempt, serializedRun, polling, identity]);

  const current = result.identity === identity ? result : undefined;
  return {
    pod: current?.pod,
    loading: active && (current?.loading ?? true),
    error: active ? current?.error : undefined,
    missing: current?.missing,
    retry,
  };
};
