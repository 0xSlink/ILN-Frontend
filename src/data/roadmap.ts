export type RoadmapStatus = 'Planned' | 'In Progress' | 'Done';
export type RoadmapPhase = 'Testnet' | 'Mainnet' | 'Post-Launch';

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  phase: RoadmapPhase;
  status: RoadmapStatus;
  issueUrl?: string;
  estimatedDate?: string;
}

export const roadmapItems: RoadmapItem[] = [
  // Testnet Phase
  {
    id: 'testnet-1',
    title: 'Invoice Factoring MVP',
    description: 'Core invoice submission, funding, and settlement functionality',
    phase: 'Testnet',
    status: 'Done',
  },
  {
    id: 'testnet-2',
    title: 'Reputation System',
    description: 'On-chain reputation tracking and gating mechanisms',
    phase: 'Testnet',
    status: 'Done',
  },
  {
    id: 'testnet-3',
    title: 'Liquidity Provider Staking',
    description: 'LP token staking and yield distribution mechanisms',
    phase: 'Testnet',
    status: 'Done',
  },
  {
    id: 'testnet-4',
    title: 'Insurance Pool Integration',
    description: 'Risk mitigation through community-funded insurance pool',
    phase: 'Testnet',
    status: 'Done',
  },
  {
    id: 'testnet-5',
    title: 'Governance Framework',
    description: 'On-chain governance for protocol parameter updates',
    phase: 'Testnet',
    status: 'Done',
  },
  {
    id: 'testnet-6',
    title: 'Advanced Analytics Dashboard',
    description: 'Comprehensive protocol and personal yield analytics',
    phase: 'Testnet',
    status: 'Done',
  },

  // Mainnet Phase
  {
    id: 'mainnet-1',
    title: 'Mainnet Launch',
    description: 'Full deployment on Stellar mainnet with live trading',
    phase: 'Mainnet',
    status: 'Done',
  },
  {
    id: 'mainnet-2',
    title: 'Multi-Currency Support',
    description: 'Support for USDC, EURC, and other Stellar-native assets',
    phase: 'Mainnet',
    status: 'In Progress',
    estimatedDate: 'Q2 2026',
    issueUrl: 'https://github.com/Invoice-Liquidity-Network/ILN-Frontend/issues',
  },
  {
    id: 'mainnet-3',
    title: 'Mobile App Beta',
    description: 'Native iOS and Android applications for invoice management',
    phase: 'Mainnet',
    status: 'Planned',
    estimatedDate: 'Q3 2026',
  },
  {
    id: 'mainnet-4',
    title: 'Partial Payment Support',
    description: 'Enable payers to make installment payments on invoices',
    phase: 'Mainnet',
    status: 'Done',
  },
  {
    id: 'mainnet-5',
    title: 'Dispute Resolution System',
    description: 'Decentralized arbitration for payment disputes',
    phase: 'Mainnet',
    status: 'In Progress',
    estimatedDate: 'Q2 2026',
    issueUrl: 'https://github.com/Invoice-Liquidity-Network/ILN-Frontend/issues',
  },
  {
    id: 'mainnet-6',
    title: 'Enhanced Yield Optimization',
    description: 'Automated portfolio rebalancing and risk-adjusted returns',
    phase: 'Mainnet',
    status: 'Planned',
    estimatedDate: 'Q3 2026',
  },

  // Post-Launch Phase
  {
    id: 'postlaunch-1',
    title: 'Cross-Chain Bridge Integration',
    description: 'Bridge to Ethereum and other blockchains for expanded reach',
    phase: 'Post-Launch',
    status: 'Planned',
    estimatedDate: 'Q4 2026',
  },
  {
    id: 'postlaunch-2',
    title: 'Institutional Grade Custody',
    description: 'Qualified custodian partnerships for enterprise users',
    phase: 'Post-Launch',
    status: 'Planned',
    estimatedDate: 'Q4 2026',
  },
  {
    id: 'postlaunch-3',
    title: 'Advanced Risk Modeling',
    description: 'ML-powered credit scoring and risk assessment',
    phase: 'Post-Launch',
    status: 'Planned',
  },
  {
    id: 'postlaunch-4',
    title: 'Regulatory Compliance Suite',
    description: 'Built-in compliance reporting for global markets',
    phase: 'Post-Launch',
    status: 'Planned',
  },
  {
    id: 'postlaunch-5',
    title: 'API and Integration Hub',
    description: 'REST APIs for third-party integrations; GraphQL deferred until after mainnet',
    phase: 'Post-Launch',
    status: 'Planned',
  },
  {
    id: 'postlaunch-6',
    title: 'DAO Treasury Management',
    description: 'Advanced tools for protocol treasury and fund allocation',
    phase: 'Post-Launch',
    status: 'Planned',
  },
];

export const getRoadmapPhases = (): RoadmapPhase[] => {
  return ['Testnet', 'Mainnet', 'Post-Launch'];
};

export const getPhaseItems = (phase: RoadmapPhase): RoadmapItem[] => {
  return roadmapItems.filter((item) => item.phase === phase);
};

export const getInProgressItems = (): RoadmapItem[] => {
  return roadmapItems.filter((item) => item.status === 'In Progress');
};
