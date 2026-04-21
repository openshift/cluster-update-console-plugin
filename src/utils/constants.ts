export const PLUGIN_NAME = 'cluster-update-console-plugin';
export const I18N_NAMESPACE = 'plugin__cluster-update-console-plugin';
export const CSS_PREFIX = 'cluster-update-plugin';
export const LIGHTSPEED_NAMESPACE = 'openshift-lightspeed';

export const LABELS = {
  source: 'agentic.openshift.io/source',
  currentVersion: 'agentic.openshift.io/current-version',
  targetVersion: 'agentic.openshift.io/target-version',
  updateType: 'agentic.openshift.io/update-type',
} as const;

export const ANNOTATIONS = {
  proposeUpdate: 'agentic.openshift.io/propose-update',
} as const;

export const TERMINAL_PHASES = new Set(['Completed', 'Failed', 'Denied', 'Escalated']);

export const isTerminalPhase = (phase?: string): boolean => !phase || TERMINAL_PHASES.has(phase);
