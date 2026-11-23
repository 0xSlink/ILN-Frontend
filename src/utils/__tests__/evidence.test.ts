import { describe, expect, it } from 'vitest';
import { formatLedgerWindow, hashEvidence } from '../evidence';

describe('evidence helpers', () => {
  it('hashes evidence deterministically', async () => {
    await expect(hashEvidence('payer supplied proof')).resolves.toBe(
      await hashEvidence('payer supplied proof')
    );
  });

  it('formats appeal windows from ledgers', () => {
    expect(formatLedgerWindow(17280)).toContain('ledgers');
    expect(formatLedgerWindow(0)).toBe('0 ledgers (0h)');
  });
  it('canonicalizes whitespace so the committed evidence hash is reproducible', async () => {
    await expect(hashEvidence('  payer supplied proof  ')).resolves.toBe(
      await hashEvidence('payer supplied proof')
    );
  });

  it('does not produce an evidence payload for blank input', async () => {
    await expect(hashEvidence(' \n\t ')).resolves.toBe('');
  });

});
