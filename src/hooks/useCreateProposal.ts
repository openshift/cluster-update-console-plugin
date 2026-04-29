import * as React from 'react';
import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterVersion, ClusterVersionModel } from '../models/clusterversion';
import { ANNOTATIONS } from '../utils/constants';
import { getErrorMessage } from '../utils/error';

export const useCreateProposal = () => {
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const requestProposal = React.useCallback(
    async (clusterVersion: ClusterVersion, targetVersion: string) => {
      setCreating(true);
      setError(null);
      try {
        const annotations = clusterVersion.metadata?.annotations ?? {};
        const op = ANNOTATIONS.proposeUpdate in annotations ? 'replace' : 'add';
        await k8sPatch({
          data: [
            {
              op,
              path: `/metadata/annotations/${ANNOTATIONS.proposeUpdate.replace(/\//g, '~1')}`,
              value: targetVersion,
            },
          ],
          model: ClusterVersionModel,
          resource: clusterVersion,
        });
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setCreating(false);
      }
    },
    [],
  );

  const clearError = React.useCallback(() => setError(null), []);

  return { requestProposal, creating, error, clearError };
};
