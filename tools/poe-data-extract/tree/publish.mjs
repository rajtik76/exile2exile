// Publishes the tree extract into the app: data.json + the four renderer atlases +
// centre art, into public/tree/current/. The renderer loads webp, so the extractor's
// PNG output is re-encoded with `sharp` (prebuilt binaries on macOS + CI Linux). This
// is the consumer-side publish step: it consumes `@poe2-tree/extractor`'s
// output (out/tree/), it is not part of extraction.
//
// Usage: node tree/publish.mjs   (after the extractor wrote out/tree/)

import { mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const OUT = new URL('../out/tree/', import.meta.url);
const PUBLIC = new URL('../../../public/tree/current/', import.meta.url);
const ASSETS = new URL('assets/', PUBLIC);
const CENTRE = new URL('assets/centre/', PUBLIC);
mkdirSync(fileURLToPath(ASSETS), { recursive: true });
mkdirSync(fileURLToPath(CENTRE), { recursive: true });

// Every atlas is drawn scaled down on screen, so near-lossless alpha and high colour
// quality are wasted bytes. Compress per atlas to what each needs: the soft mastery
// glows tolerate aggressive quality, the coloured icons stay crispest. `effort: 6` is
// sharp's slowest, smallest encode. Pixel dimensions are never changed, so the frame-map
// JSONs (and the renderer's source rects) stay valid.
const pngToWebp = (pngPath, webpPath, quality = 80) =>
  sharp(pngPath).webp({ quality, alphaQuality: quality, effort: 6 }).toFile(webpPath);

// 1) data.json
copyFileSync(fileURLToPath(new URL('data.json', OUT)), fileURLToPath(new URL('data.json', PUBLIC)));
console.log('data.json published');

// 2) the three node atlases: PNG -> webp, + their frame-map JSON. Quality per atlas:
// the mastery glows are soft (q62), the live icons stay sharp (q72), the thin frame
// keeps detail (q80). Unallocated nodes reuse the sharp icons dimmed at render time,
// so there is no separate disabled atlas.
const ATLASES = [
  { name: 'skills', quality: 72 },
  { name: 'frame', quality: 80 },
  { name: 'mastery-effect-active', quality: 62 },
];
for (const { name, quality } of ATLASES) {
  await pngToWebp(fileURLToPath(new URL(`assets/${name}.png`, OUT)), fileURLToPath(new URL(`${name}.webp`, ASSETS)), quality);
  copyFileSync(fileURLToPath(new URL(`assets/${name}.json`, OUT)), fileURLToPath(new URL(`${name}.json`, ASSETS)));
  console.log(`atlas ${name} -> webp (q${quality})`);
}

// 3) centre art: per-class + per-ascendancy portraits + the two ring sprites
const centreDir = fileURLToPath(new URL('centre/', OUT));
let centre = 0;
for (const file of readdirSync(centreDir)) {
  if (!file.endsWith('.png')) { continue; }
  await pngToWebp(`${centreDir}${file}`, fileURLToPath(new URL(file.replace(/\.png$/, '.webp'), CENTRE)));
  centre += 1;
}
console.log(`centre art: ${centre} -> webp`);

// 4) content stamp. Hash everything just published into version.json. The app
// reads it (via a <meta> tag) and appends ?v=<hash> to every tree asset URL, so
// a data refresh busts the browser cache while unchanged data keeps the long
// immutable cache served from the version-less /tree/current path. The hash is
// order-stable and excludes the stamp file itself.
const publicDir = fileURLToPath(PUBLIC);
const stampHash = createHash('sha256');
for (const rel of readdirSync(publicDir, { recursive: true }).sort()) {
  if (rel === 'version.json') { continue; }
  const abs = `${publicDir}${rel}`;
  if (!statSync(abs).isFile()) { continue; }
  stampHash.update(rel);
  stampHash.update(readFileSync(abs));
}
const version = stampHash.digest('hex').slice(0, 12);
// Stamp the patch the data was built from alongside the content hash, so the app can
// show which game version its committed data is on. The patch is the caller's (the
// workflow's PATCH env, originally the app's detected version) - this stamp proves the
// export completed for that version.
const patch = process.env.PATCH;
if (!patch) {
  throw new Error('PATCH env is required (the version this data was built for); set it before running publish.mjs.');
}
writeFileSync(`${publicDir}version.json`, `${JSON.stringify({ v: version, patch })}\n`);
console.log(`version stamp: ${version} (patch ${patch})`);
console.log(`published to ${publicDir}`);
