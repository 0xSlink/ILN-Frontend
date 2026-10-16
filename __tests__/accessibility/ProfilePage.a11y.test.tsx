/**
 * Per-page accessibility suite for the Profile page.
 *
 * Split with __tests__/accessibility.test.tsx (see that file's doc comment for the
 * full picture): unlike the other files in this directory, this suite does NOT render
 * a real page component - it renders a hand-authored markup fixture (`MockProfilePage`
 * below) that mirrors the intended DOM shape, so it verifies markup patterns (avatar
 * alt text, tab navigation, table/form structure) rather than the actual
 * `app/profile/[address]/page.tsx` output. The root file covers the Freelancer page
 * instead, which is a related but distinct route. Known gap:
 * `app/profile/[address]/page.tsx` itself has no real-component a11y coverage
 * anywhere - worth a follow-up issue rather than in scope here.
 */
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';
import Link from 'next/link';

// Mock the profile page component
const MockProfilePage = () => {
  return (
    <main>
      <header>
        <h1>User Profile</h1>
        <div className="profile-summary">
          <img src="/avatar.png" alt="User avatar for GTEST123...EXAMPLE" width="64" height="64" />
          <div>
            <h2>GTEST123...EXAMPLE</h2>
            <p>Stellar Address</p>
          </div>
        </div>
      </header>

      <nav aria-label="Profile sections">
        <ul role="tablist">
          <li role="presentation">
            <button
              role="tab"
              aria-selected="true"
              aria-controls="overview-panel"
              id="overview-tab"
            >
              Overview
            </button>
          </li>
          <li role="presentation">
            <button
              role="tab"
              aria-selected="false"
              aria-controls="activity-panel"
              id="activity-tab"
            >
              Activity
            </button>
          </li>
          <li role="presentation">
            <button
              role="tab"
              aria-selected="false"
              aria-controls="settings-panel"
              id="settings-tab"
            >
              Settings
            </button>
          </li>
        </ul>
      </nav>

      <div role="tabpanel" id="overview-panel" aria-labelledby="overview-tab" tabIndex={0}>
        <section aria-labelledby="stats-heading">
          <h3 id="stats-heading">Statistics</h3>
          <dl className="stats-grid">
            <dt>Total Invoices:</dt>
            <dd>42</dd>
            <dt>Total Volume:</dt>
            <dd>$125,000 USDC</dd>
            <dt>Success Rate:</dt>
            <dd>98.5%</dd>
          </dl>
        </section>

        <section aria-labelledby="recent-heading">
          <h3 id="recent-heading">Recent Activity</h3>
          <table>
            <caption className="sr-only">Recent invoice activity</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Invoice</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <time dateTime="2026-05-28">May 28, 2026</time>
                </td>
                <td>
                  <Link href="/i/123" aria-describedby="invoice-123-desc">
                    #123
                  </Link>
                  <span id="invoice-123-desc" className="sr-only">
                    Invoice for web development services
                  </span>
                </td>
                <td>$1,000</td>
                <td>
                  <span className="status-badge status-funded" aria-label="Status: Funded">
                    Funded
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <div role="tabpanel" id="activity-panel" aria-labelledby="activity-tab" tabIndex={0} hidden>
        <h3>Activity History</h3>
        <p>Activity content would go here...</p>
      </div>

      <div role="tabpanel" id="settings-panel" aria-labelledby="settings-tab" tabIndex={0} hidden>
        <h3>Profile Settings</h3>
        <form>
          <fieldset>
            <legend>Notification Preferences</legend>
            <label>
              <input type="checkbox" defaultChecked />
              Email notifications for invoice updates
            </label>
            <label>
              <input type="checkbox" />
              SMS notifications for urgent matters
            </label>
          </fieldset>

          <button type="submit">Save Settings</button>
        </form>
      </div>
    </main>
  );
};

describe('ProfilePage Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = render(<MockProfilePage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15000);

  it('should have proper tab navigation', () => {
    const { container } = render(<MockProfilePage />);

    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).toBeInTheDocument();

    const tabs = container.querySelectorAll('[role="tab"]');
    const panels = container.querySelectorAll('[role="tabpanel"]');

    expect(tabs.length).toBe(panels.length);

    tabs.forEach((tab) => {
      expect(tab).toHaveAttribute('aria-selected');
      expect(tab).toHaveAttribute('aria-controls');
    });

    panels.forEach((panel) => {
      expect(panel).toHaveAttribute('aria-labelledby');
      expect(panel).toHaveAttribute('tabindex');
    });
  });

  it('should have accessible avatar image', () => {
    const { container } = render(<MockProfilePage />);

    const avatar = container.querySelector('img');
    expect(avatar).toHaveAttribute('alt');
    expect(avatar?.getAttribute('alt')).toContain('User avatar');
  });

  it('should have proper table structure', () => {
    const { container } = render(<MockProfilePage />);

    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();

    const caption = table?.querySelector('caption');
    expect(caption).toBeInTheDocument();

    const headers = table?.querySelectorAll('th');
    headers?.forEach((header) => {
      expect(header).toHaveAttribute('scope');
    });
  });

  it('should have accessible form controls', () => {
    const { container } = render(<MockProfilePage />);

    const fieldset = container.querySelector('fieldset');
    expect(fieldset).toBeInTheDocument();

    const legend = fieldset?.querySelector('legend');
    expect(legend).toBeInTheDocument();

    const labels = container.querySelectorAll('label');
    labels.forEach((label) => {
      const input = label.querySelector('input');
      expect(input).toBeInTheDocument();
    });
  });

  it('should have accessible status indicators', () => {
    const { container } = render(<MockProfilePage />);

    const statusBadges = container.querySelectorAll('.status-badge');
    statusBadges.forEach((badge) => {
      expect(badge).toHaveAttribute('aria-label');
    });
  });

  it('should have proper link descriptions', () => {
    const { container } = render(<MockProfilePage />);

    const links = container.querySelectorAll('a[aria-describedby]');
    links.forEach((link) => {
      const describedBy = link.getAttribute('aria-describedby');
      if (describedBy) {
        const description = container.querySelector(`#${describedBy}`);
        expect(description).toBeInTheDocument();
      }
    });
  });

  it('should have screen reader content for context', () => {
    const { container } = render(<MockProfilePage />);

    const srOnlyElements = container.querySelectorAll('.sr-only');
    expect(srOnlyElements.length).toBeGreaterThan(0);
  });
});
