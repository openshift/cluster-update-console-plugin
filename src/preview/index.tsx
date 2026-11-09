import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { Button, FormSelect, FormSelectOption, Label } from '@patternfly/react-core';
import '@patternfly/react-core/dist/styles/base.css';
import ClusterUpdatePage from '../components/ClusterUpdatePage';
import { I18N_NAMESPACE } from '../utils/constants';
import { type Scenario } from './data';
import { setScenario, usePreview } from './store';
import './preview.css';

const Preview = () => {
  const { t } = useTranslation(I18N_NAMESPACE);
  const { scenario } = usePreview();
  const [reset, setReset] = useState(0);
  const selectScenario = (next: Scenario) => {
    setScenario(next);
    setReset((value) => value + 1);
  };
  const scenarios: [Scenario, string][] = [
    ['Pending', t('Pending')],
    ['Analyzing', t('Analyzing')],
    ['Proposed', t('Awaiting decision')],
    ['Executing', t('Executing')],
    ['AwaitingVerification', t('Awaiting verification')],
    ['Verifying', t('Verifying')],
    ['Completed', t('Completed')],
    ['AnalysisFailed', t('Analysis failed')],
    ['ExecutionFailed', t('Execution failed')],
    ['VerificationFailed', t('Verification failed')],
    ['Denied', t('Denied')],
    ['NoAction', t('No action required')],
  ];
  return (
    <>
      <header className="cluster-update-plugin__preview-toolbar">
        <div>
          <strong>{t('Local preview')}</strong>{' '}
          <Label isCompact color="blue">
            {t('Sample data')}
          </Label>
        </div>
        <label className="cluster-update-plugin__preview-scenario">
          {t('Preview stage')}
          <FormSelect
            aria-label={t('Preview stage')}
            value={scenario}
            onChange={(_event, value) => selectScenario(value as Scenario)}
          >
            {scenarios.map(([value, label]) => (
              <FormSelectOption key={value} value={value} label={label} />
            ))}
          </FormSelect>
        </label>
        <Button variant="secondary" onClick={() => selectScenario('Proposed')}>
          {t('Reset preview')}
        </Button>
        <Button
          variant="link"
          onClick={() => document.documentElement.classList.toggle('pf-v6-theme-dark')}
        >
          {t('Toggle theme')}
        </Button>
      </header>
      <main className="cluster-update-plugin__preview-content">
        <ClusterUpdatePage key={reset} />
      </main>
    </>
  );
};

void fetch(`/locales/en/${I18N_NAMESPACE}.json`)
  .then((response) => response.json())
  .then((messages) =>
    i18next.init({
      lng: 'en',
      fallbackLng: 'en',
      defaultNS: I18N_NAMESPACE,
      resources: { en: { [I18N_NAMESPACE]: messages } },
      showSupportNotice: false,
    }),
  )
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <I18nextProvider i18n={i18next}>
        <Preview />
      </I18nextProvider>,
    );
  });
