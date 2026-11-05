import { gatherClusterArtifacts } from './fixtures';

const globalTeardown = async () => {
  // Gather cluster artifacts for debugging
  if (process.env.KUBECONFIG_PATH) {
    try {
      gatherClusterArtifacts();
    } catch (e: unknown) {
      console.error(`Failed to gather cluster artifacts: ${e}`);
    }
  }
};

export default globalTeardown;
