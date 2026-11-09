import { describe, expect, it } from '@jest/globals';
import { buildPodLogUrl } from '../utils/pod';

describe('buildPodLogUrl', () => {
  it('uses the console Kubernetes proxy and encodes path segments independently', () => {
    const url = buildPodLogUrl('team/a b', 'pod?#/x', { timestamps: 'true' });
    expect(url).toBe(
      '/api/kubernetes/api/v1/namespaces/team%2Fa%20b/pods/pod%3F%23%2Fx/log?timestamps=true',
    );
  });

  it('encodes container and offset timestamps without changing their values', () => {
    const parameters = {
      timestamps: 'true',
      follow: 'true',
      container: 'runner & worker',
      sinceTime: '2026-10-27T12:30:00.123456789+02:00',
    };
    const url = new URL(buildPodLogUrl('namespace', 'execution', parameters), 'https://console');
    expect(Object.fromEntries(url.searchParams)).toEqual(parameters);
    expect(url.search).toContain('%2B02%3A00');
  });

  it('accepts an empty parameter set without adding implicit log scope', () => {
    expect(buildPodLogUrl('namespace', 'execution')).toBe(
      '/api/kubernetes/api/v1/namespaces/namespace/pods/execution/log?',
    );
  });
});
