/**
 * Per-page accessibility suite for an invoice detail view.
 *
 * Split with __tests__/accessibility.test.tsx (see that file's doc comment for the
 * full picture): unlike the other files in this directory, this suite does NOT render
 * a real page component - it renders a hand-authored markup fixture (`MockInvoiceDetailPage`
 * below) that mirrors the intended DOM shape, so it verifies markup patterns
 * (description lists, live status region, sr-only context) rather than the actual
 * `app/i/[id]/page.tsx` or `app/pay/[id]/page.tsx` output. The root file separately
 * axe-checks the real `app/pay/[id]/page.tsx` under the full app Providers tree.
 * Known gap: `app/i/[id]/page.tsx` itself has no real-component a11y coverage
 * anywhere - worth a follow-up issue rather than in scope here.
 */
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect } from 'vitest';

// Mock the invoice detail page component
const MockInvoiceDetailPage = () => {
  return (
    <main>
      <header>
        <h1>Invoice #12345</h1>
        <div role="status" aria-live="polite">
          <span className="sr-only">Invoice status:</span>
          <span>Funded</span>
        </div>
      </header>

      <section aria-labelledby="invoice-details">
        <h2 id="invoice-details">Invoice Details</h2>
        <dl>
          <dt>Amount:</dt>
          <dd>$1,000 USDC</dd>
          <dt>Due Date:</dt>
          <dd>
            <time dateTime="2026-06-15">June 15, 2026</time>
          </dd>
          <dt>Payer:</dt>
          <dd>GTEST123...EXAMPLE</dd>
        </dl>
      </section>

      <section aria-labelledby="actions">
        <h2 id="actions">Actions</h2>
        <div role="group" aria-label="Invoice actions">
          <button type="button" aria-describedby="pdf-help">
            Download PDF
          </button>
          <div id="pdf-help" className="sr-only">
            Downloads a PDF copy of this invoice
          </div>

          <button type="button" aria-describedby="share-help">
            Share Invoice
          </button>
          <div id="share-help" className="sr-only">
            Copy shareable link to clipboard
          </div>
        </div>
      </section>

      <section aria-labelledby="activity">
        <h2 id="activity">Activity Feed</h2>
        <ul role="list">
          <li>
            <time dateTime="2026-05-28T10:00:00Z">May 28, 2026 at 10:00 AM</time>
            <span>Invoice created</span>
          </li>
          <li>
            <time dateTime="2026-05-28T11:30:00Z">May 28, 2026 at 11:30 AM</time>
            <span>Invoice funded by LP</span>
          </li>
        </ul>
      </section>
    </main>
  );
};

describe('InvoiceDetailPage Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = render(<MockInvoiceDetailPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper heading hierarchy', () => {
    const { container } = render(<MockInvoiceDetailPage />);

    const h1 = container.querySelector('h1');
    expect(h1).toBeInTheDocument();
    expect(h1).toHaveTextContent('Invoice #12345');

    const h2Elements = container.querySelectorAll('h2');
    expect(h2Elements.length).toBeGreaterThan(0);
  });

  it('should have accessible status indicator', () => {
    const { container } = render(<MockInvoiceDetailPage />);

    const statusElement = container.querySelector('[role="status"]');
    expect(statusElement).toBeInTheDocument();
    expect(statusElement).toHaveAttribute('aria-live', 'polite');
  });

  it('should have proper description list structure', () => {
    const { container } = render(<MockInvoiceDetailPage />);

    const dl = container.querySelector('dl');
    expect(dl).toBeInTheDocument();

    const dts = container.querySelectorAll('dt');
    const dds = container.querySelectorAll('dd');
    expect(dts.length).toBe(dds.length);
  });

  it('should have accessible action buttons', () => {
    const { container } = render(<MockInvoiceDetailPage />);

    const buttons = container.querySelectorAll('button');
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('type', 'button');

      // Should have describedby for additional context
      const describedBy = button.getAttribute('aria-describedby');
      if (describedBy) {
        const helpText = container.querySelector(`#${describedBy}`);
        expect(helpText).toBeInTheDocument();
      }
    });
  });

  it('should have accessible time elements', () => {
    const { container } = render(<MockInvoiceDetailPage />);

    const timeElements = container.querySelectorAll('time');
    timeElements.forEach((time) => {
      expect(time).toHaveAttribute('dateTime');
    });
  });

  it('should have proper list structure for activity feed', () => {
    const { container } = render(<MockInvoiceDetailPage />);

    const list = container.querySelector('[role="list"]');
    expect(list).toBeInTheDocument();

    const listItems = list?.querySelectorAll('li');
    expect(listItems?.length).toBeGreaterThan(0);
  });

  it('should have screen reader only text for context', () => {
    const { container } = render(<MockInvoiceDetailPage />);

    const srOnlyElements = container.querySelectorAll('.sr-only');
    expect(srOnlyElements.length).toBeGreaterThan(0);

    srOnlyElements.forEach((element) => {
      expect(element.textContent?.trim()).toBeTruthy();
    });
  });
});
