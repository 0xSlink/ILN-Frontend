import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import Footer from '../Footer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeAll(() => {
  // jsdom doesn't implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Footer', () => {
  afterEach(() => {
    document.querySelectorAll('main').forEach((el) => el.remove());
  });

  it('renders footer navigation headings', () => {
    render(<Footer />);
    expect(screen.getByText('footer.network')).toBeInTheDocument();
    expect(screen.getByText('footer.developers')).toBeInTheDocument();
  });

  it('renders a skip-to-main-content link', () => {
    render(<Footer />);
    expect(screen.getByText('Skip to main content')).toHaveAttribute('href', '#main-content');
  });

  it('focuses and scrolls to the main element when the skip link is used', () => {
    const main = document.createElement('main');
    main.tabIndex = -1;
    document.body.appendChild(main);
    render(<Footer />);

    const focusSpy = vi.spyOn(main, 'focus');
    const scrollSpy = vi.spyOn(main, 'scrollIntoView');

    fireEvent.click(screen.getByText('Skip to main content'));
    expect(focusSpy).toHaveBeenCalled();
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('does nothing when there is no main element', () => {
    render(<Footer />);
    expect(() => fireEvent.click(screen.getByText('Skip to main content'))).not.toThrow();
  });
});
