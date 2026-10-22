export const buildPodLogUrl = (
  namespace: string,
  podName: string,
  params: Record<string, string>,
): string => {
  const qs = new URLSearchParams(params);
  return (
    `/api/kubernetes/api/v1/namespaces/${encodeURIComponent(namespace)}` +
    `/pods/${encodeURIComponent(podName)}/log?${qs.toString()}`
  );
};
