'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// ─── Lifecycle Diagram Component ──────────────────────────────────────────────

function LifecycleDiagram() {
  const steps = [
    { id: 'draft', label: 'Draft', icon: 'edit_note', color: 'text-on-surface-variant' },
    { id: 'active', label: 'Active', icon: 'how_to_vote', color: 'text-primary' },
    { id: 'passed', label: 'Passed', icon: 'check_circle', color: 'text-emerald-500' },
    { id: 'timelock', label: 'Timelock', icon: 'schedule', color: 'text-amber-500' },
    { id: 'executed', label: 'Executed', icon: 'rocket_launch', color: 'text-purple-500' },
  ];

  return (
    <div className="bg-surface-container-highest rounded-2xl p-8 border border-outline-variant/30 overflow-x-auto">
      <div className="flex items-center justify-between min-w-[600px] relative">
        {/* Connector Line */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-outline-variant -translate-y-[22px] z-0" />

        {steps.map((step, i) => (
          <div
            key={step.id}
            className="relative z-10 flex flex-col items-center gap-3 bg-surface-container-highest px-4"
          >
            <div
              className={`w-12 h-12 rounded-full border-2 border-outline-variant bg-surface-container-lowest flex items-center justify-center ${step.color} shadow-sm`}
            >
              <span className="material-symbols-outlined text-[24px]">{step.icon}</span>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-on-surface">{step.label}</p>
              <p className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                Step {i + 1}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4 mt-8 min-w-[600px]">
        <p className="text-[11px] text-on-surface-variant text-center">
          Community discussion & feedback
        </p>
        <p className="text-[11px] text-on-surface-variant text-center">
          7-10 days of on-chain voting
        </p>
        <p className="text-[11px] text-on-surface-variant text-center">Quorum and majority met</p>
        <p className="text-[11px] text-on-surface-variant text-center">2-3 day security delay</p>
        <p className="text-[11px] text-on-surface-variant text-center">
          Changes applied to protocol
        </p>
      </div>
    </div>
  );
}

// ─── FAQ Item Component ───────────────────────────────────────────────────────

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="border-b border-outline-variant/20 py-6 last:border-0">
      <h4 className="text-lg font-bold text-on-surface mb-2">{question}</h4>
      <p className="text-on-surface-variant leading-relaxed text-sm">{answer}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GovernanceHowItWorksPage() {
  useDocumentTitle({ pageTitle: 'How Governance Works' });

  const sections = [
    {
      title: 'What Governance Controls',
      icon: 'settings_input_component',
      description:
        "ILN holders have direct control over the protocol's core parameters and evolution. This includes discount rate caps, protocol fees, supported currencies (like USDC, EURC), and upgrades to the smart contracts themselves.",
    },
    {
      title: 'Creating Proposals',
      icon: 'add_circle',
      description:
        'Any community member with at least 500 ILN can submit a proposal. Proposals start as drafts for community discussion before being moved to an on-chain vote.',
    },
    {
      title: 'Voting & Participation',
      icon: 'ballot',
      description:
        "One ILN equals one vote. You can vote 'For' or 'Against'. Your tokens are not locked during voting; your voting power is calculated based on your balance at the time the proposal was created.",
    },
    {
      title: 'Quorum & Thresholds',
      icon: 'groups',
      description:
        "For a proposal to pass, it must meet a Quorum (minimum total votes) and a majority threshold (more 'For' than 'Against'). The current quorum is 100,000 ILN.",
    },
    {
      title: 'The Timelock',
      icon: 'lock_clock',
      description:
        "Once a proposal passes, it enters a 'Timelock' period (typically 48-72 hours). This delay ensures the community has time to prepare for changes or exit the protocol if they fundamentally disagree with the outcome.",
    },
    {
      title: 'Delegation',
      icon: 'person_add',
      description:
        "If you don't have the time to review every proposal, you can delegate your voting power to a trusted community member. You retain ownership of your tokens, but they vote on your behalf.",
    },
  ];

  const faqs = [
    {
      question: 'Do I lose my tokens if I vote?',
      answer:
        "No. Voting is a gas-only transaction (on Stellar). Your ILN tokens remain in your wallet and are never 'spent' or locked by the governance process.",
    },
    {
      question: 'Can I change my vote?',
      answer:
        'Yes, you can update your vote at any time while the voting period is active. Only your last recorded choice will be counted.',
    },
    {
      question: 'What happens if a proposal fails?',
      answer:
        "If a proposal fails to reach quorum or doesn't receive a majority of 'For' votes, no changes are made to the protocol. The proposer can refine the idea and resubmit after addressing community feedback.",
    },
    {
      question: 'How do I get ILN tokens to participate?',
      answer:
        'ILN tokens are earned by providing liquidity to the network. The more invoices you help fund, the more governance weight you accumulate over time.',
    },
  ];

  return (
    <main className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-8 bg-surface-container-lowest">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Guide</p>
          <h1 className="text-4xl md:text-6xl font-headline mb-6 leading-tight">
            How ILN Governance Works
          </h1>
          <p className="text-xl text-on-surface-variant leading-relaxed">
            The Invoice Liquidity Network is owned and operated by its users. Learn how you can help
            shape the future of decentralised invoice factoring.
          </p>
        </div>
      </section>

      {/* Lifecycle Diagram Section */}
      <section className="py-16 px-8 border-y border-outline-variant/10 bg-surface-container-low">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-headline mb-8 text-center">The Proposal Lifecycle</h2>
          <LifecycleDiagram />
        </div>
      </section>

      {/* Core Concepts Grid */}
      <section className="py-24 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
            {sections.map((section) => (
              <div key={section.title} className="flex flex-col items-start">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6">
                  <span className="material-symbols-outlined">{section.icon}</span>
                </div>
                <h3 className="text-xl font-bold text-on-surface mb-3">{section.title}</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  {section.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-8 bg-surface-container-lowest">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-headline mb-12 text-center">Frequently Asked Questions</h2>
          <div className="divide-y divide-outline-variant/10">
            {faqs.map((faq, i) => (
              <FAQItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-8 bg-primary text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-headline mb-6">Ready to make an impact?</h2>
          <p className="text-primary-container text-lg mb-10 opacity-90">
            Browse active proposals and join the discussion in the ILN governance forum.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/governance"
              className="w-full sm:w-auto bg-white text-primary px-8 py-4 rounded-xl font-bold text-lg hover:bg-surface-container-lowest transition-all active:scale-95"
            >
              Start Participating
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
