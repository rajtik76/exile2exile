// Regenerates every GGPK-derived asset in place for a single patch version, the
// single entrypoint both a fresh clone and the production watcher call. It runs the
// four extractor steps in order - dat table export, item/gem/rune data + icons,
// passive tree, tree publish - writing straight into public/icons, public/tree/current
// and resources/poe2/ggpk. Source of truth: GGPK only (BLOCKER A). The committed art
// is not in git; this rebuilds it from the CDN for the version given.
//
// The version comes from PATCH if set (the production watcher/CI always pass one -
// see StageGameData.php); left unset (a fresh clone, a manual local run) it queries
// GGG's own patch server for whatever is current right now - see resolvePatch.mjs.
// There is no separate "default" version pinned anywhere, committed or otherwise.
//
// Usage: npm run refresh:data   (from the repo root)

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePatch } from './resolvePatch.mjs';

const toolDir = fileURLToPath(new URL('./', import.meta.url));
const patch = resolvePatch();

// Optional staging root: with DATA_OUT set, build-data and publish write the
// whole output tree (public/..., resources/...) under it instead of the repo
// root, so a release can be staged next to the live data and swapped in
// atomically. Resolve it here - the steps below run with the tool dir as cwd,
// which would silently reroot a relative path.
if (process.env.DATA_OUT) {
    process.env.DATA_OUT = resolve(process.env.DATA_OUT);
    console.log(`Staging output under ${process.env.DATA_OUT}`);
}

/** Run a step from the extractor directory, inheriting stdio, failing loud on error.
 *  Every step inherits process.env, so the resolved PATCH reaches all of them without
 *  any of them needing to read a shared file (build-data.mjs and the vendored
 *  pathofexile-dat CLI still read it from config.json, which resolvePatch() above
 *  already wrote fresh for this run). */
function step(label, command, args, extraEnv = {}) {
    console.log(`\n▶ ${label}`);
    execFileSync(command, args, {
        cwd: toolDir,
        stdio: 'inherit',
        env: { ...process.env, ...extraEnv },
    });
}

console.log(`Refreshing GGPK-derived data for patch ${patch}`);

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
step('publish the passive tree (PNG -> WebP)', 'node', ['tree/publish.mjs']);

console.log('\n✓ GGPK-derived data refreshed in place.');
