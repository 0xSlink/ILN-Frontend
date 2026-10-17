'use client';

import { useWallet } from '@/context/WalletContext';
import { useNotification } from '@/context/NotificationContext';
import { useInvoices } from '@/hooks/queries';
import { useNotificationEvents } from '@/hooks/useNotificationEvents';
import { usePositionPolling } from '@/hooks/usePositionPolling';
import { useToast } from '@/context/ToastContext';

export default function NotificationEventPoller() {
  const { address } = useWallet();
  const { addNotification } = useNotification();
  const { addToast } = useToast();
  const { data: invoices = [] } = useInvoices();

  usePositionPolling({
    invoices,
    address,
    addToast,
    addNotification,
  });

  useNotificationEvents({
    invoices,
    address,
    addNotification,
  });

  return null;
}
