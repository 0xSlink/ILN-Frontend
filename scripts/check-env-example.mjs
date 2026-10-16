import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_DIRS = ['app', 'src'];
const EXAMPLE_FILE = '.env.local.example';
const ALLOWLIST_FILE = '.env.local.example.allowlist';
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

function walk(dir) {
  const absolute = path.join(ROOT, dir);
  const entries = readdirSync(absolute);

  return entries.flatMap((entry) => {
    const fullPath = path.join(absolute, entry);
    const relativePath = path.relative(ROOT, fullPath);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return walk(relativePath);
    }

    if (!SOURCE_EXTENSIONS.has(path.extname(entry))) {
      return [];
    }

    return [relativePath];
  });
}

function readEnvNamesFromExample() {
  const content = readFileSync(path.join(ROOT, EXAMPLE_FILE), 'utf8');
  const names = new Set();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (match) names.add(match[1]);
  }

  return names;
}

function readAllowlist() {
  let content;
  try {
    content = readFileSync(path.join(ROOT, ALLOWLIST_FILE), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }

  return new Set(
    content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
  );
}

function readReferencedEnvNames() {
  const names = new Set();
  const directEnvReference =
    /(?:process|import\.meta)\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\])/g;

  for (const file of SOURCE_DIRS.flatMap(walk)) {
    const content = readFileSync(path.join(ROOT, file), 'utf8');

    for (const match of content.matchAll(directEnvReference)) {
      names.add(match[1] ?? match[2]);
    }
  }

  return names;
}

const documented = readEnvNamesFromExample();
const allowlisted = readAllowlist();
const referenced = readReferencedEnvNames();
const missing = [...referenced]
  .filter((name) => !documented.has(name) && !allowlisted.has(name))
  .sort();

if (missing.length > 0) {
  console.error(`${EXAMPLE_FILE} is missing env vars referenced by app/ or src/:`);
  for (const name of missing) {
    console.error(`- ${name}`);
  }
  console.error(
    `\nAdd public/config vars to ${EXAMPLE_FILE} or runtime-only exceptions to ${ALLOWLIST_FILE}.`
  );
  process.exit(1);
}

console.error(`${EXAMPLE_FILE} covers all direct app/ and src/ env references.`);
