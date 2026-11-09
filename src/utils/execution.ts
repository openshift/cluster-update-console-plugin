import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';
import { LightspeedAgenticRun } from '../models/agenticrun';
import { getAnalysisStart, hasStepLogs, LogPhase } from './logPhase';
import { LIGHTSPEED_NAMESPACE } from './constants';
import { getLogHttpStatus } from './logs';
import type { SandboxView } from '../hooks/useSandboxLogStream';

type Resource = {
  metadata?: {
    name?: string;
    uid?: string;
    creationTimestamp?: string;
    deletionTimestamp?: string;
    labels?: Record<string, string>;
    ownerReferences?: { kind: string; uid: string; apiVersion: string }[];
  };
  spec?: { containers?: { name: string }[] };
  status?: {
    startTime?: string;
    phase?: string;
    containerStatuses?: { name: string; state?: { waiting?: unknown } }[];
  };
};

export type ExecutionPod = SandboxView & { sinceTime?: string };

export const hasExecution = (run: LightspeedAgenticRun): boolean => hasStepLogs(run, 'execution');

const read = async (url: string, signal: AbortSignal, optional = false) => {
  try {
    const response = await consoleFetch(url, { signal });
    if (optional && response.status === 404) return undefined;
    if (!response.ok)
      throw Object.assign(new Error(`HTTP ${response.status}`), { code: response.status });
    return await response.json();
  } catch (cause) {
    const status = getLogHttpStatus(cause);
    if (optional && status === 404) return undefined;
    if (typeof status === 'number')
      throw Object.assign(new Error(`HTTP ${status}`), { code: status });
    throw cause;
  }
};

const list = async (url: string, signal: AbortSignal): Promise<Resource[]> => {
  const result = await read(url, signal);
  if (!Array.isArray(result?.items)) throw new Error('Invalid resource list');
  return result.items;
};

const owns = (resource: Resource, kind: string, uid: string, group: string) =>
  resource.metadata?.ownerReferences?.some(
    (owner) => owner.kind === kind && owner.uid === uid && owner.apiVersion.startsWith(`${group}/`),
  );

const validTime = (value?: string): string | undefined =>
  value && Number.isFinite(Date.parse(value)) ? value : undefined;

export const discoverExecutionPod = async (
  run: LightspeedAgenticRun,
  signal: AbortSignal,
  phase: LogPhase = 'execution',
  analysisStart?: string,
): Promise<ExecutionPod | undefined> => {
  const sandbox = run.status?.steps?.[phase]?.sandbox;
  if (!sandbox?.claimName || !run.metadata?.uid) return undefined;
  const namespace = sandbox.namespace || run.metadata.namespace || LIGHTSPEED_NAMESPACE;
  const encodedNamespace = encodeURIComponent(namespace);
  const core = `/api/kubernetes/api/v1/namespaces/${encodedNamespace}`;
  const selector = new URLSearchParams({
    labelSelector: `agentic.openshift.io/run=${run.metadata.uid},agentic.openshift.io/step=${phase}`,
  });
  const bare = (await list(`${core}/pods?${selector}`, signal)).filter(
    (pod) =>
      pod.metadata?.name === sandbox.claimName &&
      pod.metadata?.labels?.['agentic.openshift.io/run'] === run.metadata?.uid &&
      pod.metadata?.labels?.['agentic.openshift.io/step'] === phase &&
      !pod.metadata?.ownerReferences?.some((owner) => owner.kind === 'Sandbox'),
  );
  let candidates = bare;
  if (bare.length === 0) {
    const claims = `/api/kubernetes/apis/extensions.agents.x-k8s.io/v1beta1/namespaces/${encodedNamespace}`;
    const claim: Resource | undefined = await read(
      `${claims}/sandboxclaims/${encodeURIComponent(sandbox.claimName)}`,
      signal,
      true,
    );
    if (!claim?.metadata?.uid) return undefined;
    const sandboxes = await list(
      `/api/kubernetes/apis/agents.x-k8s.io/v1beta1/namespaces/${encodedNamespace}/sandboxes`,
      signal,
    );
    const owned = sandboxes.filter((resource) =>
      owns(resource, 'SandboxClaim', claim.metadata!.uid!, 'extensions.agents.x-k8s.io'),
    );
    if (owned.length === 0) return undefined;
    candidates = (await list(`${core}/pods`, signal)).filter((pod) =>
      owned.some(
        (resource) =>
          resource.metadata?.uid && owns(pod, 'Sandbox', resource.metadata.uid, 'agents.x-k8s.io'),
      ),
    );
  }
  candidates = candidates.filter((pod) => !pod.metadata?.deletionTimestamp);
  if (candidates.length > 1) throw new Error(`Ambiguous ${phase} pod`);
  const pod = candidates[0];
  if (!pod?.metadata?.name || !pod.metadata.uid) return undefined;
  const container = pod.spec?.containers?.[0]?.name;
  const workload = pod.status?.containerStatuses?.find((status) => status.name === container);
  if (pod.status?.phase === 'Pending' || workload?.state?.waiting) return undefined;
  const started = run.status?.steps?.[phase]?.conditions?.find(
    (condition) => condition.type === 'Started' && condition.status === 'True',
  )?.lastTransitionTime;
  const podStart =
    validTime(started) ||
    validTime(pod.status?.startTime) ||
    validTime(pod.metadata.creationTimestamp);
  const boundary =
    phase === 'analysis' ? validTime(analysisStart) || getAnalysisStart(run) : undefined;
  return {
    namespace,
    podName: pod.metadata.name,
    podUid: pod.metadata.uid,
    container,
    sinceTime:
      boundary && (!podStart || Date.parse(boundary) > Date.parse(podStart)) ? boundary : podStart,
  };
};

export const discoverStepPod = discoverExecutionPod;
