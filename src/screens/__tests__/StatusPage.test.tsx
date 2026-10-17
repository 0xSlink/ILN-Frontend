import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StatusPage from '../StatusPage';

vi.mock('@/components/StatusIncidentHistory', () => ({
  default: () => <section data-testid="incident-history" />,
}));
vi.mock('@/components/StatusSubscribe', () => ({
  default: () => <section data-testid="status-subscribe" />,
}));

describe('StatusPage', () => {
  it('renders the incident history and the opt-in subscription panel', () => {
    render(<StatusPage />);

    expect(screen.getByRole('heading', { name: 'System Status' })).toBeInTheDocument();
    expect(screen.getByTestId('incident-history')).toBeInTheDocument();
    expect(screen.getByTestId('status-subscribe')).toBeInTheDocument();
  });

  it('links out to the hosted live status page with safe rel attributes', () => {
    render(<StatusPage />);

    const link = screen.getByRole('link', { name: 'iln.instatus.com' });
    expect(link).toHaveAttribute('href', 'https://iln.instatus.com');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
