import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DataSourceCaption from '../DataSourceCaption';

describe('DataSourceCaption', () => {
  it('shows the registry provenance class for indexed data', () => {
    render(<DataSourceCaption metric="funding-history" />);
    const caption = screen.getByTestId('data-source-caption');
    expect(caption).toHaveTextContent('Provenance: Indexer');
    expect(caption).toHaveAttribute('aria-label', expect.stringContaining('Provenance: Indexer'));
  });

  it('shows the RPC provenance class for on-chain data', () => {
    render(<DataSourceCaption metric="contract-stats" />);
    expect(screen.getByTestId('data-source-caption')).toHaveTextContent('Provenance: RPC');
  });

  it('supports an explicit unavailable state for a chart with no current data', () => {
    render(<DataSourceCaption metric="invoice-state-distribution" provenance="unavailable" />);
    const caption = screen.getByTestId('data-source-caption');
    expect(caption).toHaveTextContent('Provenance: Unavailable');
    expect(caption).toHaveAttribute('title', expect.stringContaining('Provenance: Unavailable'));
  });
});
