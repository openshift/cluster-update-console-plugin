# Cluster Update Console Plugin

An OpenShift Console dynamic plugin that provides an AI-driven cluster update experience. It integrates with [OpenShift Lightspeed](https://github.com/openshift/lightspeed-operator) proposals (via the `agentic.openshift.io` API) to assess upgrade readiness, show OLM operator compatibility, and let users approve or reject AI-generated update plans.

## Features

- **Update Plan** — Shows the active AI-generated update proposal with risk assessment, readiness checks, OLM operator compatibility, API deprecation checks, and approve/deny actions.
- **Active Update Plans** — Lists all non-terminal Lightspeed proposals.
- **Update History** — Shows the ClusterVersion update history.
- **Graceful Degradation** — Works without the Lightspeed Proposal CRD installed. The Update History tab is always functional; AI features show a warning banner when unavailable.

## Analysis and execution logs

The Update Plan tab provides separate **View analysis logs** and **View execution logs**
sections. Each follows only its own step's pod while that step is running. Analysis
logs remain available after analysis, including for analysis-only runs without an
execution step; execution logs remain available through verification and escalation.
After each step, its viewer prefers retained history when the
`lightspeed-agentic-configuration` ConfigMap in `openshift-lightspeed` provides an
`otel-admin-endpoint`; otherwise it falls back to the selected step's pod. Retained history
is scoped to the AgenticRun UID and the selected `analysis` or `execution` phase and
can include multiple attempts of that phase. The two viewers never combine phases.
Pod logs are scoped to the resolved step pod and its start boundary. Analysis uses
the active `Analyzed=Unknown` transition as an additional lower bound so that an old
sandbox reference cannot expose earlier-attempt output while a revision is starting.
Analysis generation, active-start and sandbox changes reset its viewer identity;
ordinary completion preserves the current viewer and start boundary.

Viewing requires permission to read the run, pods and pod logs. Claim-managed sandboxes
also require read access to SandboxClaims and Sandboxes; retained history requires the
named ConfigMap and collector service-proxy access. Pod discovery follows owner UIDs,
not an assumption that a claim and pod have the same name. Missing optional retention
does not change step status. If the pod has expired and retention is unavailable,
historical output cannot be recovered by this plugin. Both sources are bounded to
20,000 lines and 4,194,304 saved text characters, with a 65,536-character per-line
limit. Retained lines exceeding that width are truncated; an oversized live line
stops that stream with an error while preserving previously loaded output. The viewer
reports truncation. These are saved-text limits, not collector response-size limits;
the browser still materializes each retained JSON response before validation.

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

For a standalone interactive preview using the real Cluster Update page and local
sample data, run `yarn preview` and open <http://127.0.0.1:9002>. The preview stage
selector covers analysis, approval, execution, verification, completion, and failure states.
Approving a sample plan simulates execution and streams sample logs. After execution,
**Approve verification** starts the sample verification stage. Re-analysis,
approval, and rejection affect only the preview; the preview SDK makes no cluster
requests. Use **Reset preview** to start again.

The **Update verification** section displays the run's verification stage and logs.
When manual approval is required, its **Approve verification** button approves the
`Verification` stage on `AgenticRunApproval`. The Lightspeed operator launches the
agent configured in `AgenticRun.spec.verification` in a dedicated sandbox pod;
the console plugin displays its progress and does not execute verification commands.

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
