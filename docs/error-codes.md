# Frontend contract error code reference

This document is the frontend-side reference for Soroban contract errors that the UI maps to user-facing messages. The mapping lives in [src/lib/contract/errors.ts](../src/lib/contract/errors.ts) and is used by [src/hooks/useTransaction.tsx](../src/hooks/useTransaction.tsx) when a transaction fails.

For the contract-side reference in the smart-contract repository, see the upstream error documentation in the ILN Contracts repo: https://github.com/Invoice-Liquidity-Network/ILN-Contracts/blob/main/docs/error-codes.md

## Error map

| Contract error code     | User-facing title      | User-facing message                                                               | Remediation                                                         |
| ----------------------- | ---------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `InvalidDiscountRate`   | Invalid Discount Rate  | The discount rate must be between 0.01% and 50%.                                  | Adjust the discount rate and try again.                             |
| `Unauthorized`          | Unauthorized Action    | Your wallet is not authorized to perform this action.                             | Check if you are using the correct connected wallet account.        |
| `InvoiceNotFound`       | Invoice Not Found      | The requested invoice could not be found on the network.                          | Verify the invoice ID and ensure it was created successfully.       |
| `InvoiceAlreadyPaid`    | Invoice Already Paid   | This invoice has already been fully paid.                                         | No further action is required for this invoice.                     |
| `InvoiceExpired`        | Invoice Expired        | This invoice has expired and can no longer be processed.                          | You may need to request a new invoice from the issuer.              |
| `InvoiceCancelled`      | Invoice Cancelled      | This invoice was cancelled by the issuer.                                         | Please contact the issuer for more details.                         |
| `InsufficientLiquidity` | Insufficient Liquidity | There is not enough liquidity available in the pool to complete this transaction. | Please try a smaller amount or wait for more liquidity to be added. |
| `InsufficientBalance`   | Insufficient Balance   | Your wallet does not have enough balance to cover the transaction.                | Ensure you have enough funds, including necessary network fees.     |
| `ArithmeticOverflow`    | Calculation Error      | A mathematical error occurred during the transaction.                             | Please review the transaction amounts and try again.                |
| `TokenNotSupported`     | Unsupported Token      | The selected token asset is not supported by this contract.                       | Try using a different asset for this transaction.                   |
| `ContractPaused`        | Contract Paused        | The smart contract is currently paused for maintenance or security reasons.       | Please try again later when the network resumes operations.         |
| `InvalidInvoiceState`   | Invalid Invoice State  | The invoice is not in the correct state to perform this action.                   | Verify the current status of the invoice before proceeding.         |

## Unknown/error fallback

When the UI cannot match an incoming error to a known contract code, it falls back to the generic message below:

- Title: Transaction Failed
- Message: The transaction could not be completed due to an unexpected error.
- Remediation: Please try again or contact support if the issue persists.
