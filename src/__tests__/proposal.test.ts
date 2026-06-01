import {
  getPhaseDisplay,
  getProposalPhase,
  getRiskColor,
  getAnalysisData,
  getReadinessSummary,
  getFindings,
  getOlmOperatorStatus,
  sortFindings,
  COMPONENT_TYPES,
  LightspeedProposal,
  AnalysisResult,
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

describe('getProposalPhase', () => {
  const makeProposal = (
    overrides?: Partial<LightspeedProposal['status']>,
  ): LightspeedProposal =>
    ({
      spec: { request: 'test' },
      status: overrides,
    }) as LightspeedProposal;

  it('returns Pending when no status', () => {
    expect(getProposalPhase(makeProposal())).toBe('Pending');
  });

  it('returns Pending when no conditions and no analysis results', () => {
    expect(getProposalPhase(makeProposal({ conditions: [] }))).toBe('Pending');
  });

  it('returns Analyzing when analysis has results but Analyzed condition not set', () => {
    expect(
      getProposalPhase(
        makeProposal({
          steps: {
            analysis: {
              results: [{ name: 'test-analysis-1', outcome: 'Running' }],
            },
          },
        }),
      ),
    ).toBe('Analyzing');
  });

  it('returns Proposed when Analyzed=True', () => {
    expect(
      getProposalPhase(
        makeProposal({
          conditions: [{ type: 'Analyzed', status: 'True', lastTransitionTime: '' }],
        }),
      ),
    ).toBe('Proposed');
  });

  it('returns Denied when Approved=False', () => {
    expect(
      getProposalPhase(
        makeProposal({
          conditions: [
            { type: 'Analyzed', status: 'True', lastTransitionTime: '' },
            { type: 'Approved', status: 'False', lastTransitionTime: '' },
          ],
        }),
      ),
    ).toBe('Denied');
  });

  it('returns Executing when Approved=True', () => {
    expect(
      getProposalPhase(
        makeProposal({
          conditions: [
            { type: 'Analyzed', status: 'True', lastTransitionTime: '' },
            { type: 'Approved', status: 'True', lastTransitionTime: '' },
          ],
        }),
      ),
    ).toBe('Executing');
  });

  it('returns Verifying when Executed=True', () => {
    expect(
      getProposalPhase(
        makeProposal({
          conditions: [
            { type: 'Analyzed', status: 'True', lastTransitionTime: '' },
            { type: 'Approved', status: 'True', lastTransitionTime: '' },
            { type: 'Executed', status: 'True', lastTransitionTime: '' },
          ],
        }),
      ),
    ).toBe('Verifying');
  });

  it('returns Failed when Executed=False', () => {
    expect(
      getProposalPhase(
        makeProposal({
          conditions: [
            { type: 'Analyzed', status: 'True', lastTransitionTime: '' },
            { type: 'Approved', status: 'True', lastTransitionTime: '' },
            { type: 'Executed', status: 'False', lastTransitionTime: '' },
          ],
        }),
      ),
    ).toBe('Failed');
  });

  it('returns Completed when Verified=True', () => {
    expect(
      getProposalPhase(
        makeProposal({
          conditions: [
            { type: 'Analyzed', status: 'True', lastTransitionTime: '' },
            { type: 'Approved', status: 'True', lastTransitionTime: '' },
            { type: 'Executed', status: 'True', lastTransitionTime: '' },
            { type: 'Verified', status: 'True', lastTransitionTime: '' },
          ],
        }),
      ),
    ).toBe('Completed');
  });

  it('returns Escalated when Escalated=True', () => {
    expect(
      getProposalPhase(
        makeProposal({
          conditions: [{ type: 'Escalated', status: 'True', lastTransitionTime: '' }],
        }),
      ),
    ).toBe('Escalated');
  });
});

describe('getRiskColor', () => {
  it('maps risk levels to colors (case-insensitive)', () => {
    expect(getRiskColor('Low')).toBe('green');
    expect(getRiskColor('low')).toBe('green');
    expect(getRiskColor('Medium')).toBe('orange');
    expect(getRiskColor('medium')).toBe('orange');
    expect(getRiskColor('High')).toBe('red');
    expect(getRiskColor('high')).toBe('red');
    expect(getRiskColor('Critical')).toBe('red');
    expect(getRiskColor('critical')).toBe('red');
  });

  it('returns grey for unknown risk', () => {
    expect(getRiskColor('something')).toBe('grey');
    expect(getRiskColor(undefined)).toBe('grey');
  });
});

describe('getAnalysisData', () => {
  const makeProposal = (
    overrides?: Partial<LightspeedProposal['status']>,
  ): LightspeedProposal =>
    ({
      spec: { request: 'test' },
      status: overrides,
    }) as LightspeedProposal;

  const makeAnalysisResult = (
    name: string,
    options?: AnalysisResult['status'],
  ): AnalysisResult =>
    ({
      metadata: { name },
      spec: { proposalName: 'test-proposal' },
      status: options,
    }) as AnalysisResult;

  it('returns undefined option when no analysis results referenced', () => {
    const result = getAnalysisData(makeProposal(), []);
    expect(result.option).toBeUndefined();
    expect(result.components).toEqual([]);
  });

  it('returns undefined option when no successful result reference', () => {
    const proposal = makeProposal({
      steps: {
        analysis: {
          results: [{ name: 'ar-1', outcome: 'Failed' }],
        },
      },
    });
    const ar = makeAnalysisResult('ar-1', {
      options: [
        {
          title: 'Option A',
          diagnosis: { summary: '', confidence: 'High', rootCause: '' },
          proposal: {
            description: '',
            actions: [],
            risk: 'Low',
            reversible: 'Reversible',
          },
        },
      ],
    });
    const result = getAnalysisData(proposal, [ar]);
    expect(result.option).toBeUndefined();
  });

  it('returns the first option from a successful AnalysisResult', () => {
    const option = {
      title: 'Update to 5.0.1',
      summary: 'Safe upgrade',
      diagnosis: { summary: 'All clear', confidence: 'High', rootCause: '' },
      proposal: {
        description: 'Update plan',
        actions: [{ type: 'update', description: 'Set desiredUpdate' }],
        risk: 'Low',
        reversible: 'Reversible' as const,
      },
      components: [{ type: 'custom', data: 1 }],
    };
    const proposal = makeProposal({
      steps: {
        analysis: {
          results: [{ name: 'ar-1', outcome: 'Succeeded' }],
        },
      },
    });
    const ar = makeAnalysisResult('ar-1', { options: [option] });
    const result = getAnalysisData(proposal, [ar]);
    expect(result.option).toBe(option);
    expect(result.components).toEqual(option.components);
  });

  it('returns empty components when option has no components', () => {
    const option = {
      title: 'A',
      diagnosis: { summary: '', confidence: 'High', rootCause: '' },
      proposal: {
        description: '',
        actions: [],
        risk: 'Low',
        reversible: 'Reversible' as const,
      },
    };
    const proposal = makeProposal({
      steps: {
        analysis: {
          results: [{ name: 'ar-1', outcome: 'Succeeded' }],
        },
      },
    });
    const ar = makeAnalysisResult('ar-1', { options: [option] });
    const result = getAnalysisData(proposal, [ar]);
    expect(result.option).toBe(option);
    expect(result.components).toEqual([]);
  });

  it('skips failed results and uses the successful one', () => {
    const goodOption = {
      title: 'Good',
      diagnosis: { summary: '', confidence: 'High', rootCause: '' },
      proposal: {
        description: '',
        actions: [],
        risk: 'Low',
        reversible: 'Reversible' as const,
      },
    };
    const proposal = makeProposal({
      steps: {
        analysis: {
          results: [
            { name: 'ar-fail', outcome: 'Failed' },
            { name: 'ar-good', outcome: 'Succeeded' },
          ],
        },
      },
    });
    const arFail = makeAnalysisResult('ar-fail', { failureReason: 'timeout' });
    const arGood = makeAnalysisResult('ar-good', { options: [goodOption] });
    const result = getAnalysisData(proposal, [arFail, arGood]);
    expect(result.option).toBe(goodOption);
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
