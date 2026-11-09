# Cluster Update Console Plugin

An OpenShift Console dynamic plugin for reviewing and approving AI-generated cluster
update plans through the `agentic.openshift.io` API.

## Features

- **Updates plan** — Separate, collapsible analysis, execution, and verification
  sections with scoped permissions, copyable commands, explicit plan selection,
  approval/rejection, actions taken, and stage-specific logs.
- **Active update plans** — Lists non-terminal AgenticRuns.
- **Live cluster update progress** — Watches ClusterVersion, ClusterOperators,
  MachineConfigPools, and rendered MachineConfigs. Reports operator and node
  rollout counts independently of the agent's lifecycle. Routine node configuration
  rollouts are distinguished from version updates.
- **Upgrade readiness checklist** — Displays structured `ota_readiness_summary`
  and `ota_finding` components from AnalysisResult. Shows blockers and required
  actions first; passed checks are collapsed. This is an assessment snapshot,
  refreshed by re-analysis, not a live readiness probe.
- **Timeout guidance** — Explains stage timeouts and links to the effective Agent
  CR, honoring approval overrides. Startup failures have separate guidance.
- **Graceful degradation** — Native rollout status remains available without the
  AgenticRun API. Missing permissions or resources are reported in the relevant view.

## Stage logs and approvals

Each stage follows only its own pod while running. After the stage finishes, its
viewer prefers retained history when the `lightspeed-agentic-configuration`
ConfigMap in `openshift-lightspeed` provides an `otel-admin-endpoint`; otherwise it
falls back to the stage's pod. Retained logs are scoped to AgenticRun UID and phase
and may include multiple attempts. Viewers never combine phases.

Pod discovery follows sandbox owner UIDs. Log requests use the step's start boundary;
analysis also uses its active condition transition to exclude earlier attempts.
Changes to the run, attempt, or sandbox reset the viewer; completion preserves output.
Viewing requires access to pods and pod logs, plus SandboxClaims/Sandboxes for
claim-managed pods, or the configuration ConfigMap and collector proxy for retention.
If the pod has expired and retention is unavailable, the plugin cannot recover logs.

Both sources retain at most 20,000 lines, 4,194,304 text characters, and 65,536
characters per line. The viewer discloses truncation. These are saved-text limits;
the browser still materializes retained JSON responses before validation.

Approvals patch AgenticRunApproval; the console does not execute displayed commands
or request the platform update directly. Verification approval stays disabled while
ClusterVersion reports an unfinished rollout or completion cannot be confirmed. This
is a console-side guard; automatic approvals and other API clients are governed by
the operator's policies. Changing an Agent timeout affects other runs using that Agent.

Re-analyse deletes the current assessment after confirmation. It is unavailable
while agent stages are running. Execution may have partially completed after a
failure; review actions taken and cluster state before beginning another attempt.

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
Approving a sample plan simulates execution and streams sample logs. After execution, select **Ready for verification — rollout complete** to enable
**Approve verification** and start the sample verification stage. Re-analysis,
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
