// Runs `pathofexile-dat`'s table/file export, with one correction applied to the
// community schema first: the QuestStaticRewards column holding a quest's weapon-set
// passive-point grant is unnamed upstream (poe-tool-dev/dat-schema), so the stock
// exporter can't select it. We intercept the schema fetch and name that column before
// the export reads it; everything else passes through untouched. Drop this shim once
// the column is named upstream.
//
// The stock exporter also tells PoE1 from PoE2 by patch prefix (only "4." counts as
// PoE2), both for the CDN host and for the table paths/schema variant. GGG renumbered
// its PoE2 builds (4.5.5.4 -> 0.5.5.4), so this tool, which only ever reads PoE2,
// pins both: the fetch hook rewrites PoE1 CDN URLs to the PoE2 CDN, and the export
// runs with a PoE2 marker instead of through the stock `run.js` entry.
//
// Usage: npm run extract   (replaces `npx pathofexile-dat`; runs resolvePatch.mjs
// first via the "preextract" npm hook, which writes the config.json this reads its
// patch from - `node extract.mjs` directly skips that and will fail without one)

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { SCHEMA_URL } from 'pathofexile-dat-schema';

/** Name the unnamed i32 that follows QuestFlag: the quest's weapon-set passive grant. */
const QUEST_WEAPON_PASSIVES_INDEX = 1;

/** Apply our schema corrections in place. Scoped to PoE2 table variants only. */
function patchSchema(schema) {
  for (const table of schema.tables) {
    if (table.name === 'QuestStaticRewards') {
      const column = table.columns[QUEST_WEAPON_PASSIVES_INDEX];

      if (column && !column.name) {
        column.name = 'WeaponPassives';
      }
    }
  }
}

const POE1_CDN = 'https://patch.poecdn.com/';
const POE2_CDN = 'https://patch-poe2.poecdn.com/';

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  if (String(input).startsWith(POE1_CDN)) {
    return originalFetch(POE2_CDN + String(input).slice(POE1_CDN.length), init);
  }

  if (String(input) === SCHEMA_URL) {
    const schema = await (await originalFetch(input, init)).json();
    patchSchema(schema);

    return new Response(JSON.stringify(schema), { headers: { 'content-type': 'application/json' } });
  }

  return originalFetch(input, init);
};

// The CLI modules are unexported. Resolve them via an exported sibling subpath, the
// same way the toolkit reaches dat internals. Mirrors `cli/run.js` (CDN loader only).
const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve('pathofexile-dat/bundles.js')), 'cli');
const cliModule = (file) => import(pathToFileURL(join(cli, file)).href);

const loaders = await cliModule('bundle-loaders.js');
const { exportFiles } = await cliModule('export-files.js');
const { exportTables } = await cliModule('export-tables.js');

const config = JSON.parse(await readFile(join(process.cwd(), 'config.json'), 'utf-8'));

if (!config.patch) {
  console.error('config.json has no "patch" (run through `npm run extract`).');
  process.exit(1);
}

console.log('Loading bundles index...');
const loader = await loaders.FileLoader.create(
  new loaders.CachingBundleLoader(await loaders.CdnBundleLoader.create(join(process.cwd(), '.cache'), config.patch)),
);

// The exporter's only PoE2 signal that does not depend on the patch prefix.
const poe2Config = { ...config, steam: 'Path of Exile 2' };

await exportFiles(poe2Config, join(process.cwd(), 'files'), loader);
await exportTables(poe2Config, join(process.cwd(), 'tables'), loader);
