// Resolves which GGG patch this extraction run targets and (re)writes the working
// `config.json` that both our own scripts and the vendored `pathofexile-dat` CLI
// read - the CLI itself hardcodes `readFile(cwd() + '/config.json')` and refuses to
// run without a `"patch"` key in it (see node_modules/pathofexile-dat/dist/cli/run.js),
// so that exact file must exist with a valid patch before `extract.mjs` runs.
//
// `config.json` is gitignored: it is fully regenerated on every run from the
// committed `config.example.json` (so a schema/table fix committed there always
// takes effect) plus whichever patch this run resolves to, so it can never go stale
// or drift from git, and a real extraction run never leaves the working tree dirty.
//
// The patch itself: PATCH env if given (the production watcher and CI always pass
// one explicitly - see StageGameData.php), otherwise this queries GGG's own patch
// server live via the app's `poe2:current-patch` command. There is no separate
// committed default version anywhere - unset always means "whatever GGG currently
// serves", never a stale pin.
//
// Usage: import { resolvePatch } from './resolvePatch.mjs'  (refresh.mjs, or any
// standalone step run directly - node build-data.mjs, node extract.mjs - after
// first running `node resolvePatch.mjs` once to prepare config.json).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = fileURLToPath(new URL('./', import.meta.url));
const repoRoot = resolve(toolDir, '..', '..');
const exampleUrl = new URL('./config.example.json', import.meta.url);
const configUrl = new URL('./config.json', import.meta.url);

function currentGggPatch() {
    return execFileSync('php', ['artisan', 'poe2:current-patch'], {
        cwd: repoRoot,
    })
        .toString()
        .trim();
}

/**
 * Resolve the patch for this run and (re)write `config.json` from the committed
 * template plus that patch. Returns the resolved patch string and also stamps it
 * onto `process.env.PATCH`, so every later step (which all inherit `process.env`,
 * see `refresh.mjs`'s `step()`) sees it without needing to read any file.
 */
export function resolvePatch() {
    const patch = process.env.PATCH || currentGggPatch();
    const example = JSON.parse(readFileSync(exampleUrl, 'utf8'));

    writeFileSync(configUrl, `${JSON.stringify({ ...example, patch }, null, 2)}\n`);
    process.env.PATCH = patch;

    return patch;
}

// Runnable standalone (node resolvePatch.mjs) to prepare config.json before running
// an individual extractor step by hand, without going through refresh.mjs.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    console.log(`Resolved patch: ${resolvePatch()}`);
}
