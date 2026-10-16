import { render, screen, fireEvent } from '@testing-library/react';

// Mock react-joyride so tests don't need full Joyride runtime
// PageTour imports the named `Joyride` export, so both shapes are provided.
vi.mock('react-joyride', () => {
  const JoyrideMock = ({
    run,
    onEvent,
  }: {
    run: boolean;
    onEvent: (d: { status: string }) => void;
  }) => {
    if (run) {
      return (
        <div data-testid="joyride-mock">
          <button onClick={() => onEvent({ status: 'finished' })}>Finish tour</button>
          <button onClick={() => onEvent({ status: 'skipped' })}>Skip</button>
        </div>
      );
    }
    return null;
  };

  return {
    __esModule: true,
    default: JoyrideMock,
    Joyride: JoyrideMock,
    STATUS: { FINISHED: 'finished', SKIPPED: 'skipped' },
  };
});

import { HelpMenu } from '../tours/HelpMenu';

describe('HelpMenu (#169)', () => {
  test('renders help button', () => {
    render(<HelpMenu tourId="freelancer-dashboard" />);
    expect(screen.getByTestId('help-button')).toBeInTheDocument();
  });

  test('dropdown opens when help button clicked', () => {
    render(<HelpMenu tourId="freelancer-dashboard" />);
    expect(screen.queryByTestId('help-menu-dropdown')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('help-button'));
    expect(screen.getByTestId('help-menu-dropdown')).toBeInTheDocument();
  });

  test('tour does not auto-trigger (no Joyride on mount)', () => {
    render(<HelpMenu tourId="analytics" />);
    expect(screen.queryByTestId('joyride-mock')).not.toBeInTheDocument();
  });

  test("starts tour when 'Take a tour' is clicked", () => {
    render(<HelpMenu tourId="governance" />);
    fireEvent.click(screen.getByTestId('help-button'));
    fireEvent.click(screen.getByTestId('start-tour-btn'));
    expect(screen.getByTestId('joyride-mock')).toBeInTheDocument();
  });

  test('tour ends after skip', () => {
    render(<HelpMenu tourId="lp-discovery" />);
    fireEvent.click(screen.getByTestId('help-button'));
    fireEvent.click(screen.getByTestId('start-tour-btn'));
    fireEvent.click(screen.getByText('Skip'));
    expect(screen.queryByTestId('joyride-mock')).not.toBeInTheDocument();
  });

  test('tour ends after finish', () => {
    render(<HelpMenu tourId="freelancer-dashboard" />);
    fireEvent.click(screen.getByTestId('help-button'));
    fireEvent.click(screen.getByTestId('start-tour-btn'));
    fireEvent.click(screen.getByText('Finish tour'));
    expect(screen.queryByTestId('joyride-mock')).not.toBeInTheDocument();
  });

  test('doc links are rendered in dropdown', () => {
    const links = [{ label: 'Docs', href: 'https://docs.iln.finance' }];
    render(<HelpMenu tourId="analytics" docLinks={links} />);
    fireEvent.click(screen.getByTestId('help-button'));
    expect(screen.getByText('Docs')).toBeInTheDocument();
  });
});
