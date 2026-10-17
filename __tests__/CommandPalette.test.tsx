import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import CommandPalette from '@/components/CommandPalette';
import { KeyboardShortcutsProvider } from '@/context/KeyboardShortcutsContext';

// The palette reads the keyboard-shortcuts context (Cmd+K registration).
function renderPalette() {
  return render(
    <KeyboardShortcutsProvider>
      <CommandPalette />
    </KeyboardShortcutsProvider>
  );
}

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

describe('CommandPalette', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (useRouter as any).mockReturnValue({ push: mockPush });
  });

  it('opens with Cmd+K on Mac', () => {
    renderPalette();
    expect(screen.queryByPlaceholderText(/type a command/i)).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument();
  });

  it('opens with Ctrl+K on Windows', () => {
    renderPalette();
    expect(screen.queryByPlaceholderText(/type a command/i)).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument();
  });

  it('closes with Escape', () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByPlaceholderText(/type a command/i)).not.toBeInTheDocument();
  });

  it('closes when clicking backdrop', () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const backdrop = screen.getByPlaceholderText(/type a command/i).closest('.fixed');
    fireEvent.click(backdrop!);

    expect(screen.queryByPlaceholderText(/type a command/i)).not.toBeInTheDocument();
  });

  it('fuzzy search filters commands correctly', () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const input = screen.getByPlaceholderText(/type a command/i);
    fireEvent.change(input, { target: { value: 'dash' } });

    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Go to LP Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Go to Analytics')).not.toBeInTheDocument();
  });

  it('fuzzy search works with non-contiguous characters', () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const input = screen.getByPlaceholderText(/type a command/i);
    fireEvent.change(input, { target: { value: 'goan' } });

    expect(screen.getByText('Go to Analytics')).toBeInTheDocument();
  });

  it('invoice lookup by number navigates correctly', async () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const input = screen.getByPlaceholderText(/type a command/i);
    fireEvent.change(input, { target: { value: '123' } });

    expect(screen.getByText('Invoice #123')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/i/123');
    });
  });

  it('invoice lookup works with # prefix', async () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const input = screen.getByPlaceholderText(/type a command/i);
    fireEvent.change(input, { target: { value: '#456' } });

    expect(screen.getByText('Invoice #456')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/i/456');
    });
  });

  it('arrow keys navigate results', () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const input = screen.getByPlaceholderText(/type a command/i);
    fireEvent.change(input, { target: { value: 'go' } });

    const results = screen.getAllByText(/^Go to/);
    expect(results.length).toBeGreaterThan(1);

    // First item should be selected by default
    expect(results[0].closest('div')).toHaveClass('bg-blue-50');

    // Arrow down
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(results[1].closest('div')).toHaveClass('bg-blue-50');

    // Arrow up
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(results[0].closest('div')).toHaveClass('bg-blue-50');
  });

  it('Enter executes selected command', async () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const input = screen.getByPlaceholderText(/type a command/i);
    fireEvent.change(input, { target: { value: 'analytics' } });

    fireEvent.keyDown(window, { key: 'Enter' });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/analytics');
    });
  });

  it('clicking a command executes it', async () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const input = screen.getByPlaceholderText(/type a command/i);
    fireEvent.change(input, { target: { value: 'governance' } });

    const command = screen.getByText('Go to Governance');
    fireEvent.click(command);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/governance');
    });
  });

  it('tracks recent commands in localStorage', async () => {
    renderPalette();

    // Execute a command
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const input = screen.getByPlaceholderText(/type a command/i);
    fireEvent.change(input, { target: { value: 'analytics' } });
    fireEvent.keyDown(window, { key: 'Enter' });

    await waitFor(() => {
      const stored = localStorage.getItem('iln_recent_commands');
      expect(stored).toBeTruthy();
      const recent = JSON.parse(stored!);
      expect(recent).toContain('analytics');
    });
  });

  it('shows recent commands when opened without query', async () => {
    // Pre-populate recent commands
    localStorage.setItem('iln_recent_commands', JSON.stringify(['analytics', 'dashboard']));

    renderPalette();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(screen.getByText('Go to Analytics')).toBeInTheDocument();
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });

  it('keeps recent commands most-recent-first, capped at MAX_RECENT (10)', async () => {
    renderPalette();

    const commands = ['analytics', 'dashboard', 'governance', 'freelancer', 'lp', 'payer'];

    for (const cmd of commands) {
      fireEvent.keyDown(window, { key: 'k', metaKey: true });
      const input = screen.getByPlaceholderText(/type a command/i);
      fireEvent.change(input, { target: { value: cmd } });
      fireEvent.keyDown(window, { key: 'Enter' });
      await waitFor(() => expect(mockPush).toHaveBeenCalled());
      mockPush.mockClear();
    }

    const stored = localStorage.getItem('iln_recent_commands');
    const recent = JSON.parse(stored!);
    expect(recent.length).toBe(commands.length);
    expect(recent.length).toBeLessThanOrEqual(10);
    expect(recent[0]).toBe('payer'); // most recently executed first
  });

  it('shows empty state when no commands match', () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const input = screen.getByPlaceholderText(/type a command/i);
    fireEvent.change(input, { target: { value: 'xyz123notfound' } });

    expect(screen.getByText('No commands found')).toBeInTheDocument();
  });

  it('shows empty state when no recent commands', () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(screen.getByText('No recent commands')).toBeInTheDocument();
  });

  it('opens shortcuts modal with ? outside input', () => {
    renderPalette();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
  });

  it('does not open shortcuts modal from input fields', () => {
    render(
      <KeyboardShortcutsProvider>
        <input aria-label="test-input" />
        <CommandPalette />
      </KeyboardShortcutsProvider>
    );

    const input = screen.getByLabelText('test-input');
    input.focus();
    fireEvent.keyDown(input, { key: '?' });

    expect(screen.queryByText('Keyboard shortcuts')).not.toBeInTheDocument();
  });

  it('resets selection when query changes', () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    const input = screen.getByPlaceholderText(/type a command/i);
    fireEvent.change(input, { target: { value: 'go' } });

    // Navigate down
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });

    // Change query - should reset to first item
    fireEvent.change(input, { target: { value: 'submit' } });

    const results = screen.getAllByText(/submit/i);
    expect(results[0].closest('div')).toHaveClass('bg-blue-50');
  });
});
