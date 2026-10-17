import { beforeEach, describe, expect, it, vi } from 'vitest';

const reportErrorMock = vi.fn();
vi.mock('../errorTracking', () => ({
  reportError: (...args: unknown[]) => reportErrorMock(...args),
}));

import {
  ERROR_DOMAINS,
  ERROR_TAXONOMY,
  TaxonomyError,
  classifyError,
  isErrorCode,
  reportTaxonomizedError,
} from '../error-taxonomy';

describe('error taxonomy', () => {
  beforeEach(() => {
    reportErrorMock.mockReset();
  });

  it('covers the five required domains', () => {
    expect(ERROR_DOMAINS).toEqual(['auth', 'governance', 'wallet', 'indexer', 'accessibility']);
  });

  it('gives every domain an unknown fallback code', () => {
    for (const domain of ERROR_DOMAINS) {
      expect(isErrorCode(domain, 'unknown')).toBe(true);
      expect(ERROR_TAXONOMY[domain]).toContain('unknown');
    }
  });

  it('keeps the classification of a TaxonomyError', () => {
    const err = new TaxonomyError('indexer', 'unavailable');
    expect(classifyError('indexer', err)).toEqual({
      domain: 'indexer',
      code: 'unavailable',
      retryable: true,
    });
  });

  it('falls back to the domain unknown code for unclassified errors', () => {
    expect(classifyError('wallet', new Error('boom'))).toEqual({
      domain: 'wallet',
      code: 'unknown',
      retryable: false,
    });
  });

  it('marks only transient codes as retryable', () => {
    expect(new TaxonomyError('governance', 'vote_failed').retryable).toBe(false);
    expect(new TaxonomyError('governance', 'tx_timeout').retryable).toBe(true);
  });

  it('reports tagged errors through reportError', () => {
    reportTaxonomizedError('governance', new TaxonomyError('governance', 'execution_failed'), {
      proposalId: 4,
    });
    expect(reportErrorMock).toHaveBeenCalledTimes(1);
    const [error, extra] = reportErrorMock.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(extra).toEqual({
      proposalId: 4,
      errorDomain: 'governance',
      errorCode: 'execution_failed',
      retryable: false,
    });
  });

  it('wraps non-Error values so they still report', () => {
    reportTaxonomizedError('auth', 'session gone');
    const [error] = reportErrorMock.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('session gone');
  });

  it('never throws when reporting fails', () => {
    reportErrorMock.mockImplementationOnce(() => {
      throw new Error('sink down');
    });
    expect(() => reportTaxonomizedError('accessibility', new Error('x'))).not.toThrow();
  });
});
