import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { server } from '@/mocks/server';
import { injectRpcFault, injectRpcMalformed } from '@/mocks/faultInjection';
import GovernanceActivity from '../GovernanceActivity';

/**
 * Component-level fault-injection coverage (Issue #758): a governance UI that
 * renders live RPC reads must never crash or go blank when the underlying
 * contract/Horizon calls fail — it must render a defined state.
 */

afterEach(() => {
  server.resetHandlers();
});

const WALLET = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

describe('GovernanceActivity under RPC fault injection', () => {
  it('renders the activity feed (not a crash or blank state) when RPC returns 500', async () => {
    server.use(injectRpcFault(500));
    render(<GovernanceActivity address={WALLET} />);

    expect(
      await screen.findByRole('heading', { name: /governance activity/i })
    ).toBeInTheDocument();
    // The three reads fall back to mock/derived data instead of hanging, so a
    // real feed (not a blank panel) is rendered.
    expect(await screen.findByLabelText(/governance activity feed/i)).toBeInTheDocument();
  });

  it('renders a defined state (not a crash) when RPC responds malformed', async () => {
    server.use(injectRpcMalformed());
    render(<GovernanceActivity address={WALLET} />);

    expect(
      await screen.findByRole('heading', { name: /governance activity/i })
    ).toBeInTheDocument();
    expect(await screen.findByLabelText(/governance activity feed/i)).toBeInTheDocument();
  });
});
