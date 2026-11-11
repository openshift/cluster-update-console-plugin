# Temporary Lightspeed component copies

These components are adapted from
[openshift/lightspeed-agentic-console at `203075b`](https://github.com/openshift/lightspeed-agentic-console/tree/203075b)
(Apache-2.0). They are local copies to unblock the embedded Cluster Update experience;
they are not an exported Lightspeed API and do not automatically receive upstream fixes.

## Provenance and adaptations

| Local component | Upstream source | Local adaptations |
| --- | --- | --- |
| `RemediationOptionCard.tsx` | `src/components/runs/detail/RemediationOptionCard.tsx` | Uses our raw `RemediationOption` rather than the private Lightspeed view model; local i18n/CSS; retains risk labels; optional selection for diagnosis-only/read-only views; accessible disclosure IDs; first proposed option is labeled AI recommended, matching upstream; omits download UI. |
| `RequiredPermissions.tsx` | `src/components/runs/detail/RequiredPermissions.tsx` | Uses our RBAC types and local i18n/CSS; matches upstream permission counts, scoped-privileges notice, write summaries, namespace links, resource icons, and verb labels; retains a level-four heading and an accessible table name. |

`src/utils/rbac-utils.ts` is adapted from the upstream helper at the same revision
for permission scope, write summaries, and resource discovery.

Markdown uses this plugin's existing sanitized `MarkdownContent`. Approval/rejection
and log streaming remain owned by the update page. Commands are displayed here, but
execution is performed by the agent after an `AgenticRunApproval` decision.

`ProposedCommands.tsx` and `VerificationPlan.tsx` are local presentation adaptations:
commands and verification checks appear in collapsed-by-default tables matching
Required permissions. They preserve original step order and copyable commands;
verification also includes check names and expected results. `StepTypeLabel.tsx`
provides consistent type colors for both tables.

## TODO: replace these copies with supported shared components

- [ ] Agree a supported cross-plugin component contract with the Lightspeed console team:
  plan data, original option indices, controlled selection/expansion, read-only state,
  and approval callbacks. Keep update-specific readiness rendering in this plugin.
- [ ] Expose the components through a versioned Console extension/code-reference contract
  (or another agreed shared distribution), including their CSS, translations and types.
- [ ] Resolve the Console SDK baseline: upstream at this revision requires plugin API
  4.23, while this plugin currently declares 4.22. Test both plugins against the selected
  Console/React/PatternFly versions before switching to runtime reuse.
- [ ] Define behavior when the supplying plugin is absent, disabled, incompatible or fails
  to load. Keep available update information usable and show a clear integration error.
- [ ] Reconcile the adaptations above, including accessibility and permission rendering,
  with upstream before replacing the copies. Review relevant upstream fixes while these
  copies remain in use; do not assume the implementations stay synchronized.
- [ ] Evaluate reuse of execution/verification views and logs separately. A shared log
  interface must support run UID, phase, actual pod discovery, start boundaries and
  retained logs, without introducing duplicate viewers.
- [ ] Replace local copies and remove their copy-specific CSS/documentation only after
  integration tests cover selection, approval/rejection, diagnosis-only results, commands,
  permissions, missing-provider handling and phase transitions.

## Approval invariants to preserve during migration

- The selected index refers to the original analysis-result options array.
- Approval patches only `AgenticRunApproval`; the UI does not patch
  `ClusterVersion.spec.desiredUpdate` or execute displayed commands.
- Preserve the run's configured agent unless a user explicitly chooses an override.
- Denial includes the stage-specific object required by the CRD.
- A changed analysis or selected option invalidates the previous confirmation.
- An existing decision or a concurrent resource change must not be silently overwritten.

This temporary approach follows the implementation choice to copy components for now.
The long-term goal remains the Oct 26 OCPSTRAT-3563 discussion's centralized maintenance,
with approval/rejection available in the Cluster Update page.
