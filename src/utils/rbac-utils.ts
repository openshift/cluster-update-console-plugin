// Adapted from lightspeed-agentic-console at 203075b.
import { K8sModel } from '@openshift-console/dynamic-plugin-sdk';
import { RBACResult, RBACRule } from '../models/agenticrun';

export type ScopedRBACRule = RBACRule & {
  scope: 'cluster' | 'namespace';
};

export const buildPluralToKindMap = (models: { [key: string]: K8sModel }): Map<string, string> => {
  const map = new Map<string, string>();
  for (const model of Object.values(models)) {
    const key = `${model.apiGroup ?? ''}/${model.plural}`;
    map.set(key, model.kind);
  }
  return map;
};

export const resolveKind = (
  pluralToKind: Map<string, string>,
  apiGroups: string[],
  plural: string,
): string | undefined => {
  for (const g of apiGroups) {
    const kind = pluralToKind.get(`${g}/${plural}`);
    if (kind) {
      return kind;
    }
  }
  return undefined;
};

const WRITE_VERBS = new Set(['create', 'update', 'patch', 'delete', 'deletecollection']);

export const isWriteVerb = (v: string): boolean => v === '*' || WRITE_VERBS.has(v);

export const hasWriteVerb = (rule: RBACRule): boolean => rule.verbs.some(isWriteVerb);

const READ_ONLY_VERBS = new Set(['get', 'list', 'watch']);

export const isReadOnlyVerb = (v: string): boolean => READ_ONLY_VERBS.has(v);

// Anything that is not a known read-only verb is considered to be mutating
export const isMutatingVerb = (v: string): boolean => !isReadOnlyVerb(v);

export const formatResource = (rule: RBACRule): string => {
  const nonEmptyGroups = rule.apiGroups.filter((g) => g !== '');
  let result = rule.resources.join(', ');
  if (rule.resourceNames?.length) {
    result += ` [${rule.resourceNames.join(', ')}]`;
  }
  if (nonEmptyGroups.length > 0) {
    result += ` (${nonEmptyGroups.join(', ')})`;
  }
  return result;
};

export const summarizeWritePermissions = (rules: RBACRule[]): string =>
  rules
    .flatMap((rule) => {
      const wv = rule.verbs.filter(isWriteVerb);
      return wv.length ? rule.resources.map((r) => `${wv.join('/')} ${r}`) : [];
    })
    .join(' · ');

// Flattens the grouped wire contract into a single ordered rule list, tagging each
// rule with an explicit scope so cluster-scoped rules never collide with a real
// namespace name.
export const flattenRbacRules = (rbac: RBACResult): ScopedRBACRule[] => [
  ...(rbac.namespaceScoped ?? []).map((rule) => ({
    ...rule,
    namespace: rule.namespace ?? '',
    scope: 'namespace' as const,
  })),
  ...(rbac.clusterScoped ?? []).map((rule) => ({ ...rule, scope: 'cluster' as const })),
];

export const isClusterScoped = (rule: ScopedRBACRule): boolean => rule.scope === 'cluster';

export const countNamespaceRules = (rules: ScopedRBACRule[]): number =>
  rules.filter((rule) => rule.scope === 'namespace').length;

export const countClusterRules = (rules: ScopedRBACRule[]): number =>
  rules.filter(isClusterScoped).length;
