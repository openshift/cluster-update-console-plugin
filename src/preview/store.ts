import { useSyncExternalStore } from 'react';
import { resourcesFor, type Scenario } from './data';

let state = { scenario: 'Proposed' as Scenario, revision: 1, ...resourcesFor('Proposed', 1) };
const listeners = new Set<() => void>();
let transition: ReturnType<typeof setTimeout> | undefined;

export const getPreview = () => state;

export const setScenario = (scenario: Scenario) => {
  clearTimeout(transition);
  const revision = state.revision + 1;
  state = { scenario, revision, ...resourcesFor(scenario, revision) };
  listeners.forEach((listener) => listener());
};

export const startStage = (scenario: 'Analyzing' | 'Executing' | 'Verifying') => {
  setScenario(scenario);
  transition = setTimeout(
    () =>
      setScenario(
        scenario === 'Analyzing'
          ? 'Proposed'
          : scenario === 'Executing'
            ? 'AwaitingVerification'
            : 'Completed',
      ),
    14000,
  );
};

export const usePreview = () =>
  useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, getPreview);
