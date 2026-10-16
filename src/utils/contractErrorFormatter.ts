export interface ContractErrorResult {
  code: string;
  message: string;
  userFriendlyMessage: string;
  originalError: unknown;
}

/**
 * Standardized error handling and formatting utility for Soroban smart contract interactions.
 */
export function formatContractError(error: unknown): ContractErrorResult {
  if (!error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      userFriendlyMessage: 'An unexpected error occurred. Please try again.',
      originalError: error,
    };
  }

  const message = error instanceof Error ? error.message : String(error);

  if (/user rejected|user denied|declined/i.test(message)) {
    return {
      code: 'USER_REJECTED',
      message,
      userFriendlyMessage: 'Transaction signature was rejected in your wallet.',
      originalError: error,
    };
  }

  if (/insufficient balance|exceeds balance|low balance/i.test(message)) {
    return {
      code: 'INSUFFICIENT_FUNDS',
      message,
      userFriendlyMessage: 'Insufficient balance to complete the contract operation.',
      originalError: error,
    };
  }

  if (/HostError|Simulation|TransactionSimulationFailed/i.test(message)) {
    return {
      code: 'SIMULATION_FAILED',
      message,
      userFriendlyMessage: 'Contract simulation failed. Please check transaction parameters.',
      originalError: error,
    };
  }

  if (/timeout|expired|deadline/i.test(message)) {
    return {
      code: 'TRANSACTION_TIMEOUT',
      message,
      userFriendlyMessage: 'Transaction timed out while waiting for network confirmation.',
      originalError: error,
    };
  }

  return {
    code: 'CONTRACT_EXECUTION_ERROR',
    message,
    userFriendlyMessage: message || 'Contract operation failed.',
    originalError: error,
  };
}
