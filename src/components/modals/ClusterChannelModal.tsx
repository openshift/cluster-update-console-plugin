import * as React from 'react';
import { useTranslation } from 'react-i18next';
import * as semver from 'semver';
import {
  Button,
  Content,
  ContentVariants,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  TextInput,
  Alert,
} from '@patternfly/react-core';
import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterVersion, ClusterVersionModel } from '../../models/clusterversion';
import { I18N_NAMESPACE } from '../../utils/constants';
import { getAvailableClusterChannels, getLastCompletedUpdate } from '../../utils/cluster-updates';

type ClusterChannelModalProps = {
  isOpen: boolean;
  onClose: () => void;
  clusterVersion: ClusterVersion;
};

export const ClusterChannelModal: React.FC<ClusterChannelModalProps> = ({
  isOpen,
  onClose,
  clusterVersion,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const [channel, setChannel] = React.useState(clusterVersion.spec?.channel || '');
  const [inProgress, setInProgress] = React.useState(false);
  const [error, setError] = React.useState('');

  const availableChannels = getAvailableClusterChannels(clusterVersion);
  const version = semver.parse(getLastCompletedUpdate(clusterVersion) || '');
  const versionMajor = version?.major ?? 4;
  const versionMinor = version?.minor ?? 0;
  const channelsExist = clusterVersion.status?.desired?.channels && clusterVersion.status.desired.channels.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInProgress(true);

    try {
      const patch = [{ op: 'add', path: '/spec/channel', value: channel }];
      await k8sPatch({
        model: ClusterVersionModel,
        resource: clusterVersion,
        data: patch,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to update channel');
    } finally {
      setInProgress(false);
    }
  };

  return (
    <Modal
      variant={ModalVariant.small}
      isOpen={isOpen}
      onClose={onClose}
      aria-labelledby="cluster-channel-modal-title"
    >
      <ModalHeader
        title={channelsExist ? t('Select channel') : t('Input channel')}
        labelId="cluster-channel-modal-title"
      />
      <ModalBody>
        <Form id="cluster-channel-form" onSubmit={handleSubmit}>
          <Content>
            <Content component={ContentVariants.p}>
              {channelsExist
                ? t(
                    'The current version is available in the channels listed in the dropdown below. Select a channel that reflects the desired version. Critical security updates will be delivered to any vulnerable channels.',
                  )
                : t(
                    'Input a channel that reflects the desired version. To verify if the version exists in a channel, save and check the update status. Critical security updates will be delivered to any vulnerable channels.',
                  )}
            </Content>
          </Content>
          <FormGroup label={t('Channel')} fieldId="channel">
            {channelsExist ? (
              <FormSelect
                id="channel"
                value={channel}
                onChange={(_event, value) => setChannel(value as string)}
              >
                {availableChannels.map((ch) => (
                  <FormSelectOption key={ch} value={ch} label={ch} />
                ))}
              </FormSelect>
            ) : (
              <>
                <TextInput
                  id="channel"
                  value={channel}
                  onChange={(_event, value) => setChannel(value)}
                  placeholder={t('e.g., {{version}}', {
                    version: `stable-${versionMajor}.${versionMinor}`,
                  })}
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>
                      {t('Potential channels are {{stable}}, {{fast}}, or {{candidate}}.', {
                        stable: `stable-${versionMajor}.${versionMinor}`,
                        fast: `fast-${versionMajor}.${versionMinor}`,
                        candidate: `candidate-${versionMajor}.${versionMinor}`,
                      })}
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </>
            )}
          </FormGroup>
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
          form="cluster-channel-form"
          isLoading={inProgress}
          isDisabled={inProgress}
        >
          {t('Save')}
        </Button>
        <Button variant="link" onClick={onClose} isDisabled={inProgress}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
