export const buildPodLogUrl = (
  namespace: string,
  podName: string,
  parameters: Record<string, string> = {},
): string =>
  `/api/kubernetes/api/v1/namespaces/${encodeURIComponent(namespace)}/pods/${encodeURIComponent(podName)}/log?${new URLSearchParams(parameters).toString()}`;
