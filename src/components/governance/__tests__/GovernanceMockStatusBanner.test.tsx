import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { integrationStatus } = vi.hoisted(() => ({
  integrationStatus: {
    castVote: { status: 'Stubbed' as 'Real' | 'Stubbed', label: 'Vote casting' },
  },
}));

vi.mock('@/utils/governance', () => ({
  GOVERNANCE_INTEGRATION_STATUS: integrationStatus,
}));

import GovernanceMockStatusBanner from '../GovernanceMockStatusBanner';

afterEach(() => {
  cleanup();
  integrationStatus.castVote.status = 'Stubbed';
});

describe('GovernanceMockStatusBanner', () => {
  it('warns while an action is stubbed', () => {
    render(<GovernanceMockStatusBanner action="castVote" />);

    expect(screen.getByText('Not yet live')).toBeInTheDocument();
    expect(screen.getByText(/Vote casting is currently backed by a mock/)).toBeInTheDocument();
  });

  it('hides automatically when the action becomes real', () => {
    integrationStatus.castVote.status = 'Real';
    render(<GovernanceMockStatusBanner action="castVote" />);

    expect(screen.queryByText('Not yet live')).not.toBeInTheDocument();
  });

  it('reports a stubbed action as disabled in production (#1320)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(<GovernanceMockStatusBanner action="castVote" />);

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Vote casting is not available on-chain/)).toBeInTheDocument();
    expect(screen.queryByText(/backed by a mock/)).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});