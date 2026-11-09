import { useEffect, useState, type ReactNode } from 'react';
import { Button, Label, Modal, ModalBody, ModalHeader } from '@patternfly/react-core';
import type { K8sModel } from '@openshift-console/dynamic-plugin-sdk';
import { createdAt, logMessages, runUid } from './data';
import { getPreview, setScenario, startStage, usePreview } from './store';

export const getGroupVersionKindForModel = (model: {
  apiGroup?: string;
  apiVersion: string;
  kind: string;
}) => ({ group: model.apiGroup ?? '', version: model.apiVersion, kind: model.kind });

export const useK8sWatchResource = <T,>({
  groupVersionKind,
  name,
  namespace,
}: {
  groupVersionKind: { kind: string };
  name?: string;
  namespace?: string;
}): [T, boolean, undefined] => {
  const { run, results, executionResults, approval } = usePreview();
  const resources: Record<string, unknown> = {
    AgenticRun: [run],
    AnalysisResult: results,
    ExecutionResult: executionResults.find(
      (result) => result.metadata.name === name && result.metadata.namespace === namespace,
    ),
    AgenticRunApproval: [approval],
    ApprovalPolicy: {
      spec: {
        stages: [
          { name: 'Analysis', approval: 'Manual' },
          { name: 'Execution', approval: 'Manual' },
        ],
      },
    },
    ClusterVersion: {
      metadata: { name: 'version' },
      spec: { channel: 'stable-5.0' },
      status: { desired: { version: '5.0.0-rc.6', image: 'preview' } },
    },
  };
  return [resources[groupVersionKind.kind] as T, true, undefined];
};

export const useAccessReview = (): [boolean, boolean] => [true, false];

const models = Object.fromEntries(
  [
    ['config.openshift.io', 'clusterversions', 'ClusterVersion', 'CV'],
    ['config.openshift.io', 'clusteroperators', 'ClusterOperator', 'CO'],
    ['', 'pods', 'Pod', 'P'],
    ['', 'configmaps', 'ConfigMap', 'CM'],
  ].map(([apiGroup, plural, kind, abbr]) => [
    kind,
    {
      apiGroup,
      apiVersion: 'v1',
      plural,
      kind,
      abbr,
      label: kind,
      labelPlural: plural,
      namespaced: !apiGroup,
    },
  ]),
);

export const useK8sModels = () => [models, false];
export const ResourceIcon = ({ kind }: { kind: string }) => (
  <Label isCompact color="blue">
    {models[kind]?.abbr ?? kind}
  </Label>
);

export const ResourceLink = ({ name, className }: { name: string; className?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className={className}>
      <Button variant="link" isInline onClick={() => setOpen(true)}>
        {name}
      </Button>
      <Modal
        variant="small"
        isOpen={open}
        onClose={() => setOpen(false)}
        aria-labelledby="preview-namespace-title"
      >
        <ModalHeader title={name} labelId="preview-namespace-title" />
        <ModalBody>Namespace · Active · Sample resource</ModalBody>
      </Modal>
    </span>
  );
};

export const DocumentTitle = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    document.title = `${children} · Local preview`;
  }, [children]);
  return null;
};

export const Timestamp = ({ timestamp }: { timestamp?: string }) =>
  timestamp ? <time dateTime={timestamp}>{new Date(timestamp).toLocaleString()}</time> : <>—</>;

type Decision = { type: 'Analysis' | 'Execution' | 'Verification'; decision?: string };
export const k8sPatch = async ({
  model,
  resource,
  data,
}: {
  model: K8sModel;
  resource: { metadata?: { resourceVersion?: string } };
  data: { op: string; path: string; value: unknown }[];
}) => {
  if (model.kind !== 'AgenticRunApproval')
    throw new Error('Only sample approval decisions are supported.');
  if (resource.metadata?.resourceVersion !== getPreview().approval.metadata?.resourceVersion)
    throw new Error('The sample run changed. Please try again.');
  const value = data.find((operation) => operation.op === 'add')?.value;
  const decision = (
    Array.isArray(value)
      ? value.at(-1)
      : value && typeof value === 'object' && 'stages' in value
        ? (value.stages as Decision[]).at(-1)
        : value
  ) as Decision | undefined;
  if (!decision) throw new Error('A sample approval stage is required.');
  if (decision.decision === 'Denied') setScenario('Denied');
  else
    startStage(
      decision.type === 'Analysis'
        ? 'Analyzing'
        : decision.type === 'Verification'
          ? 'Verifying'
          : 'Executing',
    );
  return getPreview().approval;
};

export const k8sDelete = async ({ model }: { model: K8sModel }) => {
  if (model.kind !== 'AgenticRun') throw new Error('Only sample analysis resets are supported.');
  setScenario('Pending');
  return {};
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const logTime = (index: number) =>
  new Date(Date.parse(createdAt) + (index + 1) * 1000).toISOString();
const messagesFor = (phase: keyof typeof logMessages) =>
  phase === 'verification' && getPreview().scenario === 'VerificationFailed'
    ? [
        ...logMessages.verification.slice(0, 3),
        'Verification failed: the target version is not yet observed on all nodes.',
      ]
    : logMessages[phase];

// This module replaces the Console SDK only in the preview bundle. Every request is handled locally.
export const consoleFetch = async (
  input: string,
  options: { signal?: AbortSignal | null } = {},
): Promise<Response> => {
  const url = new URL(input, window.location.origin);
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (url.pathname.endsWith('/configmaps/lightspeed-agentic-configuration'))
    return json({
      data: { 'otel-admin-endpoint': 'https://preview-collector.openshift-lightspeed.svc:8080' },
    });
  if (url.pathname.endsWith('/api/v1/logs')) {
    const phase =
      url.searchParams.get('phase') === 'analysis'
        ? 'analysis'
        : url.searchParams.get('phase') === 'verification'
          ? 'verification'
          : 'execution';
    return json({
      agentic_run_id: runUid,
      has_more: false,
      records: messagesFor(phase).map((message, index) => ({
        id: index + 1,
        timestamp: logTime(index),
        phase,
        event: 'INFO',
        body: { msg: message },
      })),
    });
  }
  if (url.pathname.endsWith('/pods')) {
    return json({
      items: ['analysis', 'execution', 'verification'].map((phase) => ({
        metadata: {
          name: `preview-${phase}`,
          uid: `preview-${phase}-pod`,
          creationTimestamp: createdAt,
          labels: { 'agentic.openshift.io/run': runUid, 'agentic.openshift.io/step': phase },
        },
        spec: { containers: [{ name: 'agent' }] },
        status: { phase: 'Running', startTime: createdAt },
      })),
    });
  }
  if (url.pathname.endsWith('/log')) {
    const phase = url.pathname.includes('preview-analysis')
      ? 'analysis'
      : url.pathname.includes('preview-verification')
        ? 'verification'
        : 'execution';
    const since = url.searchParams.get('sinceTime');
    const lines = messagesFor(phase)
      .map((message, index) => `${logTime(index)} INFO ${message}\n`)
      .filter((line) => !since || line.slice(0, 24) >= since);
    const encoder = new TextEncoder();
    if (url.searchParams.get('follow') !== 'true') return new Response(lines.join(''));
    let timer: ReturnType<typeof setInterval>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        let index = 0;
        const emit = () => {
          if (index < lines.length) controller.enqueue(encoder.encode(lines[index++]));
        };
        emit();
        timer = setInterval(emit, 800);
        options.signal?.addEventListener(
          'abort',
          () => {
            clearInterval(timer);
            try {
              controller.close();
            } catch {
              /* The reader may already be cancelled. */
            }
          },
          { once: true },
        );
      },
      cancel() {
        clearInterval(timer);
      },
    });
    return new Response(body);
  }
  throw new Error(`Unsupported preview request: ${url.pathname}`);
};
