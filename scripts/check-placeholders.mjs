import fs from 'fs';
import path from 'path';

const searchDirs = ['docs'];
const additionalFiles = ['README.md'];
const allowlist = [
  // Add files to ignore here if they are genuinely-in-progress docs.
];

const patterns = [
  /\[TBD\]/gi,
  /\[To be filled.*?\]/gi,
  /\[To be added\]/gi,
  /\[PLACEHOLDER\]/gi,
];

let hasErrors = false;

function scanFile(filePath) {
  if (allowlist.includes(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        console.error(`Error: Found placeholder in ${filePath}:${index + 1}`);
        console.error(`  ${line.trim()}`);
        hasErrors = true;
      }
    }
  });
}

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (fullPath.endsWith('.md')) {
      scanFile(fullPath);
    }
  }
}

searchDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    scanDir(dir);
  }
});

additionalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    scanFile(file);
  }
});

if (hasErrors) {
  console.error('\nPlaceholder text found in public-facing docs. Please fill them with real values or add them to the allowlist in scripts/check-placeholders.mjs if they are genuinely in-progress.');
  process.exit(1);
} else {
  console.log('No unfilled placeholders found in public-facing docs.');
}
