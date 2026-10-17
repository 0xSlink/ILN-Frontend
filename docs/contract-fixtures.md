# Contract Test Fixtures Alignment Guide

This document describes how to keep frontend contract test fixtures in sync with the `ILN-Smart-Contract` backend.

## Overview

Frontend contract tests mock Soroban SDK responses to avoid blockchain dependencies. However, these mocks must accurately represent the actual contract's error codes and event schemas to catch real regressions.

## Fixture Locations

Frontend mocks are located in:

```
__tests__/contract/
├── soroban.test.ts
├── soroban-extended.test.ts
├── governance.test.ts
├── governance-extended.test.ts
├── contract-stats.test.ts
├── contract-stats-extended.test.ts
├── contract-events-extended.test.ts
└── contract-event-stream-state.test.ts
```

Smart Contract source of truth (once documented) will be in:

```
ILN-Smart-Contract/
├── docs/
│   ├── error-codes.md
│   ├── events.md
│   └── interface.md
└── src/
    ├── errors/
    ├── events/
    └── lib/
```

## Alignment Checklist

### 1. Error Codes

- [ ] Document all contract error codes with descriptions in `ILN-Smart-Contract/docs/error-codes.md`
- [ ] Cross-reference each mock error response in `__tests__/contract/*.test.ts`
- [ ] Add linking comments like:
  ```typescript
  // Error: INVOICE_NOT_FOUND
  // Source: ILN-Smart-Contract/src/errors/InvoiceError.ts:42
  const mockInvoiceNotFoundError = {
    status: 404,
    code: 'INVOICE_NOT_FOUND',
    message: 'Invoice does not exist',
  };
  ```

### 2. Event Schemas

- [ ] Document all contract events with their fields in `ILN-Smart-Contract/docs/events.md`
- [ ] Verify mock event objects in test files match documented schema
- [ ] Add linking comments to event fixtures

### 3. Type Alignment

- [ ] Generate TypeScript types from contract schema
- [ ] Ensure mock objects conform to generated types
- [ ] Update mocks when contract interface changes

## Common Drift Scenarios

| Scenario                          | Risk                                                   | Check                             |
| --------------------------------- | ------------------------------------------------------ | --------------------------------- |
| Contract adds new error code      | Test gap - frontend doesn't handle new error           | Cross-reference error codes list  |
| Contract changes event field type | Type mismatch - frontend tests pass but runtime breaks | Verify field types against schema |
| Contract renames error            | Misleading test failures                               | Maintain error code versioning    |
| Contract removes event field      | Frontend expects field that no longer exists           | Run fixture validation            |

## Validation Process

### Manual Review

1. Open `ILN-Smart-Contract/docs/error-codes.md` and `events.md`
2. Search `__tests__/contract/` for each documented error/event
3. Verify mock structure matches documentation
4. Add/update cross-reference comments

### Automated Validation (Future)

Once contract types are published to npm, add fixture validation:

```typescript
import { ContractErrorCode, ContractEvent } from '@iln/smart-contract-types';

// Type-check mocks at compile time
const mockError: ContractErrorCode = {
  code: 'INVOICE_NOT_FOUND', // Type-safe enum from contract
  message: 'Invoice does not exist',
};

const mockEvent: ContractEvent = {
  type: 'InvoiceLaunched', // Type-safe from contract
  data: { invoiceId: '123' },
};
```

### Current Automated Validation

The CI pipeline (`ci.yml` → `tsc --noEmit`) already validates that `__tests__/fixtures/invoices.ts` conforms to the `Invoice` type from `src/utils/soroban.ts`. If the contract adds or removes fields, the TypeScript compiler will fail the build, preventing stale fixtures from merging.

To add or update a fixture:

1. Update the `Invoice` type in `src/utils/soroban.ts` first (if the contract changed).
2. Update `__tests__/fixtures/invoices.ts` to match.
3. Run `pnpm exec tsc --noEmit` locally to verify the fixture compiles.

## Integration Workflow

1. **Pre-Release**: Contract team publishes error/event documentation
2. **Frontend Review**: Align fixtures against new documentation
3. **Comments Added**: Link each fixture to source of truth with URL
4. **Test Run**: Verify frontend tests still pass with current mocks
5. **Post-Release**: Re-check after contract deployment to catch any drift

## Contract Build Pinning

The repository tracks which contract build the test fixtures are aligned to through a version-controlled pin file at `contracts/contract-pin.json`. The CI workflow `contract-tests.yml` verifies this pin before running the contract integration suite.

### How the pin works

- `contracts/contract-pin.json` contains the `pinnedBuild` object with the targeted contract's version, build hash, and verification status.
- Until the smart-contract side reaches its storage-freeze milestone, the pin carries `status: "PENDING_STORAGE_FREEZE"` and a zero placeholder hash. The CI workflow warns but does not fail.
- Once storage-freeze is complete, update the pin with the real mainnet-candidate build SHA and set `status: "VERIFIED"`. From that point the workflow **fails** if the hash is still a placeholder.

### How to update the pin

When the smart-contract team publishes a new mainnet-candidate build:

1. Determine the build SHA (e.g. from the `ILN-Smart-Contract` repo's `git rev-parse HEAD` at the freeze commit).
2. Update `contracts/contract-pin.json`:
   - Set `pinnedBuild.hash` to the SHA.
   - Set `pinnedBuild.version` to the version tag (e.g. `1.0.0-rc1`).
   - Set `pinnedBuild.status` to `"VERIFIED"`.
   - Update `pinnedBuild.verifiedAt` to today's date.
3. Update any contract IDs in `contracts` and `tokens` sections if the deployment changed.
4. Run `pnpm run contract:pin:verify` locally to confirm the pin is valid.
5. If the contract interface changed, update the mock fixtures in `__tests__/contract/` and `src/mocks/fixtures/contract.ts` to match.

### Local verification

```bash
pnpm run contract:pin:verify
```

## Maintaining Alignment

- **On contract changes**: Update `ILN-Smart-Contract/docs/` first
- **On frontend test changes**: Verify mocks still match contract documentation
- **Monthly audit**: Run manual fixture validation (see section above)
- **Pre-deploy**: Smoke test with real contract if possible

## Resources

- [Stellar Contract SDK Documentation](https://developers.stellar.org/docs/smart-contracts)
- [RPC Event Specification](https://developers.stellar.org/docs/smart-contracts#events)
- Contract error handling patterns (to be documented in ILN-Smart-Contract repo)
