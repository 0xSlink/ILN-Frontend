import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

const ALLOWED_CATEGORIES = ['Bug', 'Feature', 'UX', 'Other'];
const MAX_FEEDBACK_LENGTH = 5000;
const MAX_EMAIL_LENGTH = 320;
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  const rateLimit = checkRateLimit(
    `feedback:${clientKey}`,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'rate_limit', retryAfter: rateLimit.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const { rating, category, feedback, email } = body;

    if (!rating || !category || !feedback) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
    }

    if (typeof category !== 'string' || !ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    if (
      typeof feedback !== 'string' ||
      feedback.trim().length === 0 ||
      feedback.length > MAX_FEEDBACK_LENGTH
    ) {
      return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 });
    }

    if (email !== undefined && email !== null && email !== '') {
      if (typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
        return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
      }
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const githubOwner = process.env.GITHUB_OWNER;
    const githubRepo = process.env.GITHUB_REPO;

    if (githubToken && githubOwner && githubRepo) {
      const issueTitle = `[Feedback] ${category}: ${rating} stars`;
      const issueBody = `
**Rating:** ${rating} / 5 stars
**Category:** ${category}
**Feedback:**
${feedback}

**Contact Email:** ${email || 'Not provided'}
      `;

      const response = await fetch(
        `https://api.github.com/repos/${githubOwner}/${githubRepo}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'ILN-Feedback-Widget',
          },
          body: JSON.stringify({
            title: issueTitle,
            body: issueBody,
            labels: ['feedback', category.toLowerCase()],
          }),
        }
      );

      if (response.status === 403 || response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        return NextResponse.json(
          { error: 'rate_limit', retryAfter: retryAfter ? parseInt(retryAfter) : 60 },
          { status: 429 }
        );
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error('GitHub API error:', errorData);
        throw new Error('Failed to create GitHub issue');
      }

      const issue = await response.json();
      return NextResponse.json({ success: true, issueUrl: issue.html_url });
    } else {
      // For development or if GitHub is not configured
      console.warn('Feedback received (no GitHub config):', body);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
