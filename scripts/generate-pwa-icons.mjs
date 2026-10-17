#!/usr/bin/env node
/**
 * scripts/generate-pwa-icons.mjs
 *
 * Regenerates every PWA/home-screen icon referenced by public/manifest.json
 * and app/layout.tsx from the single source of truth at
 * public/icons/icon-source.svg. Run this whenever the source SVG changes:
 *
 *   node scripts/generate-pwa-icons.mjs
 *
 * The source SVG is designed to be maskable-safe (see its own comments), so
 * every manifest icon size below is generated from it directly and used for
 * both purpose: "any" and purpose: "maskable" - see docs/pwa-manifest-audit.md
 * for the full rationale (#694).
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_SVG = join(ROOT, 'public/icons/icon-source.svg');
const ICONS_DIR = join(ROOT, 'public/icons');

/** Sizes referenced by public/manifest.json's icons array. */
const MANIFEST_ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

/** iOS home-screen icon: apple-touch-icon must fill the canvas (no transparency, no safe-zone margin - iOS applies its own rounding). */
const APPLE_TOUCH_ICON_SIZE = 180;

/** Windows pinned-tile icon referenced by public/icons/browserconfig.xml. */
const MS_TILE_SIZE = 150;

async function main() {
  mkdirSync(ICONS_DIR, { recursive: true });
  const svgBuffer = readFileSync(SOURCE_SVG);

  for (const size of MANIFEST_ICON_SIZES) {
    const outPath = join(ICONS_DIR, `icon-${size}x${size}.png`);
    await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
    console.error(`wrote ${outPath}`);
  }

  const appleTouchIconPath = join(ICONS_DIR, 'apple-touch-icon.png');
  await sharp(svgBuffer)
    .resize(APPLE_TOUCH_ICON_SIZE, APPLE_TOUCH_ICON_SIZE)
    .flatten({ background: '#3d627f' }) // no alpha channel - iOS ignores transparency and may render it oddly
    .png()
    .toFile(appleTouchIconPath);
  console.error(`wrote ${appleTouchIconPath}`);

  const tilePath = join(ICONS_DIR, `mstile-${MS_TILE_SIZE}x${MS_TILE_SIZE}.png`);
  await sharp(svgBuffer).resize(MS_TILE_SIZE, MS_TILE_SIZE).png().toFile(tilePath);
  console.error(`wrote ${tilePath}`);

  console.error('\nDone. Re-run this script after editing public/icons/icon-source.svg.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
