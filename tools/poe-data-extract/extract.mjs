// Runs `pathofexile-dat`'s table/file export, with one correction applied to the
// community schema first: the QuestStaticRewards column holding a quest's weapon-set
// passive-point grant is unnamed upstream (poe-tool-dev/dat-schema), so the stock
// exporter can't select it. We intercept the schema fetch and name that column before
// the export reads it; everything else passes through untouched. Drop this shim once
// the column is named upstream.
//
// Usage: npm run extract   (replaces `npx pathofexile-dat`; runs resolvePatch.mjs
// first via the "preextract" npm hook, which writes the config.json this reads its
// patch from - `node extract.mjs` directly skips that and will fail without one)

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

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  if (String(input) === SCHEMA_URL) {
    const schema = await (await originalFetch(input, init)).json();
    patchSchema(schema);

    return new Response(JSON.stringify(schema), { headers: { 'content-type': 'application/json' } });
  }

  return originalFetch(input, init);
};

// `run.js` is an unexported CLI entry that executes on import. Resolve it via an
// exported sibling subpath, the same way the toolkit reaches dat internals.
const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('pathofexile-dat/bundles.js'));

await import(pathToFileURL(join(dist, 'cli/run.js')).href);
