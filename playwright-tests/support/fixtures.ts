import { test as base, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export const oc = (args: string[]): string =>
  execFileSync('oc', [...args, '--kubeconfig', process.env.KUBECONFIG_PATH!], {
    encoding: 'utf-8',
    timeout: 180_000,
  });

const ARTIFACTS_DIR = './playwright-tests/screenshots/artifacts';
const PLUGIN_NAMESPACE = 'cluster-update-console-plugin';

const CLUSTER_RESOURCES = [
  'clusterserviceversion',
  'configmap',
  'deployments',
  'installplan',
  'pods',
  'replicasets',
  'rolebindings',
  'routes',
  'serviceaccounts',
  'services',
];

const safeOc = (args: string[]): string | null => {
  try {
    return oc(args);
  } catch (e: unknown) {
    console.error(`oc ${args.slice(0, 3).join(' ')} failed: ${e}`);
    return null;
  }
};

export const gatherClusterArtifacts = (): void => {
  const clusterDir = path.join(ARTIFACTS_DIR, 'cluster');
  const podLogsDir = path.join(clusterDir, 'podlogs');
  fs.mkdirSync(podLogsDir, { recursive: true });

  for (const resource of CLUSTER_RESOURCES) {
    const output = safeOc(['get', resource, '-n', PLUGIN_NAMESPACE, '-o', 'yaml']);
    if (output) {
      fs.writeFileSync(path.join(clusterDir, `${resource}.yaml`), output);
    }
  }

  const podsJson = safeOc(['get', 'pods', '-n', PLUGIN_NAMESPACE, '-o', 'json']);
  if (!podsJson) {
    return;
  }

  try {
    const pods = JSON.parse(podsJson);
    const getName = (c: { name: string }) => c.name;

    for (const pod of pods.items || []) {
      const podName = pod.metadata?.name;
      const containers = (pod.spec?.containers || []).map(getName);
      const initContainers = (pod.spec?.initContainers || []).map(getName);
      const ephemeralContainers = (pod.status?.ephemeralContainerStatuses || []).map(getName);

      const groups: { names: string[]; suffix: string }[] = [
        { names: containers, suffix: '' },
        { names: initContainers, suffix: '.init' },
        { names: ephemeralContainers, suffix: '.ephemeral' },
      ];

      for (const { names, suffix } of groups) {
        for (const container of names) {
          const logPrefix = `${podName}-${container}${suffix}`;
          const current = safeOc(['logs', `pod/${podName}`, '-c', container, '-n', PLUGIN_NAMESPACE]);
          if (current) {
            fs.writeFileSync(path.join(podLogsDir, `${logPrefix}.log`), current);
          }
          const previous = safeOc([
            'logs',
            `pod/${podName}`,
            '-c',
            container,
            '--previous',
            '-n',
            PLUGIN_NAMESPACE,
          ]);
          if (previous) {
            fs.writeFileSync(path.join(podLogsDir, `${logPrefix}.previous.log`), previous);
          }
        }
      }
    }
  } catch (e: unknown) {
    console.error(`Failed to parse pod JSON: ${e}`);
  }

  console.log(`Cluster artifacts gathered in ${clusterDir}`);
};

export const test = base.extend<{
  captureConsoleLogs: void;
  dismissGuidedTour: void;
}>({
  dismissGuidedTour: [
    async ({ page }, use) => {
      await page.addLocatorHandler(
        page.locator('[data-test="tour-step-footer-secondary"]'),
        async (btn) => {
          await btn.click();
        },
      );
      await use();
    },
    { auto: true },
  ],
  captureConsoleLogs: [
    async ({ page }, use, testInfo) => {
      const logs: { method: string; msg: string }[] = [];

      page.on('console', (msg) => {
        const type = msg.type();
        if (type === 'error' || type === 'warning') {
          logs.push({ method: type, msg: msg.text() });
        }
      });

      await use();

      if (testInfo.status !== testInfo.expectedStatus && logs.length > 0) {
        logs.forEach(({ method, msg }) => {
          console.log(`[console.${method}] ${msg}`);
        });
      }
    },
    { auto: true },
  ],
});

export { expect };
