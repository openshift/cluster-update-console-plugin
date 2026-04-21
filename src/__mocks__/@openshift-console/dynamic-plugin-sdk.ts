export const getGroupVersionKindForModel = (model: {
  apiGroup?: string;
  apiVersion: string;
  kind: string;
}) => ({
  group: model.apiGroup || '',
  version: model.apiVersion,
  kind: model.kind,
});

export const getAPIVersionForModel = (model: { apiGroup?: string; apiVersion: string }) =>
  model.apiGroup ? `${model.apiGroup}/${model.apiVersion}` : model.apiVersion;

export const k8sCreate = jest.fn();
export const k8sPatch = jest.fn();

export type K8sModel = {
  apiGroup?: string;
  apiVersion: string;
  kind: string;
  plural: string;
  abbr: string;
  namespaced: boolean;
  label: string;
  labelPlural: string;
};

export type K8sResourceCommon = {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    uid?: string;
    creationTimestamp?: string;
  };
};

export type K8sResourceCondition = {
  type: string;
  status: string;
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
};
