// Builds the app's GGPK-derived mapping data and icons from the @poe2-toolkit
// extractors. Source of truth: GGPK only. Replaces the legacy transform.mjs +
// tree/build-icons.mjs + stat-descriptions.mjs.
//
// Tables come from the local `extract.mjs` output; every icon is decoded fresh
// from the patch CDN, which serves the whole item/gem/rune art set (item
// textures uncompressed R8G8B8A8, gem textures BC1). No committed-PNG fallback:
// if an icon can't be served or decoded, the run fails loud rather than silently
// shipping stale art.
//
// Usage: node build-data.mjs   (after `npm run extract`)

import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCdnSource, buildStatIndex } from '@poe2-toolkit/ggpk';
import { extractItems } from '@poe2-toolkit/item-extractor';
import { extractGems } from '@poe2-toolkit/gem-extractor';
import { extractRunes } from '@poe2-toolkit/rune-extractor';
import { extractMods } from '@poe2-toolkit/mod-extractor';

import { buildModCatalogue, buildBaseImplicits } from './mod-catalogue.mjs';

const TOOLS = fileURLToPath(new URL('./', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TABLES_DIR = join(TOOLS, 'tables/English');
const CACHE_DIR = join(TOOLS, '.cache');
const GGPK_OUT = join(ROOT, 'resources/poe2/ggpk');
const ICONS_OUT = join(ROOT, 'public/icons/poe2');

// The patch is whatever `extract.mjs` decoded against; the CDN serves only that
// version, which is also where the icons come from.
const patch = JSON.parse(readFileSync(join(TOOLS, 'config.json'), 'utf8')).patch;

const source = await createCdnSource({ patch, cacheDir: CACHE_DIR, tablesDir: TABLES_DIR });

const items = await extractItems(source);
const gems = await extractGems(source);
const runes = await extractRunes(source);
const modData = (await extractMods(source)).data;

// The explicit-affix catalogue (item prefix/suffix mods) the modifier picker searches.
const mods = buildModCatalogue(modData);

// Base implicits are resolved from BaseItemTypes.Implicit_Mods (row indices into Mods),
// rendered here through GGG's own stat descriptions, then folded onto each normal base
// below. The full-column BaseItemTypes / Mods / Stats tables come from `extract.mjs` (the
// toolkit source decodes only a subset of BaseItemTypes columns, without Implicit_Mods);
// stat_descriptions.csd is UTF-16 text read straight from the GGPK.
const STAT_DESCRIPTIONS_PATH = 'data/statdescriptions/stat_descriptions.csd';
const baseRows = JSON.parse(readFileSync(join(TABLES_DIR, 'BaseItemTypes.json'), 'utf8'));
const modRows = JSON.parse(readFileSync(join(TABLES_DIR, 'Mods.json'), 'utf8'));
const statRows = JSON.parse(readFileSync(join(TABLES_DIR, 'Stats.json'), 'utf8'));
const statCsd = await source.file(STAT_DESCRIPTIONS_PATH);

if (!statCsd) {
  throw new Error(`stat descriptions not found in GGPK: ${STAT_DESCRIPTIONS_PATH}`);
}

const statIndex = buildStatIndex(Buffer.from(statCsd).toString('utf16le'));
const { implicits, unresolved: unresolvedImplicits } = buildBaseImplicits(statIndex, baseRows, modRows, statRows);

// Fold implicits onto their base so the item mapping carries them (like flavourText):
// only normal bases have a known base type, and thus implicits.
for (const [name, item] of Object.entries(items.data)) {
  if (item.rarity !== 'unique' && implicits[name] !== undefined) {
    item.implicits = implicits[name];
  }
}

// --- mapping JSON (matches the legacy transform.mjs serialization 1:1) --------

mkdirSync(GGPK_OUT, { recursive: true });
const writeJson = (name, value) => writeFileSync(join(GGPK_OUT, `${name}.json`), JSON.stringify(value, null, 2));
writeJson('items', items.data);
writeJson('gems', gems.data.gems);
writeJson('gem_requirements', gems.data.requirements);
writeJson('runes', runes.data);
writeJson('mods', mods);

// --- icons --------------------------------------------------------------------
// Every referenced icon must decode from the CDN; no committed fallback. Fail loud
// on any gap so a new texture format surfaces as a decoder task rather than silently
// shipping stale or missing art. The rune extractor's icons cover both the per-rune
// inventory art and the fixed item-socket UI textures (the empty ring + rune star /
// soul-core orb, keyed `ui/*.png`), so the item display draws real GGPK socket art,
// not an approximation.
for (const [label, report] of [['items', items.icons.report], ['gems', gems.icons.report], ['runes', runes.icons.report]]) {
  if (report.missing > 0) {
    throw new Error(`${label}: ${report.missing} icon(s) could not be decoded from the CDN - extend the DDS decoder in @poe2-toolkit/ggpk instead of falling back to committed art`);
  }
}

// DATA_JSON_ONLY (the pre-test extraction for CI and local runs) skips writing the
// heavy PNG art - the server and tests only read the JSON mappings above, never the
// icon files on disk.
if (process.env.DATA_JSON_ONLY) {
  console.log('icons: skipped (DATA_JSON_ONLY)');
} else {
  // Write every GGPK-decoded PNG in place.
  let written = 0;
  for (const [path, png] of [...Object.entries(items.icons.icons), ...Object.entries(gems.icons.icons), ...Object.entries(runes.icons.icons)]) {
    const out = join(ICONS_OUT, path);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, png);
    written += 1;
  }

  // Gems now reference the GGPK base path, so the upscaled third-party 4k set is
  // unreferenced. Remove it - the project is GGPK-only and ships no fan art.
  for (const dir of ['Art/2DArt/SkillIcons/4k', 'Art/2DArt/SkillIcons/Support/4k']) {
    const full = join(ICONS_OUT, dir);

    if (existsSync(full)) {
      rmSync(full, { recursive: true, force: true });
    }
  }

  console.log(`icons written: ${written}`);
}

console.log(`items: ${Object.keys(items.data).length} (${items.icons.report.packed} icons from GGPK)`);
console.log(`gems:  ${Object.keys(gems.data.gems).length} (${gems.icons.report.packed} icons from GGPK)`);
console.log(`gem requirements: ${Object.keys(gems.data.requirements).length}`);
console.log(`runes: ${Object.keys(runes.data).length}`);
console.log(`mods: ${mods.length} item affixes; implicits on ${Object.keys(implicits).length} bases (${unresolvedImplicits} unresolved refs)`);
