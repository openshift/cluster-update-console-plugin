# Cluster Update Console Plugin

An OpenShift Console dynamic plugin that provides an AI-driven cluster update experience. It integrates with [OpenShift Lightspeed](https://github.com/openshift/lightspeed-operator) proposals (via the `agentic.openshift.io` API) to assess upgrade readiness, show OLM operator compatibility, and let users approve or reject AI-generated update plans.

## Features

- **Update Plan** — Shows the active AI-generated update proposal with risk assessment, readiness checks, OLM operator compatibility, API deprecation checks, and approve/deny actions.
- **Active Update Plans** — Lists all non-terminal Lightspeed proposals.
- **Update History** — Shows the ClusterVersion update history.
- **Graceful Degradation** — Works without the Lightspeed Proposal CRD installed. The Update History tab is always functional; AI features show a warning banner when unavailable.

## Prerequisites

- OpenShift 4.22+ (uses ConsolePlugin CRD v1 API, Console SDK 4.22)
- [Node.js](https://nodejs.org/en/) 18+ and [Yarn](https://yarnpkg.com) 4.x
- [oc](https://console.redhat.com/openshift/downloads) CLI
- [Docker](https://www.docker.com) or [podman 3.2.0+](https://podman.io) (for running the console locally)

## Development

### Local development

In one terminal:

```bash
yarn install
yarn start
```

In another terminal:

```bash
oc login  # log into your OpenShift cluster
yarn start-console
```

Navigate to <http://localhost:9000/administration/cluster-update>.

The plugin dev server runs on port 9001 with CORS enabled. The console bridge runs on port 9000.

### Testing with mock data

Without the Lightspeed agentic operator installed, Proposals have no analysis data. To test with mock data:

1. Verify CVO-created Proposals exist:
   ```bash
   oc -n openshift-lightspeed get proposals.agentic.openshift.io
   ```

2. Get the Proposal UID:
   ```bash
   oc -n openshift-lightspeed get proposals.agentic.openshift.io -o custom-columns=NAME:.metadata.name,UID:.metadata.uid
   ```

3. Update `mock-analysis-result.yaml` with the correct Proposal name and UID in `ownerReferences`, then apply:
   ```bash
   oc apply -f mock-analysis-result.yaml
   ```

4. Patch the Proposal status to reference the AnalysisResult (see comments in `mock-analysis-result.yaml` for the full command).

5. Patch the AnalysisResult status subresource with options data (the `status` field is a subresource, so `oc apply` won't set it — use `oc patch --subresource status`).

### Code quality

```bash
yarn lint    # eslint + prettier + stylelint (with --fix)
yarn test    # Jest unit tests
```

### Styling rules

The `.stylelintrc.yaml` enforces strict rules to prevent breaking console:

- No hex colors — use PatternFly CSS variables
- No naked element selectors (`table`, `div`, etc.)
- No `.pf-` or `.co-` prefixed classes
- Prefix all custom classes with `cluster-update-plugin__`

## Building and deploying

### Build the image

```bash
docker build -t quay.io/my-repository/cluster-update-console-plugin:latest .
# For Apple Silicon: add --platform=linux/amd64
```

### Deploy via Helm

```bash
helm upgrade -i cluster-update-console-plugin charts/openshift-console-plugin \
  -n cluster-update-console-plugin \
  --create-namespace \
  --set plugin.image=quay.io/my-repository/cluster-update-console-plugin:latest
```

## i18n

The i18n namespace is `plugin__cluster-update-console-plugin`. Use the `useTranslation` hook:

```tsx
import { I18N_NAMESPACE } from '../utils/constants';
const { t } = useTranslation(I18N_NAMESPACE);
```

For labels in `console-extensions.json`:
```json
"name": "%plugin__cluster-update-console-plugin~Cluster Update%"
```

Run `yarn i18n` after adding or changing messages to update locale files.

## References

- [Console Plugin SDK](https://github.com/openshift/console/tree/main/frontend/packages/console-dynamic-plugin-sdk)
- [PatternFly React](https://www.patternfly.org/get-started/develop)
- [Lightspeed Operator](https://github.com/openshift/lightspeed-operator)
- [Dynamic Plugin Enhancement Proposal](https://github.com/openshift/enhancements/blob/master/enhancements/console/dynamic-plugins.md)
