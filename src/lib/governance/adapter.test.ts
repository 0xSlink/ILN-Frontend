import { describe, expect, it } from 'vitest';
import { createGovernanceContractAdapter } from './adapter';

describe('typed governance adapter', () => {
  it('exposes the shared read and mutation boundary', () => {
    const adapter = createGovernanceContractAdapter();
    expect(adapter.list).toEqual(expect.any(Function));
    expect(adapter.get).toEqual(expect.any(Function));
    expect(adapter.vote).toEqual(expect.any(Function));
  });
});

