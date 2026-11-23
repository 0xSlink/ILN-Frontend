'use client';

import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import PersonalizedDashboard from '@/components/PersonalizedDashboard';
import Stats from '@/components/Stats';
import RecentTransactionsPanel from '@/components/RecentTransactionsPanel';
import HowItWorks from '@/components/HowItWorks';
import ForFreelancers from '@/components/ForFreelancers';
import ForLPs from '@/components/ForLPs';
import ContractActions from '@/components/ContractActions';
import BuiltOnStellar from '@/components/BuiltOnStellar';
import OpenSource from '@/components/OpenSource';
import Footer from '@/components/Footer';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/**
 * Homepage composition (#1271). Financial values are owned by the child
 * components below; each metric either comes from a verified RPC/indexer hook
 * or renders an explicit unavailable state. The homepage itself adds no mock,
 * hardcoded, or fallback protocol values.
 */
export default function Home() {
  useDocumentTitle({ pageTitle: 'Home' });

  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <PersonalizedDashboard />
      <Stats />
      <RecentTransactionsPanel />
      <HowItWorks />
      <ForFreelancers />
      <ForLPs />
      <ContractActions />
      <BuiltOnStellar />
      <OpenSource />
      <Footer />
    </main>
  );
}
