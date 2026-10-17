#!/usr/bin/env node
/**
 * Verifies that the tracked contract build pin (contracts/contract-pin.json)
 * is present and well-formed. CI (contract-tests.yml) runs this before the
 * contract integration suite so the mocked-SDK fixtures can never silently
 * drift from the build that is actually being targeted.
 *
 * Pin lifecycle:
 *  - Until the smart-contract side reaches its storage-freeze milestone the
 *    pin carries `status: "PENDING_STORAGE_FREEZE"` and a zero placeholder
 *    hash. The workflow passes (with a loud warning) so CI stays green.
 *  - Once storage-freeze lands, update the pin with the real mainnet-candidate
 *    build hash/version and `status: "VERIFIED"`. From that point the pin MUST
 *    carry a non-placeholder hash or the workflow fails.
 *
 * Exit codes:
 *   0 – pin is valid (may warn while the storage-freeze milestone is pending)
 *   1 – pin is missing, malformed, or placeholder while claiming to be verified
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pinPath = path.join(root, 'contracts', 'contract-pin.json');
const relPinPath = path.relative(root, pinPath);

function fail(message) {
  console.error(`ERROR: ${message}`);
  console.error(
    'If the deployed entry points or argument types may have drifted, follow docs/cross-repo-incident-coordination.md#contract-abi-drift.'
  );
  process.exit(1);
}

function main() {
  if (!fs.existsSync(pinPath)) {
    fail(`Missing contract build pin file: ${relPinPath}`);
  }

  let pin;
  try {
    pin = JSON.parse(fs.readFileSync(pinPath, 'utf8'));
  } catch (err) {
    fail(`Could not parse ${relPinPath}: ${err.message}`);
  }

  if (!pin || typeof pin !== 'object' || typeof pin.pinnedBuild !== 'object') {
    fail(`${relPinPath} is missing the top-level "pinnedBuild" object`);
  }

  const build = pin.pinnedBuild;
  const hash = typeof build.hash === 'string' ? build.hash.trim() : '';
  const version = typeof build.version === 'string' ? build.version.trim() : '';
  const status = typeof build.status === 'string' ? build.status.trim() : '';
  const isPlaceholder = !hash || /^0+$/.test(hash);

  if (!version) {
    fail('pinnedBuild.version is missing. Set it to the pinned contract version/tag.');
  }

  const requiredContracts = ['invoice', 'governance', 'ilnToken'];
  for (const key of requiredContracts) {
    const value = pin.contracts?.[key];
    if (typeof value !== 'string' || value.trim() === '') {
      fail(`contracts.${key} is missing from ${relPinPath}.`);
    }
  }

  if (status === 'PENDING_STORAGE_FREEZE' || status === 'UNVERIFIED') {
    if (!isPlaceholder) {
      console.warn(`Contract build pin OK: ${version} (${hash.slice(0, 12)}\u2026) [${status}]`);
    } else {
      console.warn(
        `WARN: pin status is "${status}" with a placeholder hash. The workflow is not yet ` +
          'provably testing against the final mainnet-candidate build — update ' +
          'contracts/contract-pin.json once the smart-contract storage-freeze milestone ' +
          'lands (see docs/contract-fixtures.md → Contract build pinning).'
      );
    }
    return;
  }

  // Any non-pending status claims to be a real pin — it must not be a placeholder.
  if (isPlaceholder) {
    fail(
      `pinnedBuild.status is "${status}" but the hash is empty/zero. Set the real ` +
        'mainnet-candidate build hash and version in contracts/contract-pin.json.'
    );
  }

  console.warn(`Contract build pin OK: ${version} (${hash.slice(0, 12)}\u2026) [${status}]`);
}

main();
