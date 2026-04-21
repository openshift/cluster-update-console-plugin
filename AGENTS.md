# AI Agent Instructions for Cluster Update Console Plugin

This document provides context and guidelines for AI coding assistants working on this codebase.

## Project Overview

This is the **Cluster Update Console Plugin** — an OpenShift Console dynamic plugin that provides an AI-driven cluster update experience. It integrates with [OpenShift Lightspeed](https://github.com/openshift/lightspeed-operator) proposals (via the `agentic.openshift.io` API) to assess upgrade readiness, show OLM operator compatibility, and let users approve or reject AI-generated update plans.

This repo was instantiated from the [console-plugin-template](https://github.com/openshift/console-plugin-template).

**Key Technologies:**
- TypeScript + React 17
- PatternFly 6 (UI component library)
- Webpack 5 with Module Federation
- react-i18next for internationalization
- Jest + ts-jest for unit tests
- Cypress for e2e testing
- Helm for deployment

**Compatibility:** Requires OpenShift 4.12+ (uses ConsolePlugin CRD v1 API). The Lightspeed Proposal CRD (`agentic.openshift.io/v1alpha1`) is optional — the plugin degrades gracefully when it is not installed.

## Architecture & Patterns

### Dynamic Plugin System

This plugin uses webpack module federation to load at runtime into the OpenShift Console. Key files:

- `console-extensions.json`: Declares what the plugin adds to console (routes, nav items)
- `package.json` `consolePlugin` section: Plugin metadata and exposed modules mapping
- `webpack.config.ts`: Configures module federation and build

**Critical:** Any component referenced in `console-extensions.json` must have a corresponding entry in `package.json` under `consolePlugin.exposedModules`.

### Plugin Structure

The plugin exposes a single page at `/administration/cluster-update` with three tabs:

1. **Update Plan** — Shows the active AI-generated update proposal or lets the user generate one. Contains risk assessment, readiness checks, OLM operator compatibility, API deprecations, maintenance details, and approve/deny actions.
2. **Active Update Plans** — Lists all non-terminal Lightspeed proposals.
3. **Update History** — Shows the ClusterVersion update history.

### Data Flow

- `useClusterVersion()` — watches the `ClusterVersion` resource (always present)
- `useUpdateProposals()` — watches `Proposal` resources in `openshift-lightspeed` namespace (optional CRD)
- `getAnalysisData(proposal)` — extracts the selected remediation option and its adapter components from a proposal. **Computed once** in `ActivePlanView` and passed as `analysisData` prop to all child components.
- Component extractors (`getReadinessSummary`, `getFindings`, `getOlmOperatorStatus`) filter the shared `components` array for typed data.

### Graceful Degradation

If the Lightspeed Proposal CRD is not installed:
- The page still loads and shows ClusterVersion data (Update History tab works fully)
- A warning banner explains that AI features are unavailable
- The Update Plan tab shows the "no active plan" view without crashing
- The `useCreateProposal` hook catches and displays errors if the user tries to create a proposal

### Component Structure

- Use functional components with hooks (NO class components)
- All components should be TypeScript (`.tsx`)
- Follow PatternFly component patterns
- Use PatternFly CSS variables instead of hex colors (dark mode compatibility)

### Styling Constraints

**IMPORTANT:** The `.stylelintrc.yaml` enforces strict rules to prevent breaking console:

- **NO hex colors** — use PatternFly CSS variables (e.g., `var(--pf-t--global--spacer--md)`)
- **NO naked element selectors** (like `table`, `div`) — prevents overwriting console styles
- **NO `.pf-` or `.co-` prefixed classes** — reserved for PatternFly and console
- **Prefix all custom classes** with `cluster-update-plugin__` (e.g., `cluster-update-plugin__header`)

## Internationalization (i18n)

**Namespace:** `plugin__cluster-update-console-plugin`

### In React Components:
```tsx
import { I18N_NAMESPACE } from '../utils/constants';
const { t } = useTranslation(I18N_NAMESPACE);
return <h1>{t('Cluster Update')}</h1>;
```

### In console-extensions.json:
```json
"name": "%plugin__cluster-update-console-plugin~Cluster Update%"
```

**After adding/changing messages:** Run `yarn i18n` to update locale files in `/locales`

## File Organization

```
src/
  components/
    ClusterUpdatePage.tsx          # Main page (entry point)
    shared/                        # Reusable UI components
      PhaseIcon.tsx                # Proposal phase icons
      PhaseLabel.tsx               # Proposal phase labels
      ReadinessStatusIcon.tsx      # Pass/warn/fail icons
      SeverityLabel.tsx            # Finding severity labels
    update-plan/                   # Update plan tab components
      ActivePlanView.tsx           # Container for active proposal view
      NoActivePlanView.tsx         # Shown when no active proposal
      AIAssessmentCard.tsx         # AI assessment summary
      AIUpdateAgentCard.tsx        # Version selector + generate plan
      PlanHeader.tsx               # Proposal version/type header
      PlanStepChecklist.tsx        # Readiness check results
      RiskAssessment.tsx           # Risk level + decision alert
      CompatibilityTable.tsx       # Findings table
      OLMOperators.tsx             # OLM operator lifecycle table
      APIDeprecations.tsx          # API deprecation checks
      ClusterMetrics.tsx           # Live Prometheus metrics
      MaintenanceWindow.tsx        # Upgrade/monitor commands
      DecisionActions.tsx          # Approve/deny with confirmation
      PrerequisitesSidebar.tsx     # Prerequisites list
      UpdatePlanTab.tsx            # Tab container
    active-plans/                  # Active plans tab
    update-history/                # Update history tab
  hooks/
    useClusterVersion.ts           # ClusterVersion watcher
    useUpdateProposals.ts          # Proposal list watcher
    useCreateProposal.ts           # Create new proposal
    useApprovalActions.ts          # Approve/deny proposal
  models/
    clusterversion.ts              # ClusterVersion types + model
    proposal.ts                    # Proposal types, model, helpers
  utils/
    constants.ts                   # Plugin name, labels, terminal phases
    version.ts                     # SemVer parsing, comparison, sanitization
    time.ts                        # Duration/date formatting
    error.ts                       # Error message extraction
  __tests__/                       # Unit tests (Jest)
  __mocks__/                       # SDK mocks for Jest
console-extensions.json            # Plugin extension declarations
jest.config.ts                     # Jest configuration
package.json                       # Plugin metadata
webpack.config.ts                  # Module federation + build config
locales/                           # i18n translation files
charts/                            # Helm chart for deployment
integration-tests/                 # Cypress e2e tests
```

## Development Workflow

### Local Development
1. `yarn install` — install dependencies
2. `yarn start` — starts webpack dev server on port 9001 with CORS
3. `yarn start-console` — runs OpenShift console in container (requires cluster login)
4. Navigate to http://localhost:9000/administration/cluster-update

### Code Quality
- `yarn lint` — runs eslint, prettier, and stylelint (with --fix)
- `yarn test` — runs Jest unit tests
- Linting and tests are mandatory before commits

### Testing
- `yarn test` — runs unit tests (utils, models, helpers)
- `yarn test-cypress` — opens Cypress UI for e2e tests
- `yarn test-cypress-headless` — runs Cypress in CI mode

### Unit Test Conventions
- Tests live in `src/__tests__/` matching the module they test
- SDK is mocked via `src/__mocks__/@openshift-console/dynamic-plugin-sdk.ts`
- Jest config uses `ts-jest` preset with module name mapping for the SDK mock

## Build & Deployment

### Building Image
```bash
docker build -t quay.io/my-repository/cluster-update-console-plugin:latest .
# For Apple Silicon: add --platform=linux/amd64
```

### Deploying via Helm
```bash
helm upgrade -i cluster-update-console-plugin charts/openshift-console-plugin \
  -n cluster-update-console-plugin \
  --create-namespace \
  --set plugin.image=my-plugin-image-location
```

### Deploying to Internal Registry
```bash
# Push to cluster internal registry
REGISTRY=$(oc get route default-route -n openshift-image-registry -o jsonpath='{.spec.host}')
TOKEN=$(oc create token builder -n cluster-update-console-plugin)
docker save cluster-update-console-plugin:latest | \
  skopeo copy --dest-tls-verify=false --dest-creds="unused:${TOKEN}" \
  docker-archive:/dev/stdin \
  docker://${REGISTRY}/cluster-update-console-plugin/cluster-update-console-plugin:latest

# Deploy with internal registry image
helm upgrade -i cluster-update-console-plugin charts/openshift-console-plugin \
  -n cluster-update-console-plugin \
  --set plugin.image=image-registry.openshift-image-registry.svc:5000/cluster-update-console-plugin/cluster-update-console-plugin:latest
```

## Important Constraints & Gotchas

1. **i18n namespace must match ConsolePlugin resource name** with `plugin__` prefix
2. **CSS class prefixes prevent style conflicts** — always use `cluster-update-plugin__`
3. **Module federation requires exact module mapping** — `exposedModules` must match `$codeRef` values
4. **PatternFly CSS variables only** — hex colors break dark mode
5. **No webpack HMR for extensions** — changes to `console-extensions.json` require restart
6. **React 17, not 18** — matches console's React version
7. **Proposal CRD is optional** — all code paths must handle missing `agentic.openshift.io` resources gracefully
8. **`getAnalysisData` is computed once** — in `ActivePlanView`, passed down as `analysisData` prop. Never call it in child components.

## Code Style Preferences

- Functional components with hooks (NO classes)
- TypeScript for all new files
- Use PatternFly components whenever possible
- Keep components focused and composable
- Prefer named exports for components
- Use `React.FC` or explicit return types
- CSS-in-files (not CSS-in-JS)
- No comments unless the WHY is non-obvious

## References

- [Console Plugin SDK](https://github.com/openshift/console/tree/master/frontend/packages/console-dynamic-plugin-sdk)
- [PatternFly React](https://www.patternfly.org/get-started/develop)
- [Lightspeed Operator](https://github.com/openshift/lightspeed-operator)
- [Dynamic Plugin Enhancement Proposal](https://github.com/openshift/enhancements/blob/master/enhancements/console/dynamic-plugins.md)
