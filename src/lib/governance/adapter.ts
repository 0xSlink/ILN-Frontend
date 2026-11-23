import { fetchProposal, fetchProposals, castVote, type Proposal, type VoteChoice } from '@/utils/governance';

export interface GovernanceContractAdapter {
  list(): Promise<Proposal[]>;
  get(id: number): Promise<Proposal | null>;
  vote(id: number, choice: VoteChoice, signer: string, sign: (xdr: string) => Promise<string>): Promise<string>;
}

export function createGovernanceContractAdapter(): GovernanceContractAdapter {
  return {
    list: () => fetchProposals(),
    get: (id) => fetchProposal(id),
    vote: (id, choice, signer, sign) => castVote(id, choice, signer, sign),
  };
}

