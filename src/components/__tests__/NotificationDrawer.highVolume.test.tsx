import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import NotificationDrawer from '../NotificationDrawer';
import type { NotificationItem } from '@/context/NotificationContext';
import { NOTIFICATIONS_PAGE_SIZE } from '@/utils/notificationHelpers';

let mockNotifications: NotificationItem[] = [];

vi.mock('@/context/NotificationContext', () => ({
  useNotification: () => ({
    notifications: mockNotifications,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  }),
}));

function buildNotifications(count: number): NotificationItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `n-${index}`,
    category: 'lp',
    type: 'info',
    title: `Event ${index}`,
    message: `Activity ${index}`,
    href: '/lp',
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    read: false,
  }));
}

function renderedRows() {
  return within(screen.getByRole('list')).getAllByRole('listitem');
}

describe('NotificationDrawer (high-volume account)', () => {
  const TOTAL = 5000;

  beforeEach(() => {
    mockNotifications = buildNotifications(TOTAL);
  });

  it('mounts only a bounded page of rows, newest first', () => {
    const start = performance.now();
    render(<NotificationDrawer onClose={vi.fn()} />);
    const elapsed = performance.now() - start;

    const rows = renderedRows();
    expect(rows).toHaveLength(NOTIFICATIONS_PAGE_SIZE);
    expect(rows[0]).toHaveTextContent(`Event ${TOTAL - 1}`);
    expect(elapsed).toBeLessThan(2000);
  });

  it('reveals further pages on demand', () => {
    render(<NotificationDrawer onClose={vi.fn()} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: `Load more (${TOTAL - NOTIFICATIONS_PAGE_SIZE} remaining)`,
      })
    );
    expect(renderedRows()).toHaveLength(NOTIFICATIONS_PAGE_SIZE * 2);
  });
});
