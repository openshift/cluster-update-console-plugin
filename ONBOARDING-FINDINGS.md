# OCPSTRAT-2241: Onboarding Findings & Dev Environment Guide

Team onboarding notes for the green-koala pod. Based on hands-on cluster exploration on 2026-06-01.

## Dev Environment Setup

### Step 1: Get a cluster

DM `@Cluster Bot` on Slack:

```
launch 5.0.0-0.ci gcp,techpreview
```

Takes ~1 hour. Download the kubeconfig and `export KUBECONFIG=/tmp/kubeconfig`.

Pro tip: schedule the Slack message to send an hour before you start work.

### Step 2: Point at Fauxinnati for fake update recommendations

CI clusters don't get real update advice. Use Fauxinnati to simulate:

```bash
oc patch clusterversion version --type json -p '[{"op": "add", "path": "/spec/upstream", "value": "https://fauxinnati-fauxinnati.apps.ota-stage.q2z4.p1.openshiftapps.com/api/upgrades_info/graph"}]'
oc adm upgrade channel simple
```

The `Upgradeable=False` warning is expected on techpreview clusters — ignore it.

Verify updates are visible:

```bash
oc adm upgrade
```

You should see recommended updates like `5.0.1`.

Alternative: hard-code custom JSON per [CVO docs](https://github.com/openshift/cluster-version-operator/blob/main/docs/dev/feed-cvo-custom-graphs.md).

### Step 3: Verify CVO creates Proposal CRs

Hongkai's CVO code (PR [cvo#1382](https://github.com/openshift/cluster-version-operator/pull/1382)) automatically translates availableUpdates into Proposals:

```bash
oc -n openshift-lightspeed get proposals.agentic.openshift.io
```

Expected output: one Proposal per available update edge (e.g., `ota-5-0-0-0-ci-...-to-5-0-1`).

### Step 4: Mock an AnalysisResult

Without OLS installed, Proposals have no status (no analysis happens). Create mock data:

1. Apply the mock AnalysisResult:
```bash
oc apply -f mock-analysis-result.yaml
```

2. Patch the parent Proposal's status to reference it:
```bash
oc -n openshift-lightspeed patch --subresource status proposals.agentic.openshift.io ota-5-0-0-0-ci-2026-05-31-043410-to-5-0-1 --type merge -p '{"status":{"conditions":[{"type":"Analyzed","status":"True","reason":"AnalysisComplete","message":"Upgrade analysis completed successfully.","lastTransitionTime":"2026-06-01T15:00:00Z"}],"steps":{"analysis":{"conditions":[{"type":"Complete","status":"True","reason":"Succeeded","message":"Analysis finished with 1 option.","lastTransitionTime":"2026-06-01T15:00:00Z"}],"results":[{"name":"ota-5-0-0-0-ci-2026-05-31-043410-to-5-0-1-analysis-1","outcome":"Succeeded"}]}}}}'
```

3. Verify:
```bash
oc -n openshift-lightspeed get analysisresults
oc -n openshift-lightspeed get proposals.agentic.openshift.io ota-5-0-0-0-ci-2026-05-31-043410-to-5-0-1 -o jsonpath='{.status}' | python3 -m json.tool
```

Note: the mock YAML references a specific Proposal UID. If your cluster generates different Proposals, update the `ownerReferences.uid` and names accordingly.

### Step 5: Run the console plugin

See the plugin repo README and `start-console.sh`. The plugin needs Trevor's [cvo#1388](https://github.com/openshift/cluster-version-operator/pull/1388) to bootstrap properly — that PR has CI failures (SSH/bootstrap issues). See "Known Blockers" below.

---

## Actual API (as observed on 5.0.0-0.ci cluster)

### CRDs registered under `agentic.openshift.io/v1alpha1`

| Resource | Kind | Namespaced | Purpose |
|----------|------|------------|---------|
| `proposals` | Proposal | Yes (`openshift-lightspeed`) | Upgrade plan CRs created by CVO |
| `analysisresults` | AnalysisResult | Yes (`openshift-lightspeed`) | AI analysis output (risk, diagnosis, actions) |
| `agents` | Agent | No (cluster-scoped) | Agent configuration |
| `llmproviders` | LLMProvider | No (cluster-scoped) | LLM backend config |

### Proposal CR structure

```yaml
apiVersion: agentic.openshift.io/v1alpha1
kind: Proposal
metadata:
  namespace: openshift-lightspeed
  labels:
    agentic.openshift.io/current-version: "5.0.0-..."
    agentic.openshift.io/target-version: "5.0.1"
    agentic.openshift.io/update-type: Patch
    agentic.openshift.io/source: cluster-version-operator
spec:
  analysis:
    agent: smart                    # references an Agent CR
  request: |                        # the prompt sent to the AI agent
    You are an OpenShift upgrade advisor...
  tools:
    skills:
      - image: quay.io/openshift/ci:ocp_5.0_agentic-skills
        paths: [...]
status:
  conditions:                       # standard k8s conditions: Analyzed, Approved, etc.
  steps:
    analysis:
      conditions: [...]
      results:                      # references to AnalysisResult CRs
        - name: "...-analysis-1"
          outcome: Succeeded
      sandbox:
        claimName: ...
        namespace: ...
    execution:  { ... }             # same structure
    verification: { ... }
    escalation: { ... }
```

### AnalysisResult CR structure

```yaml
apiVersion: agentic.openshift.io/v1alpha1
kind: AnalysisResult
metadata:
  namespace: openshift-lightspeed
  ownerReferences: [parent Proposal]
spec:
  proposalName: "..."               # links back to parent
status:
  conditions: [...]
  sandbox: { claimName, namespace }
  failureReason: "..."              # only on failure
  options:                          # array of RemediationOptions (up to 10)
    - title: "Update to 5.0.1"
      summary: "one-liner for collapsed views"
      diagnosis:
        summary: "markdown analysis"
        rootCause: "concise root cause"
        confidence: Low | Medium | High
      proposal:
        description: "markdown plan"
        risk: Low | Medium | High | Critical
        estimatedImpact: "~45 minutes"
        reversible: Reversible | Irreversible | Partial
        actions:
          - type: update
            description: "Set desiredUpdate to 5.0.1"
        rollbackPlan:
          description: "..."
          command: "..."             # optional
      verification:
        description: "post-upgrade checks"
        steps:
          - name: "cluster-operators-available"
            type: command
            command: "oc get co ..."
            expected: "All Available=True"
      rbac:
        clusterScoped:
          - apiGroups: [...]
            resources: [...]
            verbs: [...]
            justification: "why this permission is needed"
        namespaceScoped: [...]
      components: {}                 # free-form adapter-specific UI data
```

---

## Console Plugin API Mismatches

The plugin code (`src/models/proposal.ts`) was built against an earlier API version. Key mismatches that need fixing:

### Critical: Analysis data location

| Plugin expects | Actual CRD |
|----------------|-----------|
| `proposal.status.steps.analysis.options[]` (inline) | Options live on a **separate `AnalysisResult` CR**, referenced via `proposal.status.steps.analysis.results[].name` |

**Fix required:** Add an `AnalysisResult` k8s model + a `useAnalysisResults` hook. Join Proposal + AnalysisResult in the components.

### Status phase vs conditions

| Plugin expects | Actual CRD |
|----------------|-----------|
| `status.phase` (string enum: Pending, Analyzing, Proposed, ...) | `status.conditions[]` (standard k8s conditions: Analyzed, Approved, Executed, Verified, Escalated) |

**Fix required:** Derive display phase from conditions instead of reading a phase field.

### Spec shape

| Plugin expects | Actual CRD |
|----------------|-----------|
| `spec.workflow` (string) | `spec.analysis.agent` (string) |
| `spec.request` (string) | `spec.request` (string) — matches |
| `spec.targetNamespaces` | Not observed on upgrade proposals |

### Reversible field

| Plugin expects | Actual CRD |
|----------------|-----------|
| `reversible: boolean` | `reversible: enum (Reversible, Irreversible, Partial)` |

### Risk field casing

| Plugin expects | Actual CRD |
|----------------|-----------|
| `risk: "low" / "medium" / "high" / "critical"` (lowercase) | `risk: "Low" / "Medium" / "High" / "Critical"` (capitalized) |

---

## Known Blockers

1. **cvo#1388 (console plugin bootstrap)** — Trevor's PR to integrate the plugin into the OCP payload is failing CI with bootstrap/SSH errors. Debugging help welcome. [Prow logs](https://prow.ci.openshift.org/view/gs/test-platform-results/pr-logs/pull/openshift_cluster-version-operator/1388/pull-ci-openshift-cluster-version-operator-main-e2e-agnostic-ovn-techpreview-serial-1of3/2054380433734373376#1:build-log.txt%3A254-255).

2. **No dev-branch OLS install docs** — Nobody has documented how to install the dev-branch lightspeed-agentic-operator. Ask in `#wg-ols-agentic`. Whoever figures it out should document it.

3. **Cluster Readiness Data is empty** — The CVO creates Proposals with `{}` in the readiness data JSON block. Populating this with actual cluster health checks is in-flight work (OTA-1966).

4. **Vikram's review notes** — [PR#4 review comments](https://github.com/openshift/cluster-update-console-plugin/pull/4#pullrequestreview-4162437556) were merged without being addressed. Follow-up PR needed.

---

## Key Repos

| Repo | What | Primary contact |
|------|------|-----------------|
| [cluster-update-console-plugin](https://github.com/openshift/cluster-update-console-plugin) | Console plugin (our primary deliverable) | Trevor King (wking) |
| [agentic-skills](https://github.com/openshift/agentic-skills) | Python skills/prompts for upgrade analysis | Trevor King |
| [lightspeed-agentic-operator](https://github.com/openshift/lightspeed-agentic-operator) | Go operator — CRDs, reconcilers, sandbox management | OLS team (Haoyu Sun, Ondrej Metelka) |
| [lightspeed-agentic-sandbox](https://github.com/openshift/lightspeed-agentic-sandbox) | Python sandbox where AI agent runs | OLS team |
| [lightspeed-agentic-console](https://github.com/openshift/lightspeed-agentic-console) | Broader agentic OLS console plugin | OLS team (Andrew Pickering) |
| [cluster-version-operator](https://github.com/openshift/cluster-version-operator) | CVO — creates Proposals from availableUpdates | Hongkai Liu |

## Slack Channels

- `#tmp-cluster-upgrade-experience+` — cross-team coordination for OCPSTRAT-2241
- `#wg-ocp-5-in-cluster-update-web-console` — console plugin working group
- `#wg-ols-agentic` — OLS agentic platform team

## Jira

- Feature: [OCPSTRAT-2241](https://redhat.atlassian.net/browse/OCPSTRAT-2241)
- Console UI epic: [OTA-1942](https://redhat.atlassian.net/browse/OTA-1942)
- Lifecycle controller epic: [OTA-1941](https://redhat.atlassian.net/browse/OTA-1941)
- Analysis intelligence epic: [OTA-1938](https://redhat.atlassian.net/browse/OTA-1938)
- Infra validation epic: [OTA-1937](https://redhat.atlassian.net/browse/OTA-1937)
