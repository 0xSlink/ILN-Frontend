import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import NotificationsPage from '../NotificationsPage';
import type { NotificationItem } from '@/context/NotificationContext';
import { NOTIFICATIONS_PAGE_SIZE } from '@/utils/notificationHelpers';

const markAsRead = vi.fn();
const markAllAsRead = vi.fn();
let mockNotifications: NotificationItem[] = [];
let mockConnected = true;

vi.mock('@/context/NotificationContext', () => ({
  useNotification: () => ({
    notifications: mockNotifications,
    unreadCount: mockNotifications.filter((n) => !n.read).length,
    markAsRead,
    markAllAsRead,
  }),
}));

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({ isConnected: mockConnected }),
}));

vi.mock('@/components/Navbar', () => ({ default: () => null }));
vi.mock('@/components/Footer', () => ({ default: () => null }));

// Simulates a high-volume account (e.g. an active LP with a long invoice and
// governance history). Items are built oldest-first so the page has to sort.
function buildNotifications(count: number): NotificationItem[] {
  const categories = ['invoice', 'lp', 'governance', 'reputation'] as const;
  return Array.from({ length: count }, (_, index) => ({
    id: `n-${index}`,
    category: categories[index % categories.length],
    type: 'info',
    title: `Event ${index}`,
    message: `Activity ${index}`,
    href: '/dashboard',
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    read: index % 3 === 0,
  }));
}

function renderedRows() {
  return within(screen.getByRole('list')).getAllByRole('listitem');
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    mockNotifications = [];
    mockConnected = true;
    markAsRead.mockClear();
  });

  it('prompts to connect when no wallet is connected', () => {
    mockConnected = false;
    render(<NotificationsPage />);
    expect(screen.getByText('Connect your wallet')).toBeInTheDocument();
  });

  it('shows the empty state with no notifications', () => {
    render(<NotificationsPage />);
    expect(screen.getByText('No notifications yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Load more/i })).not.toBeInTheDocument();
  });

  it('renders a small list in full without a load-more control', () => {
    mockNotifications = buildNotifications(5);
    render(<NotificationsPage />);
    expect(renderedRows()).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /Load more/i })).not.toBeInTheDocument();
  });

  describe('high-volume account', () => {
    const TOTAL = 5000;

    it('mounts only a bounded page of rows, newest first', () => {
      mockNotifications = buildNotifications(TOTAL);

      const start = performance.now();
      render(<NotificationsPage />);
      const elapsed = performance.now() - start;

      const rows = renderedRows();
      expect(rows).toHaveLength(NOTIFICATIONS_PAGE_SIZE);
      expect(rows[0]).toHaveTextContent(`Event ${TOTAL - 1}`);
      expect(
        screen.getByRole('button', {
          name: `Load more (${TOTAL - NOTIFICATIONS_PAGE_SIZE} remaining)`,
        })
      ).toBeInTheDocument();
      // Generous budget: the point is that render cost no longer scales with
      // TOTAL (mounting all 5000 rows takes seconds in jsdom).
      expect(elapsed).toBeLessThan(2000);
    });

    it('reveals further pages on demand', () => {
      mockNotifications = buildNotifications(TOTAL);
      render(<NotificationsPage />);

      fireEvent.click(screen.getByRole('button', { name: /Load more/i }));
      expect(renderedRows()).toHaveLength(NOTIFICATIONS_PAGE_SIZE * 2);
      expect(
        screen.getByRole('button', {
          name: `Load more (${TOTAL - NOTIFICATIONS_PAGE_SIZE * 2} remaining)`,
        })
      ).toBeInTheDocument();
    });

    it('hides the load-more control once every row is shown', () => {
      mockNotifications = buildNotifications(NOTIFICATIONS_PAGE_SIZE + 5);
      render(<NotificationsPage />);

      fireEvent.click(screen.getByRole('button', { name: /Load more \(5 remaining\)/i }));
      expect(renderedRows()).toHaveLength(NOTIFICATIONS_PAGE_SIZE + 5);
      expect(screen.queryByRole('button', { name: /Load more/i })).not.toBeInTheDocument();
    });

    it('still marks the clicked notification as read', () => {
      mockNotifications = buildNotifications(TOTAL);
      render(<NotificationsPage />);

      fireEvent.click(screen.getByRole('link', { name: new RegExp(`Event ${TOTAL - 1}\\b`) }));
      expect(markAsRead).toHaveBeenCalledWith(`n-${TOTAL - 1}`);
    });
  });

  describe('category filtering', () => {
    function item(id: string, category: NotificationItem['category'], read = false) {
      return {
        id,
        category,
        type: 'info' as const,
        title: `${category} event ${id}`,
        message: 'Activity',
        href: '/dashboard',
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, Number(id))).toISOString(),
        read,
      };
    }

    beforeEach(() => {
      mockNotifications = [
        item('1', 'invoice'),
        item('2', 'invoice', true),
        item('3', 'governance'),
        item('4', 'admin'),
        item('5', 'lp', true),
      ];
    });

    function filterButton(name: RegExp) {
      return within(
        screen.getByRole('group', { name: 'Filter notifications by category' })
      ).getByRole('button', { name });
    }

    it('shows every category with total and unread counts, defaulting to All', () => {
      render(<NotificationsPage />);
      expect(filterButton(/^All \(5, 3 unread\)$/)).toHaveAttribute('aria-pressed', 'true');
      expect(filterButton(/^Invoices \(2, 1 unread\)$/)).toHaveAttribute('aria-pressed', 'false');
      expect(filterButton(/^Governance \(1, 1 unread\)$/)).toBeInTheDocument();
      expect(filterButton(/^Admin \(1, 1 unread\)$/)).toBeInTheDocument();
      expect(filterButton(/^Liquidity \(1\)$/)).toBeInTheDocument();
      expect(filterButton(/^Reputation \(0\)$/)).toBeInTheDocument();
      expect(renderedRows()).toHaveLength(5);
    });

    it('narrows the feed to the selected category', () => {
      render(<NotificationsPage />);
      fireEvent.click(filterButton(/^Governance/));
      expect(filterButton(/^Governance/)).toHaveAttribute('aria-pressed', 'true');
      expect(renderedRows()).toHaveLength(1);
      expect(renderedRows()[0]).toHaveTextContent('governance event 3');

      fireEvent.click(filterButton(/^Admin/));
      expect(renderedRows()).toHaveLength(1);
      expect(renderedRows()[0]).toHaveTextContent('admin event 4');

      fireEvent.click(filterButton(/^Invoices/));
      expect(renderedRows().map((row) => row.textContent)).toEqual([
        expect.stringContaining('invoice event 2'),
        expect.stringContaining('invoice event 1'),
      ]);
    });

    it('shows a category empty state with a way back to all notifications', () => {
      render(<NotificationsPage />);
      fireEvent.click(filterButton(/^Reputation/));
      expect(screen.getByText('No reputation notifications.')).toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Show all notifications' }));
      expect(renderedRows()).toHaveLength(5);
    });

    it('hides the filter bar when there are no notifications', () => {
      mockNotifications = [];
      render(<NotificationsPage />);
      expect(
        screen.queryByRole('group', { name: 'Filter notifications by category' })
      ).not.toBeInTheDocument();
    });

    it('paginates within the filtered category and resets the window on change', () => {
      mockNotifications = Array.from({ length: NOTIFICATIONS_PAGE_SIZE * 3 }, (_, index) =>
        item(String(index), index % 2 === 0 ? 'invoice' : 'governance')
      );
      render(<NotificationsPage />);

      fireEvent.click(filterButton(/^Invoices/));
      const invoiceTotal = (NOTIFICATIONS_PAGE_SIZE * 3) / 2;
      expect(renderedRows()).toHaveLength(NOTIFICATIONS_PAGE_SIZE);
      expect(
        screen.getByRole('button', {
          name: `Load more (${invoiceTotal - NOTIFICATIONS_PAGE_SIZE} remaining)`,
        })
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Load more/i }));
      expect(renderedRows()).toHaveLength(invoiceTotal);

      fireEvent.click(filterButton(/^Governance/));
      expect(renderedRows()).toHaveLength(NOTIFICATIONS_PAGE_SIZE);
      renderedRows().forEach((row) => expect(row).toHaveTextContent('governance event'));
    });
  });
});
