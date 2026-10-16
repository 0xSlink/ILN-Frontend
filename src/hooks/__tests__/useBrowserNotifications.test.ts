import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBrowserNotifications } from '../useBrowserNotifications';

function installNotificationMock(permission: NotificationPermission) {
  const requestPermission = vi.fn().mockResolvedValue(permission);
  const NotificationMock = vi.fn(function (this: any, title: string, options?: any) {
    this.title = title;
    this.options = options;
  }) as unknown as {
    new (title: string, options?: any): any;
    permission: NotificationPermission;
    requestPermission: typeof requestPermission;
  };
  NotificationMock.permission = permission;
  NotificationMock.requestPermission = requestPermission;
  Object.defineProperty(window, 'Notification', {
    value: NotificationMock,
    writable: true,
    configurable: true,
  });
  return { NotificationMock, requestPermission };
}

describe('useBrowserNotifications', () => {
  const originalNotification = (window as any).Notification;

  afterEach(() => {
    if (originalNotification) {
      Object.defineProperty(window, 'Notification', {
        value: originalNotification,
        writable: true,
        configurable: true,
      });
    } else {
      delete (window as any).Notification;
    }
  });

  it('reports unsupported and denied when the Notification API is unavailable', () => {
    delete (window as any).Notification;
    const { result } = renderHook(() => useBrowserNotifications());

    expect(result.current.isSupported).toBe(false);
    expect(result.current.permission).toBe('denied');
    expect(result.current.showNotification('hi')).toBeNull();
  });

  it('reads the current permission when supported', () => {
    installNotificationMock('granted');
    const { result } = renderHook(() => useBrowserNotifications());

    expect(result.current.isSupported).toBe(true);
    expect(result.current.permission).toBe('granted');
  });

  it('requests permission and updates state on success', async () => {
    installNotificationMock('default');
    const { NotificationMock } = installNotificationMock('default');
    NotificationMock.requestPermission.mockResolvedValue('granted');

    const { result } = renderHook(() => useBrowserNotifications());
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.requestPermission();
    });

    expect(outcome).toBe('granted');
    expect(result.current.permission).toBe('granted');
  });

  it('falls back to denied and logs when requestPermission throws', async () => {
    const { NotificationMock } = installNotificationMock('default');
    NotificationMock.requestPermission.mockRejectedValue(new Error('blocked'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useBrowserNotifications());
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.requestPermission();
    });

    expect(outcome).toBe('denied');
    expect(result.current.permission).toBe('denied');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('returns denied from requestPermission when unsupported', async () => {
    delete (window as any).Notification;
    const { result } = renderHook(() => useBrowserNotifications());

    const outcome = await result.current.requestPermission();
    expect(outcome).toBe('denied');
  });

  it('shows a notification only when permission is granted', () => {
    const { NotificationMock } = installNotificationMock('granted');
    const { result } = renderHook(() => useBrowserNotifications());

    const notification = result.current.showNotification('New invoice', { body: 'details' });
    expect(NotificationMock).toHaveBeenCalledWith('New invoice', { body: 'details' });
    expect(notification).not.toBeNull();
  });

  it('does not show a notification when permission is not granted', () => {
    installNotificationMock('denied');
    const { result } = renderHook(() => useBrowserNotifications());
    expect(result.current.showNotification('New invoice')).toBeNull();
  });
});
