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
// Usage: import { resolvePatch } from './resolvePatch.mjs'  (refresh.mjs calls this
// directly, once, for the whole pipeline). Running this file itself (`node
// resolvePatch.mjs`, or via the preextract/prebuild-data npm hooks on `npm run
// extract`/`npm run build-data`) reuses an existing config.json instead, so
// separate manual steps in the same session stay on the same patch - see
// ensurePatch() below.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = fileURLToPath(new URL('./', import.meta.url));
const repoRoot = resolve(toolDir, '..', '..');
const exampleUrl = new URL('./config.example.json', import.meta.url);
const configUrl = new URL('./config.json', import.meta.url);

function currentGggPatch() {
    try {
        return execFileSync('php', ['artisan', 'poe2:current-patch'], {
            cwd: repoRoot,
        })
            .toString()
            .trim();
    } catch (error) {
        // Surface the command's own clean output (artisan errors land on stdout,
        // not stderr, by default) instead of Node's noisy "Command failed: ..."
        // wrapper + stack trace.
        const output =
            error.stderr?.toString().trim() ||
            error.stdout?.toString().trim() ||
            error.message;

        throw new Error(`${output} (php artisan poe2:current-patch)`);
    }
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

/**
 * Like {@link resolvePatch}, but reuses an already-written `config.json` as-is
 * when one exists and `PATCH` wasn't explicitly given - used by the `preextract`/
 * `prebuild-data` npm hooks, so running `npm run extract` then later `npm run
 * build-data` by hand targets the same patch both resolved, instead of each
 * independently re-querying GGG live and risking two different versions if a new
 * patch ships in the gap between the two commands. `refresh.mjs` never calls this -
 * it resolves once per full pipeline run via {@link resolvePatch} directly.
 */
function ensurePatch() {
    if (!process.env.PATCH && existsSync(configUrl)) {
        const existing = JSON.parse(readFileSync(configUrl, 'utf8')).patch;

        if (existing) {
            process.env.PATCH = existing;

            return existing;
        }
    }

    return resolvePatch();
}

// Runnable standalone (node resolvePatch.mjs, or via the preextract/prebuild-data
// npm hooks) to prepare config.json before running an individual extractor step by
// hand, without going through refresh.mjs.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    console.log(`Resolved patch: ${ensurePatch()}`);
}
