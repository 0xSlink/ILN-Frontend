export type GovernanceReadState =
  | { status: 'ready'; ledgerSequence: number; observedAt: string; stale: boolean }
  | { status: 'error'; message: string; observedAt: string };

export function governanceReadMetadata(sequence: number, observedAt = new Date().toISOString(), maxAgeMs = 30_000): GovernanceReadState {
  if (!Number.isInteger(sequence) || sequence < 0) return { status: 'error', message: 'Governance ledger sequence is unavailable.', observedAt };
  return { status: 'ready', ledgerSequence: sequence, observedAt, stale: Date.now() - Date.parse(observedAt) > maxAgeMs };
}

