import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('governance transaction fallback guard', () => {
  it('keeps fabricated random transaction identifiers out of production governance code', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/utils/governance.ts'), 'utf8');
    expect(source).not.toMatch(/Math\.random\s*\(/);
    expect(source).not.toMatch(/unsigned:/);
  });
});

