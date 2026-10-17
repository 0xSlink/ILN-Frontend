import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const limitBytes = 500 * 1024;
const allowlistPath = '.large-file-allowlist';

function gitFiles(args) {
  const output = execFileSync('git', args, { encoding: 'utf8' });
  return output.split('\0').filter(Boolean);
}

function readAllowlist() {
  try {
    return readFileSync(resolve(allowlistPath), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  } catch {
    return [];
  }
}

function matchesAllowlist(file, patterns) {
  return patterns.some((pattern) => {
    const expression = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*|\*|\?/g, (token) => {
        if (token === '**') return '.*';
        if (token === '*') return '[^/]*';
        return '[^/]';
      });
    return new RegExp(`^${expression}$`).test(file);
  });
}

const stagedOnly = process.argv.includes('--staged');
const files = stagedOnly
  ? gitFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
  : gitFiles(['ls-files', '-z']);
const allowlist = readAllowlist();
const oversized = [];

for (const file of files) {
  const normalizedFile = file.replaceAll('\\', '/');
  let size;

  if (stagedOnly) {
    try {
      size = Number(
        execFileSync('git', ['cat-file', '-s', `:${normalizedFile}`], { encoding: 'utf8' }).trim()
      );
    } catch {
      continue;
    }
  } else {
    try {
      size = statSync(file).size;
    } catch {
      continue;
    }
  }

  if (size > limitBytes && !matchesAllowlist(normalizedFile, allowlist)) {
    oversized.push(`${(size / 1024).toFixed(1)} KB\t${normalizedFile}`);
  }
}

if (oversized.length > 0) {
  const scope = stagedOnly ? 'staged' : 'tracked';
  console.error(`Large ${scope} files exceed the 500 KB limit:`);
  console.error(oversized.join('\n'));
  console.error(
    `Add a narrowly justified path pattern to ${allowlistPath} only when the file cannot be optimized.`
  );
  process.exit(1);
}

console.log(`File-size check passed (${stagedOnly ? 'staged' : 'tracked'} files, 500 KB limit).`);
