import {
  getPhaseDisplay,
  getRiskColor,
  getReadinessSummary,
  getFindings,
  getOlmOperatorStatus,
  getAnalysisDataFromResult,
  sortFindings,
  derivePhase,
  hasDefaultModeData,
  hasRemediationPlan,
  isMinimalMode,
  COMPONENT_TYPES,
  AdapterComponent,
  LightspeedAgenticRun,
  LightspeedAnalysisResult,
  OtaReadinessSummary,
  OtaFinding,
  OtaOlmOperatorStatus,
  RemediationOption,
} from '../models/agenticrun';

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

describe('getAnalysisDataFromResult', () => {
  it('returns empty components when result is undefined', () => {
    const data = getAnalysisDataFromResult(undefined);
    expect(data.components).toEqual([]);
    expect(data.analysisData).toBeUndefined();
  });

  it('returns empty components when result has no options', () => {
    const result = { spec: { agenticRunName: 'test' }, status: {} } as LightspeedAnalysisResult;
    const data = getAnalysisDataFromResult(result);
    expect(data.components).toEqual([]);
  });

  it('extracts typed components array from analysisData', () => {
    const components = [
      { type: 'ota_readiness_summary', decision: 'recommend', checks: [] },
      { type: 'ota_finding', severity: 'info', check: 'test', detail: 'ok' },
    ];
    const result = {
      spec: { agenticRunName: 'test' },
      status: { options: [{ title: 'Option', components: { analysisData: components } }] },
    } as unknown as LightspeedAnalysisResult;
    const data = getAnalysisDataFromResult(result);
    expect(data.components).toEqual(components);
    expect(data.analysisData).toBeUndefined();
  });

  it('extracts legacy flat object from analysisData', () => {
    const legacyData = { decision: 'recommend', summary: 'All good' };
    const result = {
      spec: { agenticRunName: 'test' },
      status: { options: [{ title: 'Option', components: { analysisData: legacyData } }] },
    } as unknown as LightspeedAnalysisResult;
    const data = getAnalysisDataFromResult(result);
    expect(data.components).toEqual([]);
    expect(data.analysisData).toEqual(legacyData);
  });
});

describe('derivePhase', () => {
  const makeAgenticRun = (
    conditions: { type: string; status: string; reason?: string }[],
  ): LightspeedAgenticRun =>
    ({
      spec: { request: 'test', analysis: { agent: 'default' } },
      status: { conditions },
    }) as unknown as LightspeedAgenticRun;

  it('returns Pending when no conditions', () => {
    expect(derivePhase(undefined)).toBe('Pending');
    expect(derivePhase(makeAgenticRun([]))).toBe('Pending');
  });

  it('returns Analyzing when Analyzed=False', () => {
    expect(derivePhase(makeAgenticRun([{ type: 'Analyzed', status: 'False' }]))).toBe('Analyzing');
  });

  it('returns Failed when Analyzed=False with reason Failed', () => {
    expect(
      derivePhase(makeAgenticRun([{ type: 'Analyzed', status: 'False', reason: 'Failed' }])),
    ).toBe('Failed');
  });

  it('returns Analysed when analysis-only (execution/verification skipped)', () => {
    expect(
      derivePhase(
        makeAgenticRun([
          { type: 'Analyzed', status: 'True' },
          { type: 'Executed', status: 'True', reason: 'Skipped' },
          { type: 'Verified', status: 'True', reason: 'Skipped' },
        ]),
      ),
    ).toBe('Analysed');
  });

  it('returns Escalated when Escalated=True', () => {
    expect(derivePhase(makeAgenticRun([{ type: 'Escalated', status: 'True' }]))).toBe('Escalated');
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

describe('Default Mode Helpers', () => {
  describe('hasDefaultModeData', () => {
    it('returns true when option has diagnosis', () => {
      const option: RemediationOption = {
        title: 'Fix memory issue',
        diagnosis: {
          confidence: 'High',
          rootCause: 'OOMKilled pod',
          summary: 'Pod is running out of memory',
        },
      };
      expect(hasDefaultModeData(option)).toBe(true);
    });

    it('returns true when option has proposal', () => {
      const option: RemediationOption = {
        title: 'Fix memory issue',
        proposal: {
          actions: [{ type: 'patch', description: 'Increase memory limit' }],
          description: 'Increase memory',
          estimatedImpact: 'Low impact',
          risk: 'Low',
        },
      };
      expect(hasDefaultModeData(option)).toBe(true);
    });

    it('returns true when option has both diagnosis and proposal', () => {
      const option: RemediationOption = {
        title: 'Fix memory issue',
        diagnosis: {
          confidence: 'High',
          rootCause: 'OOMKilled pod',
          summary: 'Pod is running out of memory',
        },
        proposal: {
          actions: [{ type: 'patch', description: 'Increase memory limit' }],
          description: 'Increase memory',
          estimatedImpact: 'Low impact',
          risk: 'Low',
        },
      };
      expect(hasDefaultModeData(option)).toBe(true);
    });

    it('returns false when option has only components (Minimal mode)', () => {
      const option: RemediationOption = {
        title: 'Analysis',
        components: {
          analysisData: [{ type: 'ota_readiness_summary', decision: 'recommend', checks: [] }],
        },
      };
      expect(hasDefaultModeData(option)).toBe(false);
    });

    it('returns false for undefined option', () => {
      expect(hasDefaultModeData(undefined)).toBe(false);
    });
  });

  describe('hasRemediationPlan', () => {
    it('returns true when result has options with proposal', () => {
      const result: LightspeedAnalysisResult = {
        spec: { agenticRunName: 'test' },
        status: {
          options: [
            {
              title: 'Fix issue',
              proposal: {
                actions: [{ type: 'patch', description: 'Fix it' }],
                description: 'Fix',
                estimatedImpact: 'Low',
                risk: 'Low',
              },
            },
          ],
        },
      } as unknown as LightspeedAnalysisResult;
      expect(hasRemediationPlan(result)).toBe(true);
    });

    it('returns false when result has options without proposal', () => {
      const result: LightspeedAnalysisResult = {
        spec: { agenticRunName: 'test' },
        status: {
          options: [
            {
              title: 'Analysis only',
              diagnosis: {
                confidence: 'High',
                rootCause: 'Issue',
                summary: 'No fix available',
              },
            },
          ],
        },
      } as unknown as LightspeedAnalysisResult;
      expect(hasRemediationPlan(result)).toBe(false);
    });

    it('returns false when result has no options', () => {
      const result: LightspeedAnalysisResult = {
        spec: { agenticRunName: 'test' },
        status: {},
      } as LightspeedAnalysisResult;
      expect(hasRemediationPlan(result)).toBe(false);
    });

    it('returns false for undefined result', () => {
      expect(hasRemediationPlan(undefined)).toBe(false);
    });
  });

  describe('isMinimalMode', () => {
    it('returns true when analysisData has only components (no Default mode data)', () => {
      const data = {
        options: [
          {
            title: 'Analysis',
            components: { analysisData: [{ type: 'ota_readiness_summary' }] },
          },
        ],
        components: [{ type: 'ota_readiness_summary', decision: 'recommend', checks: [] }],
      };
      expect(isMinimalMode(data)).toBe(true);
    });

    it('returns false when options have Default mode data', () => {
      const data = {
        options: [
          {
            title: 'Fix',
            diagnosis: { confidence: 'High' as const, rootCause: 'Issue', summary: 'Summary' },
          },
        ],
        components: [],
      };
      expect(isMinimalMode(data)).toBe(false);
    });

    it('returns false when there are no components', () => {
      const data = {
        options: [],
        components: [],
      };
      expect(isMinimalMode(data)).toBe(false);
    });

    it('returns false for undefined analysisData', () => {
      expect(isMinimalMode(undefined)).toBe(false);
    });
  });

  describe('getAnalysisDataFromResult with options', () => {
    it('returns options array from result', () => {
      const result: LightspeedAnalysisResult = {
        spec: { agenticRunName: 'test' },
        status: {
          options: [
            {
              title: 'Option 1',
              diagnosis: { confidence: 'High' as const, rootCause: 'Issue', summary: 'Fix it' },
            },
            { title: 'Option 2', summary: 'Alternative' },
          ],
        },
      } as unknown as LightspeedAnalysisResult;
      const data = getAnalysisDataFromResult(result);
      expect(data.options).toHaveLength(2);
      expect(data.options[0].title).toBe('Option 1');
      expect(data.options[1].title).toBe('Option 2');
    });

    it('returns empty options array when result has no options', () => {
      const result: LightspeedAnalysisResult = {
        spec: { agenticRunName: 'test' },
        status: {},
      } as LightspeedAnalysisResult;
      const data = getAnalysisDataFromResult(result);
      expect(data.options).toEqual([]);
    });
  });
});
