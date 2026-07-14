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

import {
    mkdirSync,
    writeFileSync,
    readFileSync,
    existsSync,
    rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCdnSource, buildStatIndex, encodePng } from '@poe2-toolkit/ggpk';
import { extractItems } from '@poe2-toolkit/item-extractor';
import { extractGems } from '@poe2-toolkit/gem-extractor';
import { extractRunes } from '@poe2-toolkit/rune-extractor';
import { extractMods } from '@poe2-toolkit/mod-extractor';

import {
    buildModCatalogue,
    buildBaseImplicits,
    buildEssenceClasses,
} from './mod-catalogue.mjs';

const TOOLS = fileURLToPath(new URL('./', import.meta.url));
// DATA_OUT roots the output tree somewhere else (a staging release dir) while
// keeping the repo-relative layout inside it; unset, outputs land in the repo.
const ROOT = process.env.DATA_OUT
    ? resolve(process.env.DATA_OUT)
    : fileURLToPath(new URL('../../', import.meta.url));
const TABLES_DIR = join(TOOLS, 'tables/English');
const CACHE_DIR = join(TOOLS, '.cache');
const GGPK_OUT = join(ROOT, 'resources/poe2/ggpk');
const ICONS_OUT = join(ROOT, 'public/icons/poe2');

// The patch is whatever `extract.mjs` decoded against; the CDN serves only that
// version, which is also where the icons come from.
const patch = JSON.parse(
    readFileSync(join(TOOLS, 'config.json'), 'utf8'),
).patch;

const source = await createCdnSource({
    patch,
    cacheDir: CACHE_DIR,
    tablesDir: TABLES_DIR,
});

// The item tooltip's ornate header banner (rarity-tinted corner art + a repeating
// middle strip), keyed by a stable logical output path - not the per-rarity GGPK
// path itself, so the frontend never has to know the raw GGG naming. Same "no
// committed fallback" policy as the icons below: a miss fails the build.
const TOOLTIP_HEADER_TEXTURES = {
    'ui/tooltip-header-white-left.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheaderwhiteleft.dds',
    'ui/tooltip-header-white-middle.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheaderwhitemiddle.dds',
    'ui/tooltip-header-white-right.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheaderwhiteright.dds',
    'ui/tooltip-header-magic-left.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheadermagicleft.dds',
    'ui/tooltip-header-magic-middle.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheadermagicmiddle.dds',
    'ui/tooltip-header-magic-right.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheadermagicright.dds',
    'ui/tooltip-header-rare-left.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheaderrareleft.dds',
    'ui/tooltip-header-rare-middle.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheaderraremiddle.dds',
    'ui/tooltip-header-rare-right.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheaderrareright.dds',
    'ui/tooltip-header-unique-left.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheaderuniqueleft.dds',
    'ui/tooltip-header-unique-middle.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheaderuniquemiddle.dds',
    'ui/tooltip-header-unique-right.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheaderuniqueright.dds',
    // Runes and Soul Cores share one GGPK ItemClass ("SoulCore"/Augment) and
    // the game renders both with the currency banner (ItemsHeaderCurrency*) -
    // there is no separate rune/soul-core header art in the GGPK.
    'ui/tooltip-header-currency-left.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheadercurrencyleft.dds',
    'ui/tooltip-header-currency-middle.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheadercurrencymiddle.dds',
    'ui/tooltip-header-currency-right.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/itemsheadercurrencyright.dds',
    // The passive tree's own notable/keystone tooltip banner - distinct GGPK art
    // from the item rarity/currency banners above (verified against poe2db's own
    // CSS: `.notablePopup .itemHeader { background: url(.../notablepassiveheaderleft.webp) ...}`).
    'ui/tooltip-header-notable-left.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/notablepassiveheaderleft.dds',
    'ui/tooltip-header-notable-middle.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/notablepassiveheadermiddle.dds',
    'ui/tooltip-header-notable-right.png':
        'art/textures/interface/2d/2dart/uiimages/ingame/notablepassiveheaderright.dds',
};

async function buildTooltipHeaderIcons() {
    const icons = {};
    let missing = 0;

    for (const [outPath, ddsPath] of Object.entries(TOOLTIP_HEADER_TEXTURES)) {
        const img = await source.dds(ddsPath);

        if (!img) {
            missing += 1;
            continue;
        }

        icons[outPath] = encodePng(img.width, img.height, img.rgba);
    }

    // The gem tooltip header is a single sprite-indexed image (not a raw dds path,
    // not a left/middle/right triplet like the rarity/currency banners) - verified
    // against poe2db's own CSS (`.item-popup--poe2.GemPopup .itemHeader { background:
    // url(.../smarthover/gemhovertitle.webp) top left no-repeat; background-size:
    // contain; }`), which resolves to this exact GGPK sprite. The `ItemsHeaderGem*`
    // triplet some legacy CSS rules reference is PoE1 art, unused by poe2's own
    // `.item-popup--poe2` rules - do not resurrect it here.
    const gemTitle = await source.uiSprite(
        'Art/2DArt/UIImages/InGame/SmartHover/GemHoverTitle',
    );

    if (gemTitle) {
        icons['ui/tooltip-header-gem-title.png'] = encodePng(
            gemTitle.width,
            gemTitle.height,
            gemTitle.rgba,
        );
    } else {
        missing += 1;
    }

    return { icons, report: { packed: Object.keys(icons).length, missing } };
}

const tooltipHeader = await buildTooltipHeaderIcons();

const items = await extractItems(source);
const gems = await extractGems(source);
const runes = await extractRunes(source);
const modData = (await extractMods(source)).data;

// Essence-granted mods carry no positive spawn weight (an essence targets item
// classes directly), so their class gate is joined from the EssenceMods table.
const essenceClasses = buildEssenceClasses(
    JSON.parse(readFileSync(join(TABLES_DIR, 'EssenceMods.json'), 'utf8')),
    JSON.parse(
        readFileSync(
            join(TABLES_DIR, 'EssenceTargetItemCategories.json'),
            'utf8',
        ),
    ),
    JSON.parse(readFileSync(join(TABLES_DIR, 'ItemClasses.json'), 'utf8')),
    JSON.parse(readFileSync(join(TABLES_DIR, 'Mods.json'), 'utf8')),
);

// The explicit-affix catalogue (item prefix/suffix mods) the modifier picker searches.
const { mods, skipped: skippedMods } = buildModCatalogue(
    modData,
    essenceClasses,
);

if (skippedMods.length > 0) {
    console.log(
        `mods skipped (no rendered stat line): ${skippedMods.length} - ${skippedMods.join(', ')}`,
    );
}

// Base implicits are resolved from BaseItemTypes.Implicit_Mods (row indices into Mods),
// rendered here through GGG's own stat descriptions, then folded onto each normal base
// below. The full-column BaseItemTypes / Mods / Stats tables come from `extract.mjs` (the
// toolkit source decodes only a subset of BaseItemTypes columns, without Implicit_Mods);
// stat_descriptions.csd is UTF-16 text read straight from the GGPK.
const STAT_DESCRIPTIONS_PATH = 'data/statdescriptions/stat_descriptions.csd';
const baseRows = JSON.parse(
    readFileSync(join(TABLES_DIR, 'BaseItemTypes.json'), 'utf8'),
);
const modRows = JSON.parse(readFileSync(join(TABLES_DIR, 'Mods.json'), 'utf8'));
const statRows = JSON.parse(
    readFileSync(join(TABLES_DIR, 'Stats.json'), 'utf8'),
);
const statCsd = await source.file(STAT_DESCRIPTIONS_PATH);

if (!statCsd) {
    throw new Error(
        `stat descriptions not found in GGPK: ${STAT_DESCRIPTIONS_PATH}`,
    );
}

const statIndex = buildStatIndex(Buffer.from(statCsd).toString('utf16le'));
const { implicits, unresolved: unresolvedImplicits } = buildBaseImplicits(
    statIndex,
    baseRows,
    modRows,
    statRows,
);

// Fold implicits onto their base so the item mapping carries them (like flavourText):
// only normal bases have a known base type, and thus implicits.
for (const [name, item] of Object.entries(items.data)) {
    if (item.rarity !== 'unique' && implicits[name] !== undefined) {
        item.implicits = implicits[name];
    }
}

// --- mapping JSON (matches the legacy transform.mjs serialization 1:1) --------

mkdirSync(GGPK_OUT, { recursive: true });
const writeJson = (name, value) =>
    writeFileSync(
        join(GGPK_OUT, `${name}.json`),
        JSON.stringify(value, null, 2),
    );
writeJson('items', items.data);
writeJson('gems', gems.data.gems);
writeJson('gem_requirements', gems.data.requirements);
writeJson('gem_scaling', gems.data.scaling);
writeJson('runes', runes.data);
writeJson('mods', mods);

// --- icons --------------------------------------------------------------------
// Every referenced icon must decode from the CDN; no committed fallback. Fail loud
// on any gap so a new texture format surfaces as a decoder task rather than silently
// shipping stale or missing art. The rune extractor's icons cover both the per-rune
// inventory art and the fixed item-socket UI textures (the empty ring + rune star /
// soul-core orb, keyed `ui/*.png`), so the item display draws real GGPK socket art,
// not an approximation.
for (const [label, report] of [
    ['items', items.icons.report],
    ['runes', runes.icons.report],
    ['tooltip header', tooltipHeader.report],
]) {
    if (report.missing > 0) {
        throw new Error(
            `${label}: ${report.missing} icon(s) could not be decoded from the CDN - extend the DDS decoder in @poe2-toolkit/ggpk instead of falling back to committed art`,
        );
    }
}

// Gems are exempt from the fail-loud check above because @poe2-toolkit/gem-
// extractor's combined `missing` counter covers both `icon` (should always
// decode) and `hoverImage` (genuinely sparse in the game's own data - no
// support gem has hover art, and most active gems don't have it yet either -
// see the package's README), so a nonzero `missing` there is an expected
// steady state, not necessarily a decoder gap. Fail loud on `icon` alone,
// checked directly against the packed map so a real base-icon regression
// still surfaces instead of being absorbed into the sparse-hoverImage noise.
const gemIconPngPath = (ddsPath) => `${ddsPath.slice(0, -4)}.png`;
const missingGemIcons = Object.values(gems.data.gems).filter(
    (gem) => gem.icon && !(gemIconPngPath(gem.icon) in gems.icons.icons),
).length;

if (missingGemIcons > 0) {
    throw new Error(
        `gems: ${missingGemIcons} base icon(s) could not be decoded from the CDN - extend the DDS decoder in @poe2-toolkit/ggpk instead of falling back to committed art`,
    );
}

console.log(
    `gems icons: ${gems.icons.report.packed} packed, ${gems.icons.report.missing} missing overall (hoverImage sparsity expected; base gem icons checked separately above)`,
);

// DATA_JSON_ONLY (the pre-test extraction for CI and local runs) skips writing the
// heavy PNG art - the server and tests only read the JSON mappings above, never the
// icon files on disk.
if (process.env.DATA_JSON_ONLY) {
    console.log('icons: skipped (DATA_JSON_ONLY)');
} else {
    // Write every GGPK-decoded PNG in place.
    let written = 0;
    for (const [path, png] of [
        ...Object.entries(items.icons.icons),
        ...Object.entries(gems.icons.icons),
        ...Object.entries(runes.icons.icons),
        ...Object.entries(tooltipHeader.icons),
    ]) {
        const out = join(ICONS_OUT, path);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, png);
        written += 1;
    }

    // Gems now reference the GGPK base path, so the upscaled third-party 4k set is
    // unreferenced. Remove it - the project is GGPK-only and ships no fan art.
    for (const dir of [
        'Art/2DArt/SkillIcons/4k',
        'Art/2DArt/SkillIcons/Support/4k',
    ]) {
        const full = join(ICONS_OUT, dir);

        if (existsSync(full)) {
            rmSync(full, { recursive: true, force: true });
        }
    }

    console.log(`icons written: ${written}`);
}

console.log(
    `items: ${Object.keys(items.data).length} (${items.icons.report.packed} icons from GGPK)`,
);
console.log(
    `gems:  ${Object.keys(gems.data.gems).length} (${gems.icons.report.packed} icons from GGPK)`,
);
console.log(`gem requirements: ${Object.keys(gems.data.requirements).length}`);
console.log(`gem scaling: ${Object.keys(gems.data.scaling).length}`);
console.log(`runes: ${Object.keys(runes.data).length}`);
console.log(
    `mods: ${mods.length} item affixes; implicits on ${Object.keys(implicits).length} bases (${unresolvedImplicits} unresolved refs)`,
);
