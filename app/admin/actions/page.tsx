'use client';

import Navbar from '@/components/Navbar';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import AdminActionHistoryPanel from '@/components/AdminActionHistoryPanel';

export default function AdminActionHistoryPage() {
  useDocumentTitle({ pageTitle: 'Admin Action History' });

  return (
    <main className="min-h-screen bg-surface-container-lowest">
      <Navbar />
      <section className="px-4 pb-12 pt-28 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Transparency
            </p>
            <h1 className="mt-2 text-3xl font-bold text-on-surface">Admin Action History</h1>
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
              A read-only view of recent multisig admin actions on the ILN protocol. This log is
              sourced directly from the on-chain admin action history view for full transparency.
            </p>
          </div>

          <AdminActionHistoryPanel publicView />
        </div>
      </section>
    </main>
  );
}
