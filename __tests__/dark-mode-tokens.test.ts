import { describe, it, expect } from 'vitest';
import { getDisputeRateColorClasses } from '@/utils/dispute-rate';

describe('dark mode readability tokens', () => {
  it('includes dark variants for dispute rate status colors', () => {
    expect(getDisputeRateColorClasses('green').value).toContain('dark:');
    expect(getDisputeRateColorClasses('amber').value).toContain('dark:');
    expect(getDisputeRateColorClasses('red').value).toContain('dark:');
  });

  it('includes dark border variants for dispute rate cards', () => {
    expect(getDisputeRateColorClasses('green').border).toContain('dark:');
    expect(getDisputeRateColorClasses('amber').border).toContain('dark:');
    expect(getDisputeRateColorClasses('red').border).toContain('dark:');
  });

  it('uses high-contrast text colors for WCAG AA compliance', () => {
    const amber = getDisputeRateColorClasses('amber').value;
    expect(amber).toContain('text-amber-800');
    expect(amber).not.toContain('text-amber-700');
  });
});
