import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  FormSelect,
  FormSelectOption,
  Icon,
  Split,
  SplitItem,
} from '@patternfly/react-core';
import { RobotIcon } from '@patternfly/react-icons';
import { ClusterVersion, Release } from '../../models/clusterversion';
import { LightspeedProposal } from '../../models/proposal';
import { I18N_NAMESPACE } from '../../utils/constants';
import { compareSemVer } from '../../utils/version';
import { useCreateProposal } from '../../hooks/useCreateProposal';

type AIUpdateAgentCardProps = {
  clusterVersion: ClusterVersion;
  proposals: LightspeedProposal[];
};

const AIUpdateAgentCard: React.FC<AIUpdateAgentCardProps> = ({ clusterVersion, proposals }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const channel = clusterVersion.spec?.channel ?? '';
  const sortedUpdates = React.useMemo(
    () =>
      [...(clusterVersion.status?.availableUpdates ?? [])].sort((a, b) =>
        compareSemVer(b.version, a.version),
      ),
    [clusterVersion.status?.availableUpdates],
  );

  const [selectedVersion, setSelectedVersion] = React.useState('');
  const { requestProposal, creating, error: createError } = useCreateProposal();

  const completedCount = React.useMemo(
    () => proposals.filter((p) => p.status?.phase === 'Completed').length,
    [proposals],
  );
  const totalPlans = proposals.length;

  const handleGenerate = React.useCallback(() => {
    if (!selectedVersion) return;
    requestProposal(clusterVersion, selectedVersion);
  }, [selectedVersion, clusterVersion, requestProposal]);

  return (
    <Card isCompact>
      <CardTitle>
        <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
          <FlexItem>
            <Icon>
              <RobotIcon />
            </Icon>
          </FlexItem>
          <FlexItem>{t('AI Update Agent')}</FlexItem>
        </Flex>
      </CardTitle>
      <CardBody>
        <Content component="p" className="cluster-update-plugin__agent-subtitle">
          {t('Activity summary and the current proposed plan - {{channel}} channel', { channel })}
        </Content>

        <Split hasGutter className="cluster-update-plugin__agent-stats">
          <SplitItem>
            <DescriptionList isHorizontal isCompact>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Plans Created')}</DescriptionListTerm>
                <DescriptionListDescription>{totalPlans}</DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
          </SplitItem>
          <SplitItem>
            <DescriptionList isHorizontal isCompact>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('Updates Executed')}</DescriptionListTerm>
                <DescriptionListDescription>{completedCount}</DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
          </SplitItem>
        </Split>

        <Content component="p" className="cluster-update-plugin__agent-target-label">
          {t('Agent target version')}
        </Content>
        <Content component="p" className="cluster-update-plugin__agent-target-desc">
          {t(
            'Pick a target from your channel (updates AI Assessment), then click Generate plan to build or refresh the proposed update below.',
          )}
        </Content>
        <Flex
          alignItems={{ default: 'alignItemsCenter' }}
          gap={{ default: 'gapMd' }}
          className="cluster-update-plugin__agent-controls"
        >
          <FlexItem>
            <FormSelect
              value={selectedVersion}
              onChange={(_event, value) => setSelectedVersion(value)}
              aria-label={t('Target version')}
              className="cluster-update-plugin__version-select"
            >
              <FormSelectOption key="" value="" label={t('Select a version')} isPlaceholder />
              {sortedUpdates.map((u: Release) => (
                <FormSelectOption key={u.version} value={u.version} label={u.version} />
              ))}
            </FormSelect>
          </FlexItem>
          <FlexItem>
            <Button
              variant="primary"
              isDisabled={!selectedVersion || creating}
              isLoading={creating}
              onClick={handleGenerate}
            >
              {t('Generate plan')}
            </Button>
          </FlexItem>
        </Flex>
        {createError && (
          <Alert
            variant="danger"
            isInline
            title={t('Failed to create plan')}
            className="cluster-update-plugin__agent-error"
          >
            {createError}
          </Alert>
        )}
      </CardBody>
    </Card>
  );
};

export default AIUpdateAgentCard;
