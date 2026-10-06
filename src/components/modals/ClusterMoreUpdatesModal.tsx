import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Alert,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { ClusterVersion } from '../../models/clusterversion';
import { I18N_NAMESPACE } from '../../utils/constants';
import {
  getSortedAvailableUpdates,
  getConditionUpgradeableFalse,
  getLastCompletedUpdate,
  isMinorVersionNewer,
  getReleaseNotesLink,
} from '../../utils/cluster-updates';
import { ReleaseNotesLink } from '../cluster-updates/SupportingComponents';

type ClusterMoreUpdatesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  clusterVersion: ClusterVersion;
};

export const ClusterMoreUpdatesModal: React.FC<ClusterMoreUpdatesModalProps> = ({
  isOpen,
  onClose,
  clusterVersion,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  const availableUpdates = getSortedAvailableUpdates(clusterVersion);
  const moreAvailableUpdates = availableUpdates.slice(1).reverse();
  const clusterUpgradeableFalse = !!getConditionUpgradeableFalse(clusterVersion);
  const releaseNotesAvailable = moreAvailableUpdates.some((update) =>
    getReleaseNotesLink(update.version),
  );

  return (
    <Modal
      variant={ModalVariant.small}
      isOpen={isOpen}
      onClose={onClose}
      aria-labelledby="cluster-more-updates-modal-title"
    >
      <ModalHeader title={t('Other available paths')} labelId="cluster-more-updates-modal-title" />
      <ModalBody>
        {clusterUpgradeableFalse && (
          <Alert
            variant="warning"
            isInline
            title={t('Cluster is not upgradeable')}
            className="pf-v6-u-mb-md"
          >
            {t(
              'Cannot upgrade to a newer minor version. Check the cluster conditions for more details.',
            )}
          </Alert>
        )}
        <Table variant="compact" borders>
          <Thead>
            <Tr>
              <Th>{t('Version')}</Th>
              {releaseNotesAvailable && <Th>{t('Release notes')}</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {moreAvailableUpdates.map((update) => {
              const isBlocked =
                clusterUpgradeableFalse &&
                isMinorVersionNewer(getLastCompletedUpdate(clusterVersion) || '', update.version);
              return (
                <Tr key={update.version}>
                  <Td>
                    {update.version}
                    {isBlocked && (
                      <span className="pf-v6-u-ml-sm pf-v6-u-color-200">{t('(blocked)')}</span>
                    )}
                  </Td>
                  {releaseNotesAvailable && (
                    <Td>
                      {getReleaseNotesLink(update.version) ? (
                        <ReleaseNotesLink version={update.version} />
                      ) : (
                        '-'
                      )}
                    </Td>
                  )}
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="primary" onClick={onClose}>
          {t('Close')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
