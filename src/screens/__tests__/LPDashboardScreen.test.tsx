import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LPDashboardPage from '../LPDashboard';

vi.mock('@/components/Navbar', () => ({ default: () => <nav data-testid="navbar" /> }));
vi.mock('@/components/Footer', () => ({ default: () => <footer data-testid="footer" /> }));
vi.mock('@/components/LPDashboard', () => ({
  default: () => <div data-testid="lp-dashboard" />,
}));

describe('LPDashboardPage (screens/LPDashboard)', () => {
  it('renders the Navbar, LPDashboard, and Footer inside a main landmark', () => {
    render(<LPDashboardPage />);
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('lp-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(document.querySelector('main')).toBeInTheDocument();
  });
});
