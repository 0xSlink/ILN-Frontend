export type ContractErrorCode =
  | 'InvalidDiscountRate'
  | 'Unauthorized'
  | 'InvoiceNotFound'
  | 'InvoiceAlreadyPaid'
  | 'InvoiceExpired'
  | 'InvoiceCancelled'
  | 'InsufficientLiquidity'
  | 'InsufficientBalance'
  | 'ArithmeticOverflow'
  | 'TokenNotSupported'
  | 'ContractPaused'
  | 'InvalidInvoiceState'
  | 'FeeOnTransferToken';

export interface ContractErrorInfo {
  title: string;
  message: string;
  remediation?: string;
}

export const CONTRACT_ERROR_MAP: Record<ContractErrorCode, ContractErrorInfo> = {
  InvalidDiscountRate: {
    title: 'Invalid Discount Rate',
    message: 'The discount rate must be between 0.01% and 50%.',
    remediation: 'Adjust the discount rate and try again.',
  },
  Unauthorized: {
    title: 'Unauthorized Action',
    message: 'Your wallet is not authorized to perform this action.',
    remediation: 'Check if you are using the correct connected wallet account.',
  },
  InvoiceNotFound: {
    title: 'Invoice Not Found',
    message: 'The requested invoice could not be found on the network.',
    remediation: 'Verify the invoice ID and ensure it was created successfully.',
  },
  InvoiceAlreadyPaid: {
    title: 'Invoice Already Paid',
    message: 'This invoice has already been fully paid.',
    remediation: 'No further action is required for this invoice.',
  },
  InvoiceExpired: {
    title: 'Invoice Expired',
    message: 'This invoice has expired and can no longer be processed.',
    remediation: 'You may need to request a new invoice from the issuer.',
  },
  InvoiceCancelled: {
    title: 'Invoice Cancelled',
    message: 'This invoice was cancelled by the issuer.',
    remediation: 'Please contact the issuer for more details.',
  },
  InsufficientLiquidity: {
    title: 'Insufficient Liquidity',
    message: 'There is not enough liquidity available in the pool to complete this transaction.',
    remediation: 'Please try a smaller amount or wait for more liquidity to be added.',
  },
  InsufficientBalance: {
    title: 'Insufficient Balance',
    message: 'Your wallet does not have enough balance to cover the transaction.',
    remediation: 'Ensure you have enough funds, including necessary network fees.',
  },
  ArithmeticOverflow: {
    title: 'Calculation Error',
    message: 'A mathematical error occurred during the transaction.',
    remediation: 'Please review the transaction amounts and try again.',
  },
  TokenNotSupported: {
    title: 'Unsupported Token',
    message: 'The selected token asset is not supported by this contract.',
    remediation: 'Try using a different asset for this transaction.',
  },
  ContractPaused: {
    title: 'Contract Paused',
    message: 'The smart contract is currently paused for maintenance or security reasons.',
    remediation: 'Please try again later when the network resumes operations.',
  },
  InvalidInvoiceState: {
    title: 'Invalid Invoice State',
    message: 'The invoice is not in the correct state to perform this action.',
    remediation: 'Verify the current status of the invoice before proceeding.',
  },
  FeeOnTransferToken: {
    title: 'Unsupported Token Type',
    message:
      'This token implements fee-on-transfer and cannot be added to the ILN allowlist. Tokens must transfer the exact amount specified.',
    remediation: 'Choose a standard token that transfers the full amount without deducting a fee.',
  },
};

export const UNKNOWN_CONTRACT_ERROR: ContractErrorInfo = {
  title: 'Transaction Failed',
  message: 'The transaction could not be completed due to an unexpected error.',
  remediation: 'Please try again or contact support if the issue persists.',
};

const ERROR_CODE_KEYS = Object.keys(CONTRACT_ERROR_MAP) as ContractErrorCode[];

/**
 * Attempts to extract a known ContractErrorCode from a variety of error shapes.
 */
export function parseContractError(error: unknown): ContractErrorCode | null {
  if (!error) return null;

  // Gather strings to search in
  const representations: string[] = [];

  if (typeof error === 'string') {
    representations.push(error);
  } else if (error instanceof Error) {
    representations.push(error.message);
    representations.push(error.name);
  } else if (typeof error === 'object') {
    try {
      // In Soroban, errors sometimes come back as JSON payloads
      representations.push(JSON.stringify(error));

      const anyError = error as any;
      if (typeof anyError.message === 'string') representations.push(anyError.message);
      if (typeof anyError.error === 'string') representations.push(anyError.error);
    } catch {
      // Ignore stringify errors (e.g. circular refs)
    }
  }

  // Iterate over all possible error codes and see if they exist in any representation
  for (const code of ERROR_CODE_KEYS) {
    for (const rep of representations) {
      if (rep && rep.includes(code)) {
        return code;
      }
    }
  }

  return null;
}
