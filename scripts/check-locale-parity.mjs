import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LOCALES_DIR = 'public/locales';
export const REFERENCE_LOCALE = 'en';

/**
 * Flattens a nested translation object into dot-separated leaf keys,
 * e.g. { nav: { home: 'Home' } } -> ['nav.home'].
 */
export function flattenKeys(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

/** Leaf keys missing from `candidate`, and keys it has that `reference` does not. */
export function compareKeySets(reference, candidate) {
  const referenceKeys = new Set(flattenKeys(reference));
  const candidateKeys = new Set(flattenKeys(candidate));
  return {
    missing: [...referenceKeys].filter((key) => !candidateKeys.has(key)).sort(),
    extra: [...candidateKeys].filter((key) => !referenceKeys.has(key)).sort(),
  };
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    // A missing namespace file means every key in it is missing.
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

/**
 * Compares every locale's translation files with the reference locale and
 * returns one entry per locale/namespace whose flattened key set differs.
 */
export function findLocaleDrift(
  root = process.cwd(),
  localesDir = LOCALES_DIR,
  referenceLocale = REFERENCE_LOCALE
) {
  const base = path.join(root, localesDir);
  const locales = readdirSync(base)
    .filter((entry) => statSync(path.join(base, entry)).isDirectory())
    .sort();
  const namespaces = readdirSync(path.join(base, referenceLocale))
    .filter((file) => file.endsWith('.json'))
    .sort();

  const drift = [];
  for (const locale of locales) {
    if (locale === referenceLocale) continue;
    for (const namespace of namespaces) {
      const reference = readJson(path.join(base, referenceLocale, namespace));
      const candidate = readJson(path.join(base, locale, namespace));
      const { missing, extra } = compareKeySets(reference, candidate);
      if (missing.length > 0 || extra.length > 0) {
        drift.push({ locale, namespace, missing, extra });
      }
    }
  }
  return drift;
}

function main() {
  const drift = findLocaleDrift();

  if (drift.length === 0) {
    console.log(`✨ Locale key parity check PASSED. Every locale mirrors ${REFERENCE_LOCALE}.\n`);
    return;
  }

  console.error('❌ Locale key parity check FAILED.\n');
  for (const { locale, namespace, missing, extra } of drift) {
    console.error(`  ${locale}/${namespace}:`);
    for (const key of missing) console.error(`    ✗ missing: ${key}`);
    for (const key of extra) console.error(`    ✗ not in ${REFERENCE_LOCALE}: ${key}`);
  }
  console.error(
    `\nEvery locale must match the keys in ${LOCALES_DIR}/${REFERENCE_LOCALE}. See docs/i18n.md.\n`
  );
  process.exit(1);
}

// Execute main if run directly
const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  try {
    main();
  } catch (err) {
    console.error('Fatal error running locale key parity check:', err);
    process.exit(1);
  }
}
