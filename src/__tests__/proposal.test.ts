import {
  getPhaseDisplay,
  getRiskColor,
  getAnalysisData,
  getReadinessSummary,
  getFindings,
  getOlmOperatorStatus,
  sortFindings,
  COMPONENT_TYPES,
  LightspeedProposal,
  AdapterComponent,
  OtaReadinessSummary,
  OtaFinding,
  OtaOlmOperatorStatus,
} from '../models/proposal';

describe('getPhaseDisplay', () => {
  it('maps known phases to expected colors', () => {
    expect(getPhaseDisplay('Pending')).toEqual({ color: 'grey', label: 'Pending' });
    expect(getPhaseDisplay('Analyzing')).toEqual({ color: 'blue', label: 'Analyzing' });
    expect(getPhaseDisplay('Proposed')).toEqual({ color: 'teal', label: 'Proposed' });
    expect(getPhaseDisplay('Approved')).toEqual({ color: 'blue', label: 'Approved' });
    expect(getPhaseDisplay('Executing')).toEqual({ color: 'purple', label: 'Executing' });
    expect(getPhaseDisplay('Verifying')).toEqual({ color: 'blue', label: 'Verifying' });
    expect(getPhaseDisplay('Completed')).toEqual({ color: 'green', label: 'Completed' });
    expect(getPhaseDisplay('Failed')).toEqual({ color: 'red', label: 'Failed' });
    expect(getPhaseDisplay('Denied')).toEqual({ color: 'red', label: 'Denied' });
    expect(getPhaseDisplay('AwaitingSync')).toEqual({ color: 'teal', label: 'Awaiting Sync' });
    expect(getPhaseDisplay('Escalated')).toEqual({ color: 'orangered', label: 'Escalated' });
  });

  it('returns grey with the phase as label for unknown phases', () => {
    expect(getPhaseDisplay('CustomPhase')).toEqual({ color: 'grey', label: 'CustomPhase' });
  });

  it('returns Unknown for undefined', () => {
    expect(getPhaseDisplay(undefined)).toEqual({ color: 'grey', label: 'Unknown' });
  });
});

describe('getRiskColor', () => {
  it('maps risk levels to colors', () => {
    expect(getRiskColor('low')).toBe('green');
    expect(getRiskColor('medium')).toBe('orange');
    expect(getRiskColor('high')).toBe('red');
    expect(getRiskColor('critical')).toBe('red');
  });

  it('returns grey for unknown risk', () => {
    expect(getRiskColor('something')).toBe('grey');
    expect(getRiskColor(undefined)).toBe('grey');
  });
});

describe('getAnalysisData', () => {
  const makeProposal = (overrides?: Partial<LightspeedProposal['status']>): LightspeedProposal =>
    ({
      spec: { request: 'test', workflow: 'ota-advisory' },
      status: overrides,
    }) as LightspeedProposal;

  it('returns undefined option when no status', () => {
    const result = getAnalysisData(makeProposal());
    expect(result.analysis).toBeUndefined();
    expect(result.option).toBeUndefined();
    expect(result.components).toEqual([]);
  });

  it('returns the first option by default', () => {
    const option = {
      title: 'Option A',
      summary: 'first',
      diagnosis: { summary: '', confidence: '', rootCause: '' },
      proposal: { description: '', actions: [], risk: 'low', reversible: true },
      components: [{ type: 'custom', data: 1 }],
    };
    const result = getAnalysisData(
      makeProposal({
        steps: { analysis: { options: [option] } },
      }),
    );
    expect(result.option).toBe(option);
    expect(result.components).toEqual(option.components);
  });

  it('respects selectedOption index', () => {
    const optionA = {
      title: 'A',
      summary: '',
      diagnosis: { summary: '', confidence: '', rootCause: '' },
      proposal: { description: '', actions: [], risk: 'low', reversible: true },
      components: [{ type: 'a' }],
    };
    const optionB = {
      title: 'B',
      summary: '',
      diagnosis: { summary: '', confidence: '', rootCause: '' },
      proposal: { description: '', actions: [], risk: 'low', reversible: true },
      components: [{ type: 'b' }],
    };
    const result = getAnalysisData(
      makeProposal({
        steps: { analysis: { selectedOption: 1, options: [optionA, optionB] } },
      }),
    );
    expect(result.option).toBe(optionB);
    expect(result.components).toEqual(optionB.components);
  });

  it('falls back to analysis-level components when option has none', () => {
    const option = {
      title: 'A',
      summary: '',
      diagnosis: { summary: '', confidence: '', rootCause: '' },
      proposal: { description: '', actions: [], risk: 'low', reversible: true },
    };
    const analysisComponents: AdapterComponent[] = [{ type: 'fallback' }];
    const result = getAnalysisData(
      makeProposal({
        steps: { analysis: { options: [option], components: analysisComponents } },
      }),
    );
    expect(result.components).toEqual(analysisComponents);
  });
});

describe('component extractors', () => {
  const readiness: OtaReadinessSummary = {
    type: COMPONENT_TYPES.readinessSummary,
    decision: 'recommend',
    checks: [{ name: 'api-compat', status: 'pass' }],
  };

  const finding: OtaFinding = {
    type: COMPONENT_TYPES.finding,
    severity: 'warning',
    check: 'api_deprecations',
    detail: 'Deprecated API in use',
  };

  const olmStatus: OtaOlmOperatorStatus = {
    type: COMPONENT_TYPES.olmOperatorStatus,
    operators: [],
    summary: {
      totalOperators: 5,
      pendingUpgrades: 1,
      manualApproval: 0,
      incompatibleWithTarget: 0,
    },
  };

  const components: AdapterComponent[] = [readiness, finding, olmStatus, { type: 'unknown' }];

  it('getReadinessSummary returns the readiness component', () => {
    expect(getReadinessSummary(components)).toBe(readiness);
  });

  it('getReadinessSummary returns undefined when not present', () => {
    expect(getReadinessSummary([{ type: 'other' }])).toBeUndefined();
  });

  it('getFindings returns only finding components', () => {
    const findings = getFindings(components);
    expect(findings).toEqual([finding]);
  });

  it('getFindings returns empty array when none present', () => {
    expect(getFindings([{ type: 'other' }])).toEqual([]);
  });

  it('getOlmOperatorStatus returns the OLM status component', () => {
    expect(getOlmOperatorStatus(components)).toBe(olmStatus);
  });

  it('getOlmOperatorStatus returns undefined when not present', () => {
    expect(getOlmOperatorStatus([{ type: 'other' }])).toBeUndefined();
  });
});

describe('sortFindings', () => {
  it('sorts by severity: blocker > warning > info', () => {
    const input: OtaFinding[] = [
      { type: COMPONENT_TYPES.finding, severity: 'info', check: 'c', detail: '' },
      { type: COMPONENT_TYPES.finding, severity: 'blocker', check: 'a', detail: '' },
      { type: COMPONENT_TYPES.finding, severity: 'warning', check: 'b', detail: '' },
    ];
    const sorted = sortFindings(input);
    expect(sorted.map((f) => f.severity)).toEqual(['blocker', 'warning', 'info']);
  });

  it('does not mutate the original array', () => {
    const input: OtaFinding[] = [
      { type: COMPONENT_TYPES.finding, severity: 'info', check: 'a', detail: '' },
      { type: COMPONENT_TYPES.finding, severity: 'blocker', check: 'b', detail: '' },
    ];
    const original = [...input];
    sortFindings(input);
    expect(input).toEqual(original);
  });

  it('returns empty array for empty input', () => {
    expect(sortFindings([])).toEqual([]);
  });
});
