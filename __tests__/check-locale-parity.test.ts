import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { compareKeySets, findLocaleDrift, flattenKeys } from '../scripts/check-locale-parity.mjs';

describe('Locale key parity check', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function writeLocales(files: Record<string, unknown>): string {
    const root = mkdtempSync(path.join(tmpdir(), 'locales-'));
    tempDirs.push(root);
    for (const [file, contents] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), JSON.stringify(contents));
    }
    return root;
  }

  it('flattens nested translation keys', () => {
    const translations = { nav: { home: 'Home', links: { docs: 'Docs' } }, title: 'ILN' };
    expect(flattenKeys(translations)).toEqual(['nav.home', 'nav.links.docs', 'title']);
  });

  it('reports nested keys that are missing or extra, not just top-level ones', () => {
    const reference = { nav: { home: 'Home', about: 'About' } };
    const candidate = { nav: { home: 'Inicio', contact: 'Contacto' } };

    expect(compareKeySets(reference, candidate)).toEqual({
      missing: ['nav.about'],
      extra: ['nav.contact'],
    });
  });

  it('detects drift and a missing namespace file in a locales directory', () => {
    const root = writeLocales({
      'en/translation.json': { nav: { home: 'Home', about: 'About' } },
      'en/errors.json': { notFound: 'Not found' },
      'es/translation.json': { nav: { home: 'Inicio' } },
    });

    expect(findLocaleDrift(root, '.', 'en')).toEqual([
      { locale: 'es', namespace: 'errors.json', missing: ['notFound'], extra: [] },
      { locale: 'es', namespace: 'translation.json', missing: ['nav.about'], extra: [] },
    ]);
  });

  it('finds no drift between the shipped locales', () => {
    expect(findLocaleDrift()).toEqual([]);
  });
});
