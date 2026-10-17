'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import {
  roadmapItems,
  getRoadmapPhases,
  getPhaseItems,
  RoadmapPhase,
  RoadmapItem,
  RoadmapStatus,
} from '@/data/roadmap';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { CheckCircle2, Clock, Zap, ExternalLink } from 'lucide-react';

const statusConfig: Record<RoadmapStatus, { color: string; icon: React.ReactNode; label: string }> =
  {
    Done: {
      color: 'bg-green-50 border-green-200',
      icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
      label: 'Done',
    },
    'In Progress': {
      color: 'bg-blue-50 border-blue-200',
      icon: <Zap className="w-5 h-5 text-blue-600" />,
      label: 'In Progress',
    },
    Planned: {
      color: 'bg-gray-50 border-gray-200',
      icon: <Clock className="w-5 h-5 text-gray-600" />,
      label: 'Planned',
    },
  };

const phaseColors: Record<RoadmapPhase, string> = {
  Testnet: 'from-purple-500 to-purple-600',
  Mainnet: 'from-blue-500 to-blue-600',
  'Post-Launch': 'from-orange-500 to-orange-600',
};

interface RoadmapCardProps {
  item: RoadmapItem;
}

function RoadmapCard({ item }: RoadmapCardProps) {
  const config = statusConfig[item.status];

  return (
    <div
      className={`border-l-4 rounded-lg p-6 ${config.color} transition-transform hover:scale-105 duration-300`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {config.icon}
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {config.label}
            </span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
          <p className="text-sm text-gray-700 mb-4 leading-relaxed">{item.description}</p>

          <div className="flex flex-wrap items-center gap-3">
            {item.estimatedDate && (
              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                {item.estimatedDate}
              </span>
            )}
            {item.issueUrl && (
              <a
                href={item.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                {item.status === 'In Progress' ? (
                  <>
                    <ExternalLink className="w-3 h-3" />
                    Contribute to this feature
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-3 h-3" />
                    View on GitHub
                  </>
                )}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PhaseColumnProps {
  phase: RoadmapPhase;
  items: RoadmapItem[];
}

function PhaseColumn({ phase, items }: PhaseColumnProps) {
  const itemsByStatus: Record<RoadmapStatus, RoadmapItem[]> = {
    Done: items.filter((i) => i.status === 'Done'),
    'In Progress': items.filter((i) => i.status === 'In Progress'),
    Planned: items.filter((i) => i.status === 'Planned'),
  };

  return (
    <div className="space-y-6">
      <div className={`bg-gradient-to-r ${phaseColors[phase]} rounded-lg p-6 text-white shadow-lg`}>
        <h2 className="text-2xl font-bold">{phase}</h2>
        <p className="text-white/90 text-sm mt-1">{items.length} features</p>
      </div>

      <div className="space-y-4">
        {(['Done', 'In Progress', 'Planned'] as RoadmapStatus[]).map(
          (status) =>
            itemsByStatus[status].length > 0 && (
              <div key={status}>
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 px-1">
                  {status} ({itemsByStatus[status].length})
                </h3>
                <div className="space-y-3">
                  {itemsByStatus[status].map((item) => (
                    <RoadmapCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )
        )}
      </div>
    </div>
  );
}

export default function RoadmapPage() {
  useDocumentTitle({ pageTitle: 'Public Roadmap' });
  const phases = getRoadmapPhases();

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Navbar />
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-16">
        {/* Header Section */}
        <div className="mb-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">ILN Roadmap</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            See what&apos;s coming to Invoice Liquidity Network. Our roadmap is transparent,
            community-driven, and updated regularly.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-700">
                <strong>{roadmapItems.filter((i) => i.status === 'Done').length}</strong> Completed
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
              <Zap className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-blue-700">
                <strong>{roadmapItems.filter((i) => i.status === 'In Progress').length}</strong> In
                Progress
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <Clock className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-700">
                <strong>{roadmapItems.filter((i) => i.status === 'Planned').length}</strong> Planned
              </span>
            </div>
          </div>
        </div>

        {/* Roadmap Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {phases.map((phase) => (
            <PhaseColumn key={phase} phase={phase} items={getPhaseItems(phase)} />
          ))}
        </div>

        {/* Call to Action Section */}
        <div className="mt-20 bg-gradient-to-r from-primary/10 to-blue-100 rounded-2xl p-8 md:p-12 text-center border border-primary/20">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Want to contribute?</h2>
          <p className="text-gray-700 max-w-2xl mx-auto mb-6">
            ILN is open source and community-driven. Check out our GitHub repository and join the
            discussion on upcoming features.
          </p>
          <a
            href="https://github.com/Invoice-Liquidity-Network/ILN-Frontend"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
            View on GitHub
          </a>
        </div>
      </div>
    </main>
  );
}
