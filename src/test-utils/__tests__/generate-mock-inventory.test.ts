import { describe, expect, it } from 'vitest';
import {
  formatMockInventoryMarkdown,
  scanMockInventory,
  verifyFinancialSurfaces,
  FINANCIAL_MOCK_ALLOWLIST,
  APPROVED_FINANCIAL_LABELS,
} from '../../../scripts/generate-mock-inventory.mjs';

describe('scanMockInventory', () => {
  it('returns valid inventory structure with summary counts matching items', () => {
    const data = scanMockInventory();

    expect(data.summary.totalFunctions).toBe(data.functions.length);
    expect(data.summary.totalFunctions).toBeGreaterThan(0);
    expect(data.summary.realCount).toBeGreaterThan(0);
    expect(data.summary.mockCount).toBeGreaterThan(0);

    const calculatedReal = data.functions.filter(
      (f: { status: string }) => f.status === 'Real'
    ).length;
    const calculatedDerived = data.functions.filter(
      (f: { status: string }) => f.status === 'Derived'
    ).length;
    const calculatedDeferred = data.functions.filter(
      (f: { status: string }) => f.status === 'Deferred'
    ).length;
    const calculatedMock = data.functions.filter(
      (f: { status: string }) => f.status === 'Mock'
    ).length;

    expect(data.summary.realCount).toBe(calculatedReal);
    expect(data.summary.derivedCount).toBe(calculatedDerived);
    expect(data.summary.deferredCount).toBe(calculatedDeferred);
    expect(data.summary.mockCount).toBe(calculatedMock);
    expect(data.summary.patternFindingsCount).toBe(data.findings.length);
  });

  it('tracks known governance write mocks with their remediation tracking issues', () => {
    const data = scanMockInventory();

    const castVote = data.functions.find((f: { name: string }) => f.name === 'castVote');
    expect(castVote).toBeDefined();
    // Real since #1044/#1045: a signed Soroban cast_vote, simulated before
    // signing and confirmed under a bounded poll.
    expect(castVote?.status).toBe('Real');
    expect(castVote?.trackingIssue).toBe('#1044');

    const createProposal = data.functions.find(
      (f: { name: string }) => f.name === 'createProposal'
    );
    expect(createProposal).toBeDefined();
    expect(createProposal?.status).toBe('Real');
    expect(createProposal?.trackingIssue).toBe('#841');

    const delegateVotingPower = data.functions.find(
      (f: { name: string }) => f.name === 'delegateVotingPower'
    );
    expect(delegateVotingPower).toBeDefined();
    expect(delegateVotingPower?.status).toBe('Mock');
    expect(delegateVotingPower?.trackingIssue).toBe('#842');
  });

  it('tracks verified real contract integrations', () => {
    const data = scanMockInventory();

    // Proposal creation is a signed create_proposal transaction (#1055).
    const createProposal = data.functions.find(
      (f: { name: string }) => f.name === 'createProposal'
    );
    expect(createProposal?.status).toBe('Real');
    expect(createProposal?.trackingIssue).toBe('#841');

    const submitInvoice = data.functions.find((f: { name: string }) => f.name === 'submitInvoice');
    expect(submitInvoice).toBeDefined();
    expect(submitInvoice?.status).toBe('Real');

    const fundInvoice = data.functions.find((f: { name: string }) => f.name === 'fundInvoice');
    expect(fundInvoice).toBeDefined();
    expect(fundInvoice?.status).toBe('Real');

    const lookupToken = data.functions.find((f: { name: string }) => f.name === 'lookupToken');
    expect(lookupToken).toBeDefined();
    expect(lookupToken?.status).toBe('Real');
    expect(lookupToken?.trackingIssue).toBe('#845');
  });
});

describe('formatMockInventoryMarkdown', () => {
  it('generates markdown with table and cross-links', () => {
    const data = scanMockInventory();
    const markdown = formatMockInventoryMarkdown(data);

    expect(markdown).toContain('# Mock Usage & Contract Integration Inventory');
    expect(markdown).toContain('contract-integration-status.md');
    expect(markdown).toContain('governance-mock-regression-retrospective.md');
    expect(markdown).toContain('frontend-mock-closure-audit.md');
    expect(markdown).toContain('Executive Summary');
    expect(markdown).toContain('Contract Integration Functions Inventory');
    expect(markdown).toContain('Detected Code Pattern Signatures');
    expect(markdown).toContain('MSW Development & Testing Mocks');
    expect(markdown).toContain('castVote');
    expect(markdown).toContain('submitInvoice');
  });
});

describe('verifyFinancialSurfaces', () => {
  it('passes verification on the canonical codebase inventory', () => {
    const data = scanMockInventory();
    const result = verifyFinancialSurfaces(data);

    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('fails when a new unallowlisted, unlabelled mock is added to a financial surface', () => {
    const data = scanMockInventory();
    const mutated = {
      ...data,
      functions: [
        ...data.functions,
        {
          module: 'Invoices',
          name: 'unauthorizedFakePayout',
          status: 'Mock',
          filePath: 'src/utils/soroban.ts',
          line: 999,
          description: 'Returns synthetic payout tx hash',
          patternType: 'fake-hash-mock',
        },
      ],
    };

    const result = verifyFinancialSurfaces(mutated);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(
      result.violations.some((v: { name?: string }) => v.name === 'unauthorizedFakePayout')
    ).toBe(true);
  });

  it('fails when a new unallowlisted, unlabelled fallback enters a financial surface', () => {
    const data = scanMockInventory();
    const mutated = {
      ...data,
      functions: [
        ...data.functions,
        {
          module: 'Governance',
          name: 'getFakeTreasuryBalance',
          status: 'Derived',
          filePath: 'src/utils/governance.ts',
          line: 888,
          description: 'Calculates balance from hardcoded fallback without contract read',
          patternType: 'hardcoded-fallback',
        },
      ],
    };

    const result = verifyFinancialSurfaces(mutated);
    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v: { name?: string }) => v.name === 'getFakeTreasuryBalance')
    ).toBe(true);
  });

  it('passes when a mock on a financial surface is included in the allowlist', () => {
    const data = scanMockInventory();
    const newFn = {
      module: 'Tokens',
      name: 'temporaryMockPriceOracle',
      status: 'Mock',
      filePath: 'src/utils/soroban.ts',
      line: 777,
      description: 'Temporary dev pricing stub',
      patternType: 'stub-value',
      trackingIssue: '#999',
    };
    const mutated = {
      ...data,
      functions: [...data.functions, newFn],
    };

    const customAllowlist = [
      ...FINANCIAL_MOCK_ALLOWLIST,
      {
        module: 'Tokens',
        name: 'temporaryMockPriceOracle',
        patternType: 'stub-value',
        trackingIssue: '#999',
      },
    ];

    const result = verifyFinancialSurfaces(mutated, { allowlist: customAllowlist });
    expect(result.valid).toBe(true);
  });

  it('passes when a mock on a financial surface has an explicit approved label', () => {
    const data = scanMockInventory();
    const mutated = {
      ...data,
      functions: [
        ...data.functions,
        {
          module: 'Insurance',
          name: 'mockPoolSimulation',
          status: 'Mock',
          label: 'dev-only',
          filePath: 'src/utils/soroban.ts',
          line: 666,
          description: 'Dev-only simulation of insurance premium',
          patternType: 'dev-only-mock',
        },
      ],
    };

    const result = verifyFinancialSurfaces(mutated);
    expect(result.valid).toBe(true);
  });

  it('allows mocks on non-financial surfaces without requiring a financial allowlist entry', () => {
    const data = scanMockInventory();
    const mutated = {
      ...data,
      functions: [
        ...data.functions,
        {
          module: 'Telemetry',
          name: 'mockAnalyticsBeacon',
          status: 'Mock',
          filePath: 'src/lib/rum.ts',
          line: 10,
          description: 'Local telemetry echo',
          patternType: 'noop-mock',
        },
      ],
    };

    const result = verifyFinancialSurfaces(mutated);
    expect(result.valid).toBe(true);
  });

  it('fails when an unresolved code pattern on a financial surface is not allowlisted', () => {
    const data = scanMockInventory();
    const mutated = {
      ...data,
      findings: [
        ...data.findings,
        {
          filePath: 'src/utils/soroban.ts',
          line: 123,
          pattern: 'const fakeInvoiceAmount = 5000n;',
          category: 'hardcoded-constant',
          snippet: 'const fakeInvoiceAmount = 5000n;',
          status: 'active-mock',
        },
      ],
    };

    const result = verifyFinancialSurfaces(mutated);
    expect(result.valid).toBe(false);
    expect(
      result.violations.some((v: { type: string }) => v.type === 'UNAPPROVED_FINANCIAL_FINDING')
    ).toBe(true);
  });
});
