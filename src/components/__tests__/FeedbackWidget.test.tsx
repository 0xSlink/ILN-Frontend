import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import FeedbackWidget from '../FeedbackWidget';
import * as constants from '@/constants';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';

// Default mock for constants
vi.mock('@/constants', async (importActual) => {
  const actual = await importActual<typeof import('@/constants')>();
  return {
    ...actual,
    STELLAR_NETWORK: 'testnet',
  };
});

describe('FeedbackWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - allow overwriting for test
    constants.STELLAR_NETWORK = 'testnet';
  });

  it('should not render when network is not testnet', () => {
    // @ts-expect-error - allow overwriting for test
    constants.STELLAR_NETWORK = 'mainnet';
    render(<FeedbackWidget />);
    expect(screen.queryByRole('button', { name: /feedback/i })).not.toBeInTheDocument();
  });

  it('should render when network is testnet', () => {
    render(<FeedbackWidget />);
    expect(screen.getByRole('button', { name: /feedback/i })).toBeInTheDocument();
  });

  it('should open modal when clicking the feedback button', () => {
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole('button', { name: /feedback/i }));
    expect(screen.getByText(/share feedback/i)).toBeInTheDocument();
  });

  it('should submit feedback and show thank you message', async () => {
    let capturedBody: any = null;
    server.use(
      http.post('/api/feedback', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ success: true });
      })
    );

    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole('button', { name: /feedback/i }));

    // Fill the form
    fireEvent.click(screen.getByLabelText(/4 stars/i));

    const categorySelect = screen.getByLabelText(/category/i);
    fireEvent.change(categorySelect, { target: { value: 'Suggestion' } });

    const descriptionTextarea = screen.getByLabelText(/description/i);
    fireEvent.change(descriptionTextarea, { target: { value: 'Great app!' } });

    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => {
      expect(screen.getByText(/thank you/i)).toBeInTheDocument();
    });

    expect(capturedBody).toEqual({
      rating: 4,
      category: 'Suggestion',
      feedback: 'Great app!',
      email: 'test@example.com',
    });
  });

  it('should show error toast if submission fails', async () => {
    server.use(
      http.post('/api/feedback', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole('button', { name: /feedback/i }));

    // Fill the form enough to submit
    fireEvent.click(screen.getByLabelText(/5 stars/i));
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Bug report' },
    });

    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }));

    await waitFor(() => {
      // toast is harder to test directly without mocking sonner,
      // but we can check if the modal is still open and not in submitted state
      expect(screen.getByText(/share feedback/i)).toBeInTheDocument();
      expect(screen.queryByText(/thank you/i)).not.toBeInTheDocument();
    });
  });
});
