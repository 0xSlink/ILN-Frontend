'use client';

/**
 * Browser / OS / Wallet compatibility context (#794).
 *
 * Captures structured environment metadata on every error so the error-tracking
 * dashboard can segment error rates by these dimensions and catch
 * "works for me vs broken for a specific wallet version" regressions.
 */

export interface BrowserInfo {
  name: string;
  version: string | null;
  userAgent: string;
}

export interface OSInfo {
  name: string;
  version: string | null;
}

export interface WalletInfo {
  type: string | null;
  version: string | null;
  provider: string | null;
}

export interface CompatibilityContext {
  browser: BrowserInfo;
  os: OSInfo;
  wallet: WalletInfo;
  viewport: string | null;
  language: string | null;
}

/**
 * Parse a UA string into browser name + version. Keeps the implementation
 * dependency-free (no UA parser library) and testable with an injected UA.
 */
export function parseBrowser(ua: string): BrowserInfo {
  const fallback: BrowserInfo = { name: 'unknown', version: null, userAgent: ua };

  if (!ua) return fallback;

  // Order matters: Chrome also contains Safari, Edge also contains Chrome.
  const patterns: Array<{ name: string; regex: RegExp }> = [
    { name: 'Edge', regex: /Edg\/([\d.]+)/ },
    { name: 'Chrome', regex: /Chrome\/([\d.]+)/ },
    { name: 'Firefox', regex: /Firefox\/([\d.]+)/ },
    { name: 'Safari', regex: /Version\/([\d.]+).*Safari/ },
    { name: 'Opera', regex: /OPR\/([\d.]+)/ },
  ];

  for (const { name, regex } of patterns) {
    const m = ua.match(regex);
    if (m) return { name, version: m[1], userAgent: ua };
  }

  // Brave and other Chromium forks still report Chrome — keep as chrome family.
  if (/Safari\/[\d.]+/.test(ua)) return { name: 'Safari', version: null, userAgent: ua };

  return fallback;
}

export function parseOS(ua: string): OSInfo {
  if (!ua) return { name: 'unknown', version: null };

  if (/Windows NT 10/.test(ua)) return { name: 'Windows', version: '10' };
  if (/Windows NT 11/.test(ua)) return { name: 'Windows', version: '11' };
  if (/Windows NT/.test(ua)) {
    const m = ua.match(/Windows NT ([\d.]+)/);
    return { name: 'Windows', version: m?.[1] ?? null };
  }
  if (/Mac OS X ([\d_]+)/.test(ua)) {
    const m = ua.match(/Mac OS X ([\d_]+)/);
    return { name: 'macOS', version: m ? m[1].replace(/_/g, '.') : null };
  }
  if (/Android ([\d.]+)/.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/);
    return { name: 'Android', version: m?.[1] ?? null };
  }
  if (/iPhone|iPad/.test(ua)) {
    const m = ua.match(/OS ([\d_]+)/);
    return { name: 'iOS', version: m ? m[1].replace(/_/g, '.') : null };
  }
  if (/Linux/.test(ua)) return { name: 'Linux', version: null };
  if (/CrOS/.test(ua)) return { name: 'Chrome OS', version: null };

  return { name: 'unknown', version: null };
}

function getFreighterVersionSync(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // Freighter injects version in several places across releases.
    const w = window as unknown as Record<string, unknown>;
    const candidates: unknown[] = [
      (w.freighter as Record<string, unknown> | undefined)?.version,
      (w.stellar as Record<string, unknown> | undefined)?.freighterVersion,
      ((w.stellar as Record<string, unknown> | undefined)?.freighter as Record<string, unknown> | undefined)?.version,
      document.querySelector('meta[name="freighter-version"]')?.getAttribute('content'),
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
  } catch {
    // ignore
  }
  return null;
}

export function detectWallet(ua?: string): WalletInfo {
  if (typeof window === 'undefined') {
    return { type: null, version: null, provider: null };
  }

  // WalletConnect is selected via localStorage, not UA.
  try {
    const stored = window.localStorage?.getItem('iln_wallet_provider');
    if (stored === 'walletconnect') {
      return { type: 'walletconnect', version: null, provider: 'walletconnect' };
    }
    if (stored === 'freighter') {
      return { type: 'freighter', version: getFreighterVersionSync(), provider: 'freighter' };
    }
  } catch {
    // ignore storage errors
  }

  // Heuristic: if freighter API is present, assume freighter.
  const w = window as unknown as Record<string, unknown>;
  const hasFreighter =
    !!w.freighter ||
    !!(w.stellar as Record<string, unknown> | undefined)?.freighter ||
    typeof document !== 'undefined' && !!document.querySelector('[data-freighter]');

  if (hasFreighter) {
    return { type: 'freighter', version: getFreighterVersionSync(), provider: 'freighter' };
  }

  // Check walletConnect deep param presence
  const search = typeof window.location !== 'undefined' ? window.location.search : '';
  if (search.includes('wc:') || search.includes('walletconnect')) {
    return { type: 'walletconnect', version: null, provider: 'walletconnect' };
  }

  return { type: null, version: null, provider: null };
}

export function getCompatibilityContext(overrides?: {
  userAgent?: string;
  wallet?: WalletInfo;
}): CompatibilityContext {
  const ua =
    overrides?.userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : '');

  const browser = parseBrowser(ua);
  const os = parseOS(ua);
  const wallet = overrides?.wallet ?? detectWallet(ua);

  let viewport: string | null = null;
  if (typeof window !== 'undefined') {
    viewport = `${window.innerWidth}x${window.innerHeight}`;
  }

  let language: string | null = null;
  if (typeof navigator !== 'undefined') {
    language = navigator.language ?? null;
  }

  return { browser, os, wallet, viewport, language };
}

/**
 * Serialize compatibility context as flat tags suitable for Sentry / error
 * dashboard indexing (all values are strings).
 */
export function getCompatibilityTags(ctx: CompatibilityContext): Record<string, string> {
  return {
    'browser.name': ctx.browser.name,
    'browser.version': ctx.browser.version ?? 'unknown',
    'os.name': ctx.os.name,
    'os.version': ctx.os.version ?? 'unknown',
    'wallet.type': ctx.wallet.type ?? 'none',
    'wallet.version': ctx.wallet.version ?? 'unknown',
    'wallet.provider': ctx.wallet.provider ?? 'none',
  };
}
