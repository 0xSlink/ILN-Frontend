import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export interface Command {
  id: string;
  label: string;
  action: () => void;
  category: 'navigation' | 'action' | 'settings';
}

const RECENT_COMMANDS_KEY = 'iln_recent_commands';
const MAX_RECENT = 10;

function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let queryIndex = 0;

  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === lowerQuery.length;
}

export function useCommandPalette(onOpenShortcuts?: () => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);
  const router = useRouter();
  const commands: Command[] = useMemo(
    () => [
      {
        id: 'dashboard',
        label: 'Go to Dashboard',
        action: () => router.push('/dashboard'),
        category: 'navigation',
      },
      {
        id: 'analytics',
        label: 'Go to Analytics',
        action: () => router.push('/analytics'),
        category: 'navigation',
      },
      {
        id: 'governance',
        label: 'Go to Governance',
        action: () => router.push('/governance'),
        category: 'navigation',
      },
      {
        id: 'freelancer',
        label: 'Go to Freelancer',
        action: () => router.push('/freelancer'),
        category: 'navigation',
      },
      {
        id: 'lp',
        label: 'Go to LP Dashboard',
        action: () => router.push('/lp'),
        category: 'navigation',
      },
      {
        id: 'payer',
        label: 'Go to Payer',
        action: () => router.push('/payer'),
        category: 'navigation',
      },
      {
        id: 'submit',
        label: 'Submit new invoice',
        action: () => router.push('/submit'),
        category: 'action',
      },
      {
        id: 'fund',
        label: 'Browse invoices to fund',
        action: () => router.push('/lp'),
        category: 'action',
      },
      {
        id: 'history',
        label: 'View transaction history',
        action: () => router.push('/analytics'),
        category: 'action',
      },
      {
        id: 'notifications',
        label: 'Open notification settings',
        action: () => alert('Notification settings coming soon'),
        category: 'settings',
      },
      {
        id: 'addressbook',
        label: 'Open address book',
        action: () => alert('Address book coming soon'),
        category: 'settings',
      },
      {
        id: 'darkmode',
        label: 'Toggle dark mode',
        action: () => document.documentElement.classList.toggle('dark'),
        category: 'settings',
      },
      {
        id: 'shortcuts',
        label: 'Keyboard shortcuts',
        action: () => onOpenShortcuts?.(),
        category: 'settings',
      },
    ],
    [router, onOpenShortcuts]
  );

  useEffect(() => {
    const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRecentCommandIds(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery('');
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  const executeCommand = useCallback(
    (command: Command) => {
      const updated = [command.id, ...recentCommandIds.filter((id) => id !== command.id)].slice(
        0,
        MAX_RECENT
      );
      setRecentCommandIds(updated);
      localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(updated));
      command.action();
      close();
    },
    [recentCommandIds, close]
  );

  const filteredCommands = useMemo(() => {
    if (!query) {
      return commands.filter((cmd) => recentCommandIds.includes(cmd.id));
    }

    const invoiceMatch = query.match(/^#?(\d+)$/);
    if (invoiceMatch) {
      const invoiceId = invoiceMatch[1];
      return [
        {
          id: `invoice-${invoiceId}`,
          label: `Invoice #${invoiceId}`,
          action: () => router.push(`/i/${invoiceId}`),
          category: 'navigation' as const,
        },
      ];
    }

    return commands.filter((cmd) => fuzzyMatch(cmd.label, query));
  }, [query, commands, recentCommandIds, router]);

  // Cmd/Ctrl+K is owned by KeyboardShortcutsContext, which invokes the `toggle`
  // registered by CommandPalette. A second listener here toggled the palette a
  // second time for the same keypress, so it never actually opened.

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const clearHistory = useCallback(() => {
    setRecentCommandIds([]);
    localStorage.removeItem(RECENT_COMMANDS_KEY);
  }, []);

  return {
    isOpen,
    query,
    setQuery,
    commands: filteredCommands,
    executeCommand,
    open,
    close,
    toggle,
    clearHistory,
  };
}
