import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

function Bomb({ message = 'boom' }: { message?: string }): React.ReactElement {
  throw new Error(message);
}

describe('ErrorBoundary', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (process.env as any).NODE_ENV = originalEnv;
    Object.assign(navigator, { clipboard: undefined });
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>all good</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('renders the fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong loading this section.')).toBeInTheDocument();
  });

  it('shows a custom fallback message when provided', () => {
    render(
      <ErrorBoundary fallbackMessage="Custom failure message">
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom failure message')).toBeInTheDocument();
  });

  it('calls onRetry and re-renders children after clicking Retry', () => {
    const onRetry = vi.fn();
    let shouldThrow = true;
    function Toggle() {
      if (shouldThrow) throw new Error('boom');
      return <div>recovered</div>;
    }
    const { rerender } = render(
      <ErrorBoundary onRetry={onRetry}>
        <Toggle />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalled();

    rerender(
      <ErrorBoundary onRetry={onRetry}>
        <Toggle />
      </ErrorBoundary>
    );
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('copies error details to the clipboard and shows a temporary "Copied" state', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <ErrorBoundary>
        <Bomb message="clipboard test" />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('clipboard test');
    await waitFor(() => expect(screen.getByText('Copied')).toBeInTheDocument());

    vi.advanceTimersByTime(2000);
    await waitFor(() => expect(screen.getByText('Copy')).toBeInTheDocument());
    vi.useRealTimers();
  });

  it('falls back to execCommand copy when the Clipboard API is unavailable', async () => {
    Object.assign(navigator, { clipboard: undefined });
    const execCommandSpy = vi.fn(() => true);
    (document as any).execCommand = execCommandSpy;

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText('Copy'));
    await waitFor(() => expect(execCommandSpy).toHaveBeenCalledWith('copy'));
  });

  it('links to a pre-filled feedback URL including the error message', () => {
    render(
      <ErrorBoundary>
        <Bomb message="link test" />
      </ErrorBoundary>
    );
    const link = screen.getByText('Report issue').closest('a')!;
    expect(link.getAttribute('href')).toContain('feedback=true');
    expect(link.getAttribute('href')).toContain(encodeURIComponent('link test'));
  });

  it('shows dev-only stack trace and docs link when NODE_ENV is development', () => {
    (process.env as any).NODE_ENV = 'development';
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText('Docs')).toBeInTheDocument();
    expect(screen.getByText('Stack trace')).toBeInTheDocument();
  });

  it('hides dev-only details in production', () => {
    (process.env as any).NODE_ENV = 'production';
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.queryByText('Docs')).not.toBeInTheDocument();
    expect(screen.queryByText('Stack trace')).not.toBeInTheDocument();
  });
});
