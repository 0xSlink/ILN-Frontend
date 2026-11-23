import { governanceReadMetadata } from './metadata';

describe('governance read metadata', () => {
  it('exposes ledger freshness and explicit read failures', () => {
    expect(governanceReadMetadata(42, new Date().toISOString()).status).toBe('ready');
    expect(governanceReadMetadata(-1).status).toBe('error');
  });
});

