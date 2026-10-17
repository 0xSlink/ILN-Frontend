import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('MaintenanceModeBanner', () => {
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders prominently when maintenance mode is enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAINTENANCE_MODE', 'true');
    const { default: MaintenanceModeBanner } = await import('../MaintenanceModeBanner');

    render(<MaintenanceModeBanner />);

    expect(screen.getByRole('alert')).toHaveTextContent('Protocol maintenance in progress');
    expect(screen.getByText(/do not submit or sign new transactions/i)).toBeInTheDocument();
  });

  it('does not affect page content when maintenance mode is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAINTENANCE_MODE', 'false');
    const { default: MaintenanceModeBanner } = await import('../MaintenanceModeBanner');

    render(
      <>
        <MaintenanceModeBanner />
        <main>Invoice dashboard</main>
      </>
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Invoice dashboard')).toBeInTheDocument();
  });

  it('persists a dismissal for the remainder of the browser session', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAINTENANCE_MODE', 'true');
    const { default: MaintenanceModeBanner } = await import('../MaintenanceModeBanner');
    const { unmount } = render(<MaintenanceModeBanner />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss maintenance notice/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    unmount();
    render(<MaintenanceModeBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
