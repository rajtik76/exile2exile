// Regenerates every GGPK-derived asset in place from the pinned patch, the single
// entrypoint both a fresh clone and the production watcher call. It runs the four
// extractor steps in order - dat table export, item/gem/rune data + icons, passive
// tree, tree publish - writing straight into public/icons, public/tree/current and
// resources/poe2/ggpk. Source of truth: GGPK only (BLOCKER A). The committed art is
// not in git; this rebuilds it from the CDN for the version pinned in config.json.
//
// Usage: npm run refresh:data   (from the repo root)

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = fileURLToPath(new URL('./', import.meta.url));
const configUrl = new URL('./config.json', import.meta.url);
const config = JSON.parse(readFileSync(configUrl, 'utf8'));

// A caller (the production watcher) can pin a specific version via PATCH; write it
// into config.json run-local so every step agrees - build-data reads the pin, the
// tree extract takes --patch, publish stamps it. Left unset (a fresh clone) it
// uses the committed pin as-is.
if (process.env.PATCH && process.env.PATCH !== config.patch) {
    config.patch = process.env.PATCH;
    writeFileSync(configUrl, `${JSON.stringify(config, null, 2)}\n`);
}

const patch = config.patch;

if (!patch) {
    throw new Error('tools/poe-data-extract/config.json has no patch pin');
}

// Optional staging root: with DATA_OUT set, build-data and publish write the
// whole output tree (public/..., resources/...) under it instead of the repo
// root, so a release can be staged next to the live data and swapped in
// atomically. Resolve it here - the steps below run with the tool dir as cwd,
// which would silently reroot a relative path.
if (process.env.DATA_OUT) {
    process.env.DATA_OUT = resolve(process.env.DATA_OUT);
    console.log(`Staging output under ${process.env.DATA_OUT}`);
}

/** Run a step from the extractor directory, inheriting stdio, failing loud on error. */
function step(label, command, args, extraEnv = {}) {
    console.log(`\n▶ ${label}`);
    execFileSync(command, args, {
        cwd: toolDir,
        stdio: 'inherit',
        env: { ...process.env, ...extraEnv },
    });
}

console.log(`Refreshing GGPK-derived data for pinned patch ${patch}`);

// The extractor has its own dependency tree (@poe2-toolkit/*), separate from the
// app's root node_modules; a fresh clone or a production image built without it
// must install before any step can run. With the lockfile satisfied this is a
// fast no-op check.
step('install extractor dependencies', 'npm', ['install']);

step('extract GGPK tables', 'node', ['extract.mjs']);
step('build item/gem/rune data + icons', 'node', ['build-data.mjs']);
step('extract the passive tree', 'npx', [
    'poe2-tree-extract',
    '--patch',
    patch,
    '--tables',
    'tables/English',
    '--cache',
    '.cache',
    '--out',
    'out/tree',
]);
step('publish the passive tree (PNG -> WebP)', 'node', ['tree/publish.mjs'], {
    PATCH: patch,
});

console.log('\n✓ GGPK-derived data refreshed in place.');
