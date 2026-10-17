'use client';

import React, { useState } from 'react';
import { STELLAR_NETWORK } from '@/constants';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; issueUrl?: string }
  | { status: 'network_error' }
  | { status: 'rate_limit'; retryAfter: number };

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState('Bug');
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

  if (STELLAR_NETWORK !== 'testnet') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedback.trim()) {
      setFeedbackError('Please describe your feedback before submitting.');
      return;
    }
    setFeedbackError('');

    if (rating === 0) {
      return; // rating validation handled by required star UI
    }

    setSubmitState({ status: 'submitting' });
    try {
      // eslint-disable-next-line no-restricted-globals, no-restricted-syntax -- Legacy inline exception pending query hook migration
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, category, feedback, email }),
      });

      const data = await response.json();

      if (response.status === 429 && data.error === 'rate_limit') {
        setSubmitState({ status: 'rate_limit', retryAfter: data.retryAfter ?? 60 });
        return;
      }

      if (!response.ok) throw new Error('Failed to submit feedback');

      setSubmitState({ status: 'success', issueUrl: data.issueUrl });
    } catch {
      setSubmitState({ status: 'network_error' });
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setSubmitState({ status: 'idle' });
      setRating(0);
      setCategory('Bug');
      setFeedback('');
      setEmail('');
      setFeedbackError('');
    }, 300);
  };

  const handleRetry = () => {
    setSubmitState({ status: 'idle' });
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 left-8 z-[60] flex items-center gap-2 px-6 py-3 bg-secondary text-on-secondary rounded-full shadow-lg hover:scale-105 transition-transform active:scale-95 focus:outline-none focus:ring-4 focus:ring-secondary/40"
      >
        <span className="material-symbols-outlined">feedback</span>
        <span className="font-bold text-sm">Feedback</span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest shadow-2xl p-6 text-left animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant/80 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {submitState.status === 'success' ? (
              <div className="py-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex justify-center">
                  <div className="h-16 w-16 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                  </div>
                </div>
                <h2 className="text-2xl font-headline text-on-surface">Thank You!</h2>
                <p className="text-on-surface-variant leading-relaxed">
                  Your feedback has been received. We appreciate your help in building ILN.
                </p>
                {submitState.issueUrl && (
                  <a
                    href={submitState.issueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <span className="material-symbols-outlined text-base">open_in_new</span>
                    View your GitHub issue
                  </a>
                )}
                <Button onClick={handleClose} className="w-full mt-4">
                  Close
                </Button>
              </div>
            ) : submitState.status === 'network_error' ? (
              <div className="py-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex justify-center">
                  <div className="h-16 w-16 bg-error-container text-on-error-container rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl">wifi_off</span>
                  </div>
                </div>
                <h2 className="text-2xl font-headline text-on-surface">Connection Error</h2>
                <p className="text-on-surface-variant leading-relaxed">
                  Could not submit your feedback. Please check your connection and try again.
                </p>
                <Button onClick={handleRetry} className="w-full">
                  Retry
                </Button>
              </div>
            ) : submitState.status === 'rate_limit' ? (
              <div className="py-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex justify-center">
                  <div className="h-16 w-16 bg-tertiary-container text-on-tertiary-container rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl">schedule</span>
                  </div>
                </div>
                <h2 className="text-2xl font-headline text-on-surface">Rate Limited</h2>
                <p className="text-on-surface-variant leading-relaxed">
                  Too many submissions. Please wait{' '}
                  <span className="font-semibold text-on-surface">{submitState.retryAfter}s</span>{' '}
                  before trying again.
                </p>
                <Button onClick={handleRetry} className="w-full">
                  Got it
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-2xl font-headline text-on-surface">Share Feedback</h2>
                <p className="text-sm text-on-surface-variant">
                  Help us improve ILN. Your insights are invaluable.
                </p>

                {/* Rating */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-on-surface">
                    How would you rate your experience? *
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`text-3xl transition-colors ${
                          rating >= star ? 'text-yellow-500' : 'text-surface-variant'
                        }`}
                        aria-label={`${star} stars`}
                      >
                        <span
                          className={`material-symbols-outlined ${
                            rating >= star ? 'fill-[1]' : ''
                          }`}
                        >
                          star
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <label htmlFor="category" className="text-sm font-medium text-on-surface">
                    Category *
                  </label>
                  <Select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    <option value="Bug">Bug</option>
                    <option value="Suggestion">Suggestion</option>
                    <option value="Other">Other</option>
                  </Select>
                </div>

                {/* Feedback Text */}
                <div className="space-y-2">
                  <label htmlFor="feedback" className="text-sm font-medium text-on-surface">
                    Description *
                  </label>
                  <Textarea
                    id="feedback"
                    placeholder="Tell us what's on your mind..."
                    value={feedback}
                    onChange={(e) => {
                      setFeedback(e.target.value);
                      if (feedbackError && e.target.value.trim()) setFeedbackError('');
                    }}
                    className="min-h-[120px]"
                  />
                  {feedbackError && <p className="text-sm text-error">{feedbackError}</p>}
                </div>

                {/* Email (Optional) */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-on-surface">
                    Email (optional)
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="text-xs text-on-surface-variant italic">
                    We&apos;ll only use this if we need to follow up.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitState.status === 'submitting'}
                  >
                    {submitState.status === 'submitting' ? 'Submitting...' : 'Submit Feedback'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
