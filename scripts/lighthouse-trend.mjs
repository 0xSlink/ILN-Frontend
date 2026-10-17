#!/usr/bin/env node
/**
 * Lighthouse CI trend checker (#795).
 *
 * Compares the current `assert` results against historical medians and emits
 * a soft-warning (distinct from the hard-fail gate in `.lighthouserc.json`)
 * when a meaningful downward trend is detected even while still passing the
 * absolute gate.
 *
 * Inputs:
 *   - Current results: `.lighthouseci/manifest.json` + `.lighthouseci/*.json`
 *     produced by `lhci autorun` (filesystem target).
 *   - Historical baseline: `.lighthouseci-history/trend-history.json` if present,
 *     otherwise falls back to `lhci-trend-history` cache restored by the workflow.
 *     When no history exists, the current run becomes the baseline without warning.
 *
 * Soft-warning thresholds (configurable via env):
 *   LHCI_TREND_PERF_DELTA        = 0.05  (performance score drop >5 points)
 *   LHCI_TREND_LCP_DELTA_MS      = 250   (LCP regression >250ms)
 *   LHCI_TREND_CLS_DELTA         = 0.02  (CLS regression >0.02)
 *   LHCI_TREND_TBT_DELTA_MS      = 50    (TBT regression >50ms)
 *   LHCI_TREND_WINDOW            = 5     (median window size)
 *
 * Output:
 *   - Console summary with ⚠️ soft warnings.
 *   - Writes `.lighthouseci/trend-report.json` and `.lighthouseci/trend-report.md`
 *     for upload as a trend artifact and PR comment.
 *   - Exits 0 on soft warning (does NOT fail CI), exits 1 only if `--strict` and
 *     a soft warning is present (opt-in to gate on trends later).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const PERF_DELTA = parseFloat(process.env.LHCI_TREND_PERF_DELTA ?? '0.05');
const LCP_DELTA = parseFloat(process.env.LHCI_TREND_LCP_DELTA_MS ?? '250');
const CLS_DELTA = parseFloat(process.env.LHCI_TREND_CLS_DELTA ?? '0.02');
const TBT_DELTA = parseFloat(process.env.LHCI_TREND_TBT_DELTA_MS ?? '50');
const WINDOW = parseInt(process.env.LHCI_TREND_WINDOW ?? '5', 10);

const HISTORY_PATH = '.lighthouseci-history/trend-history.json';
const MANIFEST_PATH = '.lighthouseci/manifest.json';

// Helpers ------------------------------------------------------------------

function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function collectCurrentMetrics() {
  const manifest = readJson(MANIFEST_PATH);
  if (!manifest) {
    console.warn('[lighthouse-trend] No manifest at', MANIFEST_PATH, '— skipping trend check.');
    return null;
  }

  // manifest is an array of { url, jsonPath, ... }
  const entries = Array.isArray(manifest) ? manifest : [];
  const urlGroups = {};

  for (const entry of entries) {
    const p = entry.jsonPath;
    if (!p || !existsSync(p)) continue;
    const lhr = readJson(p);
    if (!lhr) continue;

    const url = entry.url ?? lhr.finalDisplayedUrl ?? 'unknown';
    if (!urlGroups[url]) urlGroups[url] = [];

    // LH JSON shape: lhr.categories.performance.score (0-1), audits.*
    const cats = lhr.categories ?? {};
    const audits = lhr.audits ?? {};

    urlGroups[url].push({
      performance: cats.performance?.score ?? null,
      accessibility: cats.accessibility?.score ?? null,
      'best-practices': cats['best-practices']?.score ?? null,
      seo: cats.seo?.score ?? null,
      lcp: audits['largest-contentful-paint']?.numericValue ?? null,
      cls: audits['cumulative-layout-shift']?.numericValue ?? null,
      tbt: audits['total-blocking-time']?.numericValue ?? null,
      fcp: audits['first-contentful-paint']?.numericValue ?? null,
      tti: audits['interactive']?.numericValue ?? null,
    });
  }

  // Average across numberOfRuns per URL
  const current = {};
  for (const [url, runs] of Object.entries(urlGroups)) {
    current[url] = {
      performance: median(runs.map((r) => r.performance).filter((v) => v != null)),
      accessibility: median(runs.map((r) => r.accessibility).filter((v) => v != null)),
      'best-practices': median(runs.map((r) => r['best-practices']).filter((v) => v != null)),
      seo: median(runs.map((r) => r.seo).filter((v) => v != null)),
      lcp: median(runs.map((r) => r.lcp).filter((v) => v != null)),
      cls: median(runs.map((r) => r.cls).filter((v) => v != null)),
      tbt: median(runs.map((r) => r.tbt).filter((v) => v != null)),
      fcp: median(runs.map((r) => r.fcp).filter((v) => v != null)),
      tti: median(runs.map((r) => r.tti).filter((v) => v != null)),
      runs: runs.length,
    };
  }

  return { urlGroups: current, rawCount: entries.length };
}

function loadHistory() {
  if (!existsSync(HISTORY_PATH)) return null;
  const data = readJson(HISTORY_PATH);
  if (!data || !Array.isArray(data.entries)) return null;
  return data;
}

function computeBaseline(history, currentUrls) {
  if (!history) return null;

  const baseline = {};
  for (const url of currentUrls) {
    const relevant = history.entries
      .filter((e) => e.url === url)
      .slice(-WINDOW)
      .map((e) => e.metrics);

    if (!relevant.length) continue;

    baseline[url] = {
      performance: median(relevant.map((m) => m.performance).filter((v) => v != null)),
      lcp: median(relevant.map((m) => m.lcp).filter((v) => v != null)),
      cls: median(relevant.map((m) => m.cls).filter((v) => v != null)),
      tbt: median(relevant.map((m) => m.tbt).filter((v) => v != null)),
      window: relevant.length,
    };
  }
  return baseline;
}

// Main ---------------------------------------------------------------------

const currentData = collectCurrentMetrics();

if (!currentData) {
  process.exit(0);
}

const urls = Object.keys(currentData.urlGroups);
console.log(`[lighthouse-trend] Current run: ${currentData.rawCount} reports across ${urls.length} URL(s)`);

const history = loadHistory();
const baseline = computeBaseline(history, urls);

const warnings = [];
const rows = [];

for (const url of urls) {
  const cur = currentData.urlGroups[url];
  const base = baseline?.[url] ?? null;

  const row = {
    url,
    current: cur,
    baseline: base,
    warnings: [],
  };

  if (!base) {
    row.note = 'no baseline (first run or history miss)';
    rows.push(row);
    continue;
  }

  // Performance score regression (higher is better)
  if (cur.performance != null && base.performance != null) {
    const delta = cur.performance - base.performance;
    if (delta < -PERF_DELTA) {
      const msg = `Performance score regressed by ${(delta * 100).toFixed(1)}pts (${(base.performance * 100).toFixed(0)} → ${(cur.performance * 100).toFixed(0)})`;
      row.warnings.push({ metric: 'categories:performance', delta, message: msg, severity: 'soft-warning' });
      warnings.push({ url, ...row.warnings[row.warnings.length - 1] });
    }
  }

  // LCP regression (lower is better) — ms
  if (cur.lcp != null && base.lcp != null) {
    const delta = cur.lcp - base.lcp;
    if (delta > LCP_DELTA) {
      const msg = `LCP regressed by ${delta.toFixed(0)}ms (${base.lcp.toFixed(0)} → ${cur.lcp.toFixed(0)}ms)`;
      row.warnings.push({ metric: 'largest-contentful-paint', delta, message: msg, severity: 'soft-warning' });
      warnings.push({ url, ...row.warnings[row.warnings.length - 1] });
    }
  }

  // CLS regression (lower is better)
  if (cur.cls != null && base.cls != null) {
    const delta = cur.cls - base.cls;
    if (delta > CLS_DELTA) {
      const msg = `CLS regressed by ${delta.toFixed(3)} (${base.cls.toFixed(3)} → ${cur.cls.toFixed(3)})`;
      row.warnings.push({ metric: 'cumulative-layout-shift', delta, message: msg, severity: 'soft-warning' });
      warnings.push({ url, ...row.warnings[row.warnings.length - 1] });
    }
  }

  // TBT regression
  if (cur.tbt != null && base.tbt != null) {
    const delta = cur.tbt - base.tbt;
    if (delta > TBT_DELTA) {
      const msg = `Total Blocking Time regressed by ${delta.toFixed(0)}ms (${base.tbt.toFixed(0)} → ${cur.tbt.toFixed(0)}ms)`;
      row.warnings.push({ metric: 'total-blocking-time', delta, message: msg, severity: 'soft-warning' });
      warnings.push({ url, ...row.warnings[row.warnings.length - 1] });
    }
  }

  rows.push(row);
}

// Console output
if (warnings.length === 0) {
  console.log('[lighthouse-trend] ✅ No soft-warning trend regressions detected.');
  if (!baseline) console.log('[lighthouse-trend] (No baseline — history will be seeded from this run)');
} else {
  console.warn(`[lighthouse-trend] ⚠️  ${warnings.length} soft-warning trend regression(s) detected (still passing hard gate):`);
  for (const w of warnings) {
    console.warn(`  - [${w.metric}] ${w.url}: ${w.message}`);
  }
  console.warn('[lighthouse-trend] These are soft warnings — CI will not fail. Review the trend report artifact.');
}

// Persist trend report for artifact upload
const report = {
  generatedAt: new Date().toISOString(),
  thresholds: { PERF_DELTA, LCP_DELTA, CLS_DELTA, TBT_DELTA, WINDOW },
  historyEntries: history?.entries?.length ?? 0,
  currentUrls: urls,
  warnings,
  rows,
};

try {
  const outJson = '.lighthouseci/trend-report.json';
  const dir = '.lighthouseci';
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(outJson, JSON.stringify(report, null, 2));

  // Simple markdown for PR comment / artifact preview
  let md = `# Lighthouse Trend Report\n\n`;
  md += `Generated: ${report.generatedAt}\n\n`;
  md += `Historical entries: ${report.historyEntries} | Window: ${WINDOW} | Thresholds: perfDelta=${PERF_DELTA}, lcpDelta=${LCP_DELTA}ms, clsDelta=${CLS_DELTA}, tbtDelta=${TBT_DELTA}ms\n\n`;
  if (warnings.length === 0) {
    md += `✅ **No soft-warning regressions** — performance is stable vs recent median.\n\n`;
  } else {
    md += `⚠️ **${warnings.length} soft-warning regression(s)** — still passing the hard gate but trending downward:\n\n`;
    for (const w of warnings) md += `- **${w.metric}** \`${w.url}\`: ${w.message}\n`;
    md += `\n`;
  }
  md += `## Per-URL snapshot\n\n`;
  md += `| URL | Perf | LCP | CLS | TBT | Warnings |\n`;
  md += `|-----|------|-----|-----|-----|----------|\n`;
  for (const r of rows) {
    const cur = r.current;
    const warnStr = r.warnings.length ? r.warnings.map((w) => w.metric).join(', ') : '—';
    md += `| ${r.url} | ${cur.performance != null ? (cur.performance * 100).toFixed(0) : '—'} | ${cur.lcp != null ? cur.lcp.toFixed(0) + 'ms' : '—'} | ${cur.cls != null ? cur.cls.toFixed(3) : '—'} | ${cur.tbt != null ? cur.tbt.toFixed(0) + 'ms' : '—'} | ${warnStr} |\n`;
  }
  if (!baseline) md += `\n> No baseline found (first run). This run will seed \`.lighthouseci-history/trend-history.json\` for future comparisons.\n`;
  md += `\n---\n_See \`trend-report.json\` for full structured data. Hard-fail gates remain in \`.lighthouserc.json\`.\n`;

  writeFileSync('.lighthouseci/trend-report.md', md);
  console.log('[lighthouse-trend] Wrote .lighthouseci/trend-report.json and .lighthouseci/trend-report.md');
} catch (e) {
  console.warn('[lighthouse-trend] Failed to write trend report', e);
}

// Update history store for next run (append current medians)
try {
  const historyDir = '.lighthouseci-history';
  if (!existsSync(historyDir)) mkdirSync(historyDir, { recursive: true });

  const now = new Date().toISOString();
  const branch = process.env.GITHUB_REF_NAME ?? process.env.GITHUB_HEAD_REF ?? 'local';
  const sha = process.env.GITHUB_SHA ?? 'local';

  // Preserve existing entries, cap to 100 per URL to avoid unbounded growth
  const MAX_PER_URL = 100;
  const nextEntries = [...(history?.entries ?? [])];

  for (const [url, metrics] of Object.entries(currentData.urlGroups)) {
    nextEntries.push({
      timestamp: now,
      url,
      branch,
      sha: sha.slice(0, 7),
      metrics: {
        performance: metrics.performance,
        accessibility: metrics.accessibility,
        'best-practices': metrics['best-practices'],
        seo: metrics.seo,
        lcp: metrics.lcp,
        cls: metrics.cls,
        tbt: metrics.tbt,
        fcp: metrics.fcp,
        tti: metrics.tti,
      },
    });
  }

  // Trim per URL
  const byUrl = {};
  for (const e of nextEntries) {
    if (!byUrl[e.url]) byUrl[e.url] = [];
    byUrl[e.url].push(e);
  }
  const trimmed = [];
  for (const list of Object.values(byUrl)) {
    trimmed.push(...list.slice(-MAX_PER_URL));
  }
  // Sort chronologically
  trimmed.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  writeFileSync(HISTORY_PATH, JSON.stringify({ entries: trimmed, updatedAt: now }, null, 2));
  console.log(`[lighthouse-trend] Updated history at ${HISTORY_PATH} (${trimmed.length} total entries)`);

  // Also write a simple CSV for trend view (easy to chart in CI or locally)
  const csvPath = join(historyDir, 'trend-history.csv');
  const header = 'timestamp,url,branch,sha,performance,accessibility,best-practices,seo,lcp,cls,tbt,fcp,tti\n';
  const rows_csv = trimmed
    .map(
      (e) =>
        `${e.timestamp},${e.url},${e.branch},${e.sha},${e.metrics.performance ?? ''},${e.metrics.accessibility ?? ''},${e.metrics['best-practices'] ?? ''},${e.metrics.seo ?? ''},${e.metrics.lcp ?? ''},${e.metrics.cls ?? ''},${e.metrics.tbt ?? ''},${e.metrics.fcp ?? ''},${e.metrics.tti ?? ''}`
    )
    .join('\n');
  writeFileSync(csvPath, header + rows_csv);
} catch (e) {
  console.warn('[lighthouse-trend] Failed to update history store', e);
}

// Soft warnings do not fail CI by default. Use --strict to gate on them.
if (warnings.length > 0 && process.argv.includes('--strict')) {
  console.error('[lighthouse-trend] --strict: failing CI due to soft-warning regression');
  process.exit(1);
}

process.exit(0);
