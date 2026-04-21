import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Alert, Badge, Card, CardBody, CardTitle, Content, Icon } from '@patternfly/react-core';
import { CheckCircleIcon } from '@patternfly/react-icons';
import {
  AnalysisData,
  getFindings,
  ACTION_TYPES,
} from '../../models/proposal';
import { I18N_NAMESPACE } from '../../utils/constants';

type PrerequisitesSidebarProps = {
  analysisData: AnalysisData;
};

type PrerequisiteItem = {
  description: string;
};

const extractPrerequisites = (analysisData: AnalysisData): PrerequisiteItem[] => {
  const prerequisites: PrerequisiteItem[] = [];
  const seen = new Set<string>();

  const { option, components } = analysisData;

  if (option?.proposal?.actions) {
    option.proposal.actions.forEach((action) => {
      if (action.type === ACTION_TYPES.prerequisite) {
        const desc = action.description;
        if (!seen.has(desc)) {
          seen.add(desc);
          prerequisites.push({ description: desc });
        }
      }
    });
  }

  const findings = getFindings(components);
  findings.forEach((finding) => {
    if (finding.prerequisite) {
      const desc = finding.prerequisite;
      if (!seen.has(desc)) {
        seen.add(desc);
        prerequisites.push({ description: desc });
      }
    }
  });

  return prerequisites;
};

const PrerequisitesSidebar: React.FC<PrerequisitesSidebarProps> = ({ analysisData }) => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const prerequisites = React.useMemo(() => extractPrerequisites(analysisData), [analysisData]);

  return (
    <Card className="cluster-update-plugin__prerequisites-sidebar">
      <CardTitle className="cluster-update-plugin__prerequisites-card-title">
        <span className="cluster-update-plugin__prerequisites-heading">{t('Prerequisites')}</span>
        <Badge isRead>{prerequisites.length}</Badge>
      </CardTitle>
      <CardBody>
        {prerequisites.length === 0 ? (
          <Content component="p" className="cluster-update-plugin__prerequisites-ready">
            <Icon status="success">
              <CheckCircleIcon />
            </Icon>
            <span>{t('Ready to proceed')}</span>
          </Content>
        ) : (
          <div className="cluster-update-plugin__prerequisites-list">
            {prerequisites.map((prereq, index) => (
              <div key={index}>
                <Alert
                  variant="info"
                  isInline
                  isPlain
                  title={prereq.description}
                  className="cluster-update-plugin__prerequisites-item"
                />
                {/etcd/i.test(prereq.description) && (
                  <Link
                    to="/k8s/ns/openshift-etcd/core~v1~Pod"
                    className="cluster-update-plugin__check-link cluster-update-plugin__prereq-link"
                  >
                    {t('View etcd pods')}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default PrerequisitesSidebar;
