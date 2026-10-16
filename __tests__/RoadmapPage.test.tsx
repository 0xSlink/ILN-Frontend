import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RoadmapPage from '../app/roadmap/page';

// Mock the dependencies
vi.mock('@/components/Navbar', () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock('@/components/Footer', () => ({
  default: () => <div data-testid="footer">Footer</div>,
}));

vi.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

describe('RoadmapPage', () => {
  it('renders roadmap page with header', () => {
    render(<RoadmapPage />);

    // Check for main heading
    expect(screen.getByText('ILN Roadmap')).toBeInTheDocument();
    expect(screen.getByText(/See what's coming to Invoice Liquidity Network/)).toBeInTheDocument();
  });

  it('displays all three phases', () => {
    render(<RoadmapPage />);

    expect(screen.getByText('Testnet')).toBeInTheDocument();
    expect(screen.getByText('Mainnet')).toBeInTheDocument();
    expect(screen.getByText('Post-Launch')).toBeInTheDocument();
  });

  it('displays roadmap items', () => {
    render(<RoadmapPage />);

    // Check for some known items
    expect(screen.getByText('Invoice Factoring MVP')).toBeInTheDocument();
    expect(screen.getByText('Governance Framework')).toBeInTheDocument();
    expect(screen.getByText('Mainnet Launch')).toBeInTheDocument();
  });

  it('shows status counts', () => {
    render(<RoadmapPage />);

    // Check for status summary badges (each status also labels its own items)
    expect(screen.getAllByText(/Completed/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/In Progress/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Planned/).length).toBeGreaterThan(0);
  });

  it('displays GitHub CTA section', () => {
    render(<RoadmapPage />);

    expect(screen.getByText('Want to contribute?')).toBeInTheDocument();
    expect(screen.getByText(/open source and community-driven/)).toBeInTheDocument();
    const githubLink = screen.getByText('View on GitHub');
    expect(githubLink).toHaveAttribute('href');
    expect(githubLink).toHaveAttribute('target', '_blank');
  });

  it('renders Navbar but not Footer (footer is home-page-only)', () => {
    render(<RoadmapPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
  });

  it('snapshot test matches expected output', () => {
    const { asFragment } = render(<RoadmapPage />);

    expect(asFragment()).toMatchSnapshot();
  });
});
