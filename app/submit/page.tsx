'use client';

import { Suspense } from 'react';

import Navbar from '@/components/Navbar';
import SubmitInvoiceForm from '@/components/SubmitInvoiceForm';

export default function SubmitRoute() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <section className="pt-32 pb-16 px-4 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <Suspense fallback={null}>
            <SubmitInvoiceForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
