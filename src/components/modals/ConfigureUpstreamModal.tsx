import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Content,
  ContentVariants,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Radio,
  TextInput,
} from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import { ClusterVersion, ClusterVersionModel } from '../../models/clusterversion';
import { I18N_NAMESPACE } from '../../utils/constants';

type ConfigureUpstreamModalProps = {
  isOpen: boolean;
  onClose: () => void;
  clusterVersion: ClusterVersion;
};

const DEFAULT_UPSTREAM_PLACEHOLDER = 'https://api.openshift.com/api/upgrades_info/v1/graph';

export const ConfigureUpstreamModal: React.FC<ConfigureUpstreamModalProps> = ({
  isOpen,
  onClose,
  clusterVersion,
}) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const currentUpstream = clusterVersion.spec?.upstream;

  const [customSelected, setCustomSelected] = React.useState(!!currentUpstream);
  const [customURL, setCustomURL] = React.useState(currentUpstream || '');
  const [invalidCustomURL, setInvalidCustomURL] = React.useState(false);
  const [inProgress, setInProgress] = React.useState(false);
  const [error, setError] = React.useState('');

  const customURLInputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (customSelected) {
      if (!customURL) {
        setInvalidCustomURL(true);
        return;
      }
      if (customURL === currentUpstream) {
        onClose();
        return;
      }
    } else if (!currentUpstream) {
      onClose();
      return;
    }

    setError('');
    setInProgress(true);

    try {
      const value = customSelected ? customURL : null;
      const patch = [{ op: 'add', path: '/spec/upstream', value }];
      await k8sPatch({
        model: ClusterVersionModel,
        resource: clusterVersion,
        data: patch,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to update upstream configuration');
    } finally {
      setInProgress(false);
    }
  };

  return (
    <Modal
      variant={ModalVariant.small}
      isOpen={isOpen}
      onClose={onClose}
      aria-labelledby="configure-cluster-upstream-modal-title"
    >
      <ModalHeader
        title={t('Edit upstream configuration')}
        labelId="configure-cluster-upstream-modal-title"
      />
      <ModalBody>
        <Content component={ContentVariants.p}>
          {t(
            'Select a configuration to receive updates. Updates can be configured to receive information from Red Hat or a custom update service.',
          )}
        </Content>
        <Form id="configure-cluster-upstream-form" onSubmit={handleSubmit}>
          <FormGroup label={t('Configuration')} role="radiogroup" isStack>
            <Radio
              name="config-default"
              id="config-default"
              onChange={() => {
                setCustomSelected(false);
                setInvalidCustomURL(false);
              }}
              label={t('Default')}
              isChecked={!customSelected}
              body={
                !customSelected && (
                  <>
                    <TextInput
                      id="cluster-version-default-upstream-server-url"
                      type="url"
                      readOnly
                      value={DEFAULT_UPSTREAM_PLACEHOLDER}
                    />
                    <FormHelperText className="pf-v6-u-mt-sm">
                      <HelperText>
                        <HelperTextItem>
                          {t('Receive update information from Red Hat.')}
                        </HelperTextItem>
                      </HelperText>
                    </FormHelperText>
                  </>
                )
              }
            />
            <Radio
              name="config-custom"
              id="config-custom"
              onChange={() => {
                setCustomSelected(true);
                setTimeout(() => {
                  customURLInputRef.current?.focus();
                }, 0);
              }}
              label={t('Custom update service')}
              isChecked={customSelected}
              body={
                customSelected && (
                  <>
                    <TextInput
                      id="cluster-version-custom-upstream-server-url"
                      type="url"
                      placeholder="https://example.com/api/upgrades_info/v1/graph"
                      value={customURL}
                      onChange={(_event, text) => {
                        setCustomSelected(true);
                        setCustomURL(text);
                        setInvalidCustomURL(false);
                      }}
                      validated={invalidCustomURL ? 'error' : 'default'}
                      ref={customURLInputRef}
                    />
                    {invalidCustomURL && (
                      <FormHelperText className="pf-v6-u-mt-sm">
                        <HelperText>
                          <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                            {t('Please enter a URL.')}
                          </HelperTextItem>
                        </HelperText>
                      </FormHelperText>
                    )}
                  </>
                )
              }
            />
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
          form="configure-cluster-upstream-form"
          isLoading={inProgress}
          isDisabled={inProgress || invalidCustomURL}
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
