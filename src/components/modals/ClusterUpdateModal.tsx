import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Radio,
} from '@patternfly/react-core';
import { k8sPatch, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterVersion, ClusterVersionModel } from '../../models/clusterversion';
import {
  MachineConfigPool,
  MachineConfigPoolGVK,
  isMCPMaster,
  isMCPPaused,
  sortMCPsByCreationTimestamp,
} from '../../models/machineconfigpool';
import { I18N_NAMESPACE } from '../../utils/constants';
import {
  getSortedAvailableUpdates,
  getSortedNotRecommendedUpdates,
  getDesiredClusterVersion,
  getConditionUpgradeableFalse,
  isMinorVersionNewer,
  getNotRecommendedUpdateCondition,
  getMCPsToPausePromises,
} from '../../utils/cluster-updates';

type ClusterUpdateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  clusterVersion: ClusterVersion;
};

enum UpgradeTypes {
  Full = 'Full',
  Partial = 'Partial',
}

export const ClusterUpdateModal: React.FC<ClusterUpdateModalProps> = ({
  isOpen,
  onClose,
  clusterVersion,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [desiredVersion, setDesiredVersion] = React.useState('');
  const [upgradeType, setUpgradeType] = React.useState<UpgradeTypes>(UpgradeTypes.Full);
  const [includeNotRecommended, setIncludeNotRecommended] = React.useState(false);
  const [machineConfigPoolsToPause, setMachineConfigPoolsToPause] = React.useState<string[]>([]);
  const [inProgress, setInProgress] = React.useState(false);
  const [error, setError] = React.useState('');

  const [mcps, mcpsLoaded] = useK8sWatchResource<MachineConfigPool[]>({
    groupVersionKind: MachineConfigPoolGVK,
    isList: true,
  });

  const availableSortedUpdates = getSortedAvailableUpdates(clusterVersion);
  const notRecommendedSortedUpdates = getSortedNotRecommendedUpdates(clusterVersion);
  const currentVersion = getDesiredClusterVersion(clusterVersion);
  const clusterUpgradeableFalse = !!getConditionUpgradeableFalse(clusterVersion);

  const currentMinorVersionPatchUpdate = availableSortedUpdates?.find(
    (update) => currentVersion && !isMinorVersionNewer(currentVersion, update.version),
  );

  React.useEffect(() => {
    const initialVersion = clusterUpgradeableFalse
      ? currentMinorVersionPatchUpdate?.version
      : availableSortedUpdates[0]?.version;
    if (initialVersion && !desiredVersion) {
      setDesiredVersion(initialVersion);
    }
  }, [
    availableSortedUpdates,
    clusterUpgradeableFalse,
    currentMinorVersionPatchUpdate,
    desiredVersion,
  ]);

  React.useEffect(() => {
    // Initialize with currently paused MCPs
    const initialMCPPausedValues = mcps
      .filter((mcp) => !isMCPMaster(mcp) && isMCPPaused(mcp))
      .map((mcp) => mcp.metadata?.name || '')
      .filter((name) => name !== '');
    setMachineConfigPoolsToPause(initialMCPPausedValues);
  }, []); // Only run once on mount

  const pauseableMCPs = mcpsLoaded
    ? mcps.filter((mcp) => !isMCPMaster(mcp)).sort(sortMCPsByCreationTimestamp)
    : [];
  const pausedMCPs = pauseableMCPs.filter((mcp) => isMCPPaused(mcp));

  const desiredRecommendedUpdate = availableSortedUpdates.find(
    (update) => update.version === desiredVersion,
  );
  const desiredNotRecommendedUpdate = notRecommendedSortedUpdates.find(
    (update) => update.release.version === desiredVersion,
  );
  const desiredNotRecommendedUpdateConditions =
    desiredNotRecommendedUpdate?.conditions
      ? getNotRecommendedUpdateCondition(desiredNotRecommendedUpdate.conditions)
      : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!desiredRecommendedUpdate && !desiredNotRecommendedUpdate) {
      setError(
        t(
          'Version {{desiredVersion}} not found among the supported updates. Select another version.',
          { desiredVersion },
        ),
      );
      return;
    }

    setError('');
    setInProgress(true);

    try {
      let MCPsToPausePromises: Promise<any>[] = [];
      let MCPsToResumePromises: Promise<any>[] = [];

      if (upgradeType === UpgradeTypes.Full) {
        // Full update: resume all paused MCPs
        MCPsToPausePromises = [];
        MCPsToResumePromises = getMCPsToPausePromises(pausedMCPs, false);
      } else {
        // Partial update: pause selected MCPs, resume others
        const MCPsToPause = pauseableMCPs.filter((mcp) =>
          machineConfigPoolsToPause.find((m) => m === mcp.metadata?.name),
        );
        const MCPsToResume = pauseableMCPs.filter((mcp) => !MCPsToPause.includes(mcp));
        MCPsToPausePromises = getMCPsToPausePromises(MCPsToPause, true);
        MCPsToResumePromises = getMCPsToPausePromises(MCPsToResume, false);
      }

      const patch = [
        {
          op: 'add',
          path: '/spec/desiredUpdate',
          value: desiredNotRecommendedUpdate
            ? desiredNotRecommendedUpdate.release
            : desiredRecommendedUpdate,
        },
      ];

      // Patch ClusterVersion and MCPs in parallel
      await Promise.all([
        k8sPatch({
          model: ClusterVersionModel,
          resource: clusterVersion,
          data: patch,
        }),
        ...MCPsToResumePromises,
        ...MCPsToPausePromises,
      ]);

      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to update cluster version');
    } finally {
      setInProgress(false);
    }
  };

  return (
    <Modal
      variant={ModalVariant.small}
      isOpen={isOpen}
      onClose={onClose}
      aria-labelledby="cluster-update-modal-title"
    >
      <ModalHeader
        title={t('Select a version')}
        labelId="cluster-update-modal-title"
      />
      <ModalBody>
        <Form id="cluster-update-form" onSubmit={handleSubmit}>
        {clusterUpgradeableFalse && (
          <Alert
            variant="warning"
            isInline
            title={t('Cluster is not upgradeable')}
          >
            {t(
              'Cannot upgrade to a newer minor version. Check the cluster conditions for more details.',
            )}
          </Alert>
        )}

        <FormGroup label={t('Current version')} fieldId="current-version">
          <div>{currentVersion}</div>
        </FormGroup>

        <FormGroup label={t('Target version')} fieldId="version-select" isRequired>
          <FormSelect
            value={desiredVersion}
            onChange={(_event, value) => setDesiredVersion(value as string)}
            id="version-select"
          >
            <FormSelectOption key="placeholder" value="" label={t('Select a version')} isDisabled />
            <FormSelectOption
              key="recommended-group"
              value=""
              label={t('Recommended')}
              isDisabled
            />
            {availableSortedUpdates.map((update) => {
              const isDisabled =
                clusterUpgradeableFalse &&
                currentVersion &&
                isMinorVersionNewer(currentVersion, update.version);
              return (
                <FormSelectOption
                  key={update.version}
                  value={update.version}
                  label={`  ${update.version}${isDisabled ? ' (blocked)' : ''}`}
                  isDisabled={!!isDisabled}
                />
              );
            })}
            {includeNotRecommended && notRecommendedSortedUpdates.length > 0 && (
              <>
                <FormSelectOption
                  key="not-recommended-group"
                  value=""
                  label={t('Have known issues')}
                  isDisabled
                />
                {notRecommendedSortedUpdates.map((update) => {
                  const isDisabled =
                    clusterUpgradeableFalse &&
                    currentVersion &&
                    isMinorVersionNewer(currentVersion, update.release.version);
                  return (
                    <FormSelectOption
                      key={update.release.version}
                      value={update.release.version}
                      label={`  ${update.release.version}${isDisabled ? ' (blocked)' : ''}`}
                      isDisabled={!!isDisabled}
                    />
                  );
                })}
              </>
            )}
          </FormSelect>
          {notRecommendedSortedUpdates.length > 0 && (
            <div className="pf-v6-u-mt-sm">
              <label>
                <input
                  type="checkbox"
                  checked={includeNotRecommended}
                  onChange={(e) => setIncludeNotRecommended(e.target.checked)}
                  className="pf-v6-u-mr-xs"
                />
                {t('Include versions with known issues')}
              </label>
            </div>
          )}
          {desiredNotRecommendedUpdate && desiredNotRecommendedUpdateConditions?.message && (
            <Alert
              variant="info"
              isInline
              className="pf-v6-u-mt-sm"
              title={t(
                'Updating your cluster to {{desiredVersion}} is supported, but it includes known issues.',
                { desiredVersion: desiredNotRecommendedUpdate.release.version },
              )}
            >
              {desiredNotRecommendedUpdateConditions.message}
            </Alert>
          )}
        </FormGroup>

        <FormGroup
          label={t('Update options')}
          fieldId="update-options"
        >
          <Radio
            isChecked={upgradeType === UpgradeTypes.Full}
            name="upgrade-type"
            onChange={() => setUpgradeType(UpgradeTypes.Full)}
            label={t('Full cluster update')}
            id="full-update"
            value={UpgradeTypes.Full}
            description={t(
              'Control plane, worker, and custom pool nodes are updated concurrently.',
            )}
            className="pf-v6-u-mb-sm"
            body={
              pausedMCPs.length > 0 && upgradeType === UpgradeTypes.Full && (
                <Alert
                  variant="warning"
                  isInline
                  isPlain
                  title={t('The cluster will resume paused worker or custom pool node updates.')}
                />
              )
            }
          />
          <Radio
            isChecked={upgradeType === UpgradeTypes.Partial}
            name="upgrade-type"
            onChange={() => setUpgradeType(UpgradeTypes.Partial)}
            label={t('Control plane only update')}
            id="partial-update"
            value={UpgradeTypes.Partial}
            description={t('Pause worker or custom pool node updates.')}
            className="pf-v6-u-mb-md"
          />
        </FormGroup>

        <Alert
          variant="warning"
          isInline
          isPlain
          title={t('Cluster updates are irreversible')}
        >
          {t('After an update begins, you cannot roll back to the previous version.')}
        </Alert>
      </Form>
    </ModalBody>
    <ModalFooter>
      {error && (
        <Alert variant="danger" isInline title={t('Error')} className="pf-v6-u-mb-md">
          {error}
        </Alert>
      )}
      <Button
        type="submit"
        variant="primary"
        form="cluster-update-form"
        isLoading={inProgress}
        isDisabled={!desiredVersion || inProgress}
      >
        {t('Update cluster')}
      </Button>
      <Button variant="link" onClick={onClose} isDisabled={inProgress}>
        {t('Cancel')}
      </Button>
    </ModalFooter>
  </Modal>
  );
};
