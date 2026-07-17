// Runs a single extractor (extractItems/extractGems/extractRunes/extractMods)
// on its own worker thread so the CPU-bound work inside each extractor (table
// parsing, sharp DDS/PNG decoding) actually runs on a separate core - a plain
// `Promise.all` in the main thread only overlaps I/O wait, not this CPU work,
// since Node's JS execution is single-threaded.
//
// Each worker builds its own `source` (CdnSource) rather than sharing the main
// thread's: a CdnSource isn't structured-clone-safe, and its cache is disk-
// backed and concurrency-safe (verified: worst case on a cold entry is a
// duplicate CDN fetch, never corruption), so a second in-memory instance
// pointed at the same cacheDir is cheap and correct.

import { parentPort, workerData } from 'node:worker_threads';

import { createCdnSource } from '@poe2-toolkit/ggpk';
import { extractItems } from '@poe2-toolkit/item-extractor';
import { extractGems } from '@poe2-toolkit/gem-extractor';
import { extractRunes } from '@poe2-toolkit/rune-extractor';
import { extractMods } from '@poe2-toolkit/mod-extractor';

const EXTRACTORS = {
    items: extractItems,
    gems: extractGems,
    runes: extractRunes,
    mods: extractMods,
};

const { name, patch, cacheDir, tablesDir } = workerData;
const extractFn = EXTRACTORS[name];

if (!extractFn) {
    throw new Error(`extract-worker: unknown extractor "${name}"`);
}

const source = await createCdnSource({ patch, cacheDir, tablesDir });
const result = await extractFn(source);

parentPort.postMessage(result);
