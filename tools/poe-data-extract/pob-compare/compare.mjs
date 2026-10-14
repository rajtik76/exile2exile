// Compares our extracted game data with Path of Building's (PathOfBuilding-PoE2),
// which derives the same GGPK data its own way: the passive tree, the runes and
// soul cores, and the gems with every tooltip line per stat set and level.
// Prints a per-area summary and writes the full differences to
// out/pob-compare/<area>.json.
//
// Usage (from tools/poe-data-extract):
//   POB_DIR=../../../PathOfBuilding-PoE2 node pob-compare/compare.mjs [tree] [runes] [gems] [--verbose]
//
// POB_DIR is a local PoB checkout (default: a PathOfBuilding-PoE2 checkout next
// to this repo); pob.lua reads it through LuaJIT, so `luajit` must be on PATH.
// DATA_OUT points at a staged extraction (build-data.mjs / tree/publish.mjs
// output); unset, the repo's own data is compared. The rune check also reads
// tables/English/SoulCoreStatCategories.json from the local table export.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOL = resolve(HERE, '..');
const REPO = resolve(TOOL, '../..');
const POB_DIR = resolve(process.env.POB_DIR ?? join(REPO, '..', 'PathOfBuilding-PoE2'));
const DATA_ROOT = resolve(process.env.DATA_OUT ?? REPO);
const OUT = join(TOOL, 'out/pob-compare');
const VERBOSE = process.argv.includes('--verbose');
const AREAS = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

/**
 * Differences confirmed as PoB quirks rather than data errors. They are listed
 * apart and not counted: PoB's tree and soul-core exports ignore the
 * `gem_quality` line flag that its own runtime describer honours, so a negative
 * value there picks the quality line ("-20% increased ...").
 */
const KNOWN = {
  tree: { 37778: 'PoB tree export ignores the gem_quality line flag' },
  runes: { 'Rune of the Blossom': 'PoB soul-core export ignores the gem_quality line flag' },
  // PoB numbers a skill's statset_N description files by its own list of shown
  // sets, so dropping a hidden set shifts every later set onto the wrong file
  // (Cold-Infused reads statset_1, the hidden Frostbolt set's file, not statset_2).
  gems: { SkillGemIceNova: 'PoB reads the description file of the hidden set before it' },
};

if (!existsSync(join(POB_DIR, 'src/Modules/StatDescriber.lua'))) {
  console.error(`No Path of Building checkout at ${POB_DIR} (set POB_DIR).`);
  process.exit(1);
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const ggpk = (name) => readJson(join(DATA_ROOT, 'resources/poe2/ggpk', `${name}.json`));

/** Run pob.lua against the checkout and parse its JSON. */
function pob(command) {
  return JSON.parse(execFileSync('luajit', [join(HERE, 'pob.lua'), command], {
    cwd: join(POB_DIR, 'src'),
    encoding: 'utf8',
    maxBuffer: 1 << 30,
  }));
}

/**
 * PoB's UI font is ASCII-only, so its sanitiser drops bullets and folds dashes
 * and a few accented letters; we keep GGG's text. Fold ours the same way before
 * comparing, so only real differences remain.
 */
const asPob = (text) => text
  .replace(/• ?/g, '')
  .replace(/[‐-―−]/g, '-')
  .replace(/ä/g, 'a')
  .replace(/ö/g, 'o')
  .replace(/í/g, 'i')
  .replace(/ó/g, 'o');

/** Stat lines split on newlines (PoB lists each line apart), ours folded as PoB's. */
const ourLines = (list) => (list ?? []).flatMap((line) => line.split('\n')).map(asPob);
const pobLines = (list) => (list ?? []).flatMap((line) => line.split('\n'));
/** JSON with object keys sorted, so equal data compares equal whatever its key order. */
const canonical = (value) => JSON.stringify(value, (_, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
  : v));
const same = (a, b) => canonical(a) === canonical(b);
/**
 * The array part of a Lua table: a pure array comes through as a JSON array, one
 * mixed with named fields (a rune slot's lines next to `type`, `limit`, ...) as an
 * object keyed "1", "2", ...
 */
const list = (value) => (Array.isArray(value)
  ? value
  : Object.keys(value ?? {}).filter((k) => /^\d+$/.test(k)).sort((a, b) => a - b).map((k) => value[k]));

const report = {};

function section(area) {
  const entry = { counts: {}, diffs: {}, known: [] };
  report[area] = entry;

  return {
    count(key, by = 1) {
      entry.counts[key] = (entry.counts[key] ?? 0) + by;
    },
    diff(category, row) {
      (entry.diffs[category] ??= []).push(row);
    },
    known(row) {
      entry.known.push(row);
    },
  };
}

// --- passive tree ---------------------------------------------------------------

function compareTree() {
  const out = section('tree');
  const ours = readJson(join(DATA_ROOT, 'public/tree/current/data.json'));
  const theirs = pob('tree');
  const ascendancyName = new Map(ours.classes.flatMap((cls) => cls.ascendancies.map((a) => [a.id, a.name])));

  for (const cls of ours.classes) {
    const pobClass = list(theirs.classes).find((c) => c.name === cls.name);
    const a = cls.ascendancies.map((asc) => `${asc.id}:${asc.name}`);
    const b = list(pobClass?.ascendancies).map((asc) => `${asc.internalId}:${asc.name}`);

    if (!same(a, b)) {
      out.diff('class ascendancies', { class: cls.name, ours: a, pob: b });
    }
  }

  // Data-only override nodes have no group; PoB keeps them in `options` instead.
  const placed = Object.entries(ours.nodes).filter(([, node]) => node.group !== undefined);
  const pobNodes = theirs.nodes;

  for (const [id, node] of placed) {
    if (!pobNodes[id]) {
      out.diff('node only ours', { id, name: node.name });
    }
  }

  for (const id of Object.keys(pobNodes)) {
    if (!ours.nodes[id]) {
      out.diff('node only PoB', { id, name: pobNodes[id].name });
    }
  }

  const FLAGS = [
    ['isNotable', 'isNotable'], ['isKeystone', 'isKeystone'], ['isJewelSocket', 'isJewelSocket'],
    ['containJewelSocket', 'containJewelSocket'], ['isMastery', 'isOnlyImage'], ['isGenericAttribute', 'isAttribute'],
    ['isAscendancyStart', 'isAscendancyStart'], ['sinister', 'sinister'], ['noRadius', 'noRadius'],
    ['isMultipleChoice', 'isMultipleChoice'], ['isMultipleChoiceOption', 'isMultipleChoiceOption'],
    ['isFreeAllocate', 'isFreeAllocate'], ['applyToArmour', 'applyToArmour'],
  ];
  const VALUES = [
    ['name', 'name'], ['icon', 'icon'], ['stringId', 'stringId'], ['aliasPassiveSocket', 'aliasPassiveSocket'],
    ['activeEffectImage', 'activeEffectImage'], ['orbit', 'orbit'], ['orbitIndex', 'orbitIndex'],
  ];

  for (const [id, node] of placed) {
    const theirsNode = pobNodes[id];

    if (!theirsNode) {
      continue;
    }

    out.count('nodes compared');

    const a = ourLines(node.stats);
    const b = pobLines(list(theirsNode.stats));

    if (!same(a, b)) {
      if (KNOWN.tree[id]) {
        out.known({ id, name: node.name, why: KNOWN.tree[id] });
      } else {
        out.diff(same([...a].sort(), [...b].sort()) ? 'stats order' : 'stats', { id, name: node.name, ours: a, pob: b });
      }
    }

    for (const [ourField, pobField] of FLAGS) {
      if (Boolean(node[ourField]) !== Boolean(theirsNode[pobField])) {
        out.diff(`flag ${ourField}`, { id, name: node.name, ours: node[ourField], pob: theirsNode[pobField] });
      }
    }

    // Names are compared as they are: PoB's tree export sanitises stat lines only.
    for (const [ourField, pobField] of VALUES) {
      if ((node[ourField] ?? null) !== (theirsNode[pobField] ?? null)) {
        out.diff(ourField, { id, ours: node[ourField], pob: theirsNode[pobField] });
      }
    }

    const pairs = [
      ['ascendancy', node.ascendancyId ? ascendancyName.get(node.ascendancyId) : undefined, theirsNode.ascendancyName],
      ['flavourText', node.flavourText, theirsNode.flavourText],
      ['recipe', node.recipe, theirsNode.recipe && list(theirsNode.recipe)],
      ['unlockConstraint', node.unlockConstraint, theirsNode.unlockConstraint
        && { ...theirsNode.unlockConstraint, nodes: list(theirsNode.unlockConstraint.nodes) }],
    ];

    for (const [field, ourValue, pobValue] of pairs) {
      if (!same(ourValue ?? null, pobValue ?? null)) {
        out.diff(field, { id, name: node.name, ours: ourValue, pob: pobValue });
      }
    }

    // Main-tree groups sit where PoB puts them (it rounds to 2 decimals); the
    // ascendancy discs are laid out differently on purpose, so they are skipped.
    if (!node.ascendancyId) {
      const g = ours.groups[node.group];
      const p = theirs.groups[theirsNode.group];

      if (!p || Math.hypot(g.x - p.x, g.y - p.y) > 0.01) {
        out.diff('group position', { id, ours: [g.x, g.y], pob: p && [p.x, p.y] });
      }
    }
  }

  // Edges among the nodes both trees have, undirected.
  const edgeSet = (pairs) => new Set(pairs.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`)));
  const common = new Set(placed.map(([id]) => Number(id)).filter((id) => pobNodes[id]));
  const ourEdges = edgeSet(placed.flatMap(([id, node]) => (node.out ?? []).map((to) => [Number(id), to])));
  const pobEdges = edgeSet(Object.entries(pobNodes).flatMap(([id, node]) => list(node.connections).map((c) => [Number(id), c.id])));
  const inCommon = (edge) => edge.split('-').every((id) => common.has(Number(id)));

  for (const edge of ourEdges) {
    if (inCommon(edge) && !pobEdges.has(edge)) {
      out.diff('edge only ours', edge);
    }
  }

  for (const edge of pobEdges) {
    if (inCommon(edge) && !ourEdges.has(edge)) {
      out.diff('edge only PoB', edge);
    }
  }

  // Class and replacing-ascendancy overrides: PoB keeps the swapped-in node in
  // the base node's `options`, keyed by class or ascendancy name.
  const overrides = [
    ...ours.classes.flatMap((cls) => Object.entries(cls.overridePairs ?? {}).map(([base, target]) => [cls.name, base, target])),
    ...ours.classes.flatMap((cls) => cls.ascendancies.flatMap((asc) =>
      Object.entries(asc.overridePairs ?? {}).map(([base, target]) => [asc.name, base, target]))),
  ];

  for (const [owner, base, target] of overrides) {
    const option = pobNodes[base]?.options?.[owner];
    const node = ours.nodes[target];
    const a = { name: node?.name ?? '', stats: ourLines(node?.stats) };
    const b = option && { name: option.name, stats: pobLines(list(option.stats)) };

    out.count('overrides compared');

    if (!same(a, b ?? null)) {
      out.diff('override', { owner, base, target, ours: a, pob: b });
    }
  }
}

// --- runes ----------------------------------------------------------------------

function compareRunes() {
  const out = section('runes');
  const ours = ggpk('runes');
  const { runes: theirs, classMap } = pob('runes');
  const categories = readJson(join(TOOL, 'tables/English/SoulCoreStatCategories.json'));
  const plain = (text) => text.replace(/\[([^\]]+)\]/g, (_, inner) => inner.split('|').pop()).trim();
  // Our slot label is the category's display (or id); PoB's slots come from its id.
  const slotsOf = new Map(categories.map((c) => [plain(c.Display || c.Id || ''), classMap[c.Id] ?? [c.Id.toLowerCase()]]));

  /** Our "<slot>: <line>" entries regrouped under PoB's slot keys. */
  const bySlot = (entries) => {
    const slots = {};

    for (const entry of entries ?? []) {
      const at = entry.indexOf(': ');
      const label = entry.slice(0, at);

      for (const slot of slotsOf.get(label) ?? [`?${label}`]) {
        (slots[slot] ??= []).push(...ourLines([entry.slice(at + 2)]));
      }
    }

    return slots;
  };
  const sorted = (slots) => Object.fromEntries(Object.entries(slots).filter(([, v]) => v.length).sort(([a], [b]) => a.localeCompare(b)));

  for (const [name, rune] of Object.entries(ours)) {
    const theirsRune = theirs[asPob(name)];

    if (!theirsRune) {
      out.diff('rune only ours', name);
      continue;
    }

    out.count('runes compared');

    const pobSlots = Object.entries(theirsRune);
    const pobEffects = sorted(Object.fromEntries(pobSlots.map(([slot, v]) => [slot, pobLines(list(v))])));
    const pobBonded = sorted(Object.fromEntries(pobSlots.map(([slot, v]) => [slot, pobLines(list(v.bonded))])));
    const ourEffects = sorted(bySlot(rune.effects));
    const ourBonded = sorted(bySlot(rune.bonded));

    for (const [kind, a, b] of [['effects', ourEffects, pobEffects], ['bonded', ourBonded, pobBonded]]) {
      if (!same(a, b)) {
        if (KNOWN.runes[name]) {
          out.known({ name, why: KNOWN.runes[name] });
        } else {
          out.diff(kind, { name, ours: a, pob: b });
        }
      }
    }

    const levelReq = Math.max(...pobSlots.map(([, v]) => v.levelReq ?? 0));

    if ((rune.levelRequirement ?? 0) !== levelReq) {
      out.diff('levelRequirement', { name, ours: rune.levelRequirement, pob: levelReq });
    }
  }

  const ourNames = new Set(Object.keys(ours).map(asPob));

  for (const name of Object.keys(theirs)) {
    if (!ourNames.has(name)) {
      out.diff('rune only PoB', name);
    }
  }
}

// --- gems -----------------------------------------------------------------------

function compareGems() {
  const out = section('gems');
  const gems = ggpk('gems');
  const scaling = ggpk('gem_scaling');
  const requirements = ggpk('gem_requirements');
  const { gems: pobGems, skills } = pob('gems');
  // Our gems are keyed by the base item's last id segment; PoB lists one entry
  // per gem effect under the same base item.
  const pobByBase = new Map();

  for (const entry of Object.values(pobGems)) {
    const key = entry.gameId.slice(entry.gameId.lastIndexOf('/') + 1);

    if (!pobByBase.has(key)) {
      pobByBase.set(key, entry);
    }
  }

  for (const [key, gem] of Object.entries(gems)) {
    const entry = pobByBase.get(key);

    if (!entry) {
      out.diff('gem only ours', { key, name: gem.name });
      continue;
    }

    out.count('gems compared');

    if (asPob(gem.name) !== entry.name) {
      out.diff('name', { key, ours: gem.name, pob: entry.name });
    }

    for (const [ours, theirs] of [['str', 'reqStr'], ['dex', 'reqDex'], ['int', 'reqInt']]) {
      if (gem.req[ours] !== entry[theirs]) {
        out.diff('attribute weight', { key, attribute: ours, ours: gem.req[ours], pob: entry[theirs] });
      }
    }

    const skill = skills[entry.grantedEffectId];
    const ourScaling = scaling[key];

    if (!skill || !ourScaling) {
      out.diff('no tooltip data', { key, ours: Boolean(ourScaling), pob: Boolean(skill) });
      continue;
    }

    const pobSets = list(skill.sets);
    // The first sets pair up; further sets pair by label, since PoB lists them in
    // its own order (Primal Strikes: Spirits before Final Strike).
    const ourLabels = (ourScaling.levels[0]?.additionalStatSets ?? []).map((set) => set.label);
    const pairing = [[0, 0], ...ourLabels.map((label, i) => {
      const at = pobSets.findIndex((set, j) => j > 0 && set.label === label);

      return [i + 1, at >= 0 ? at : i + 1];
    })];

    for (const index of pobSets.keys()) {
      if (!pairing.some(([, j]) => j === index)) {
        pairing.push([undefined, index]);
      }
    }

    if (pairing.some(([i, j]) => i !== undefined && j < pobSets.length && i !== j)) {
      out.diff('stat set order', { key, ours: ['', ...ourLabels], pob: pobSets.map((set) => set.label) });
    }

    for (const level of ourScaling.levels) {
      const ourSets = [{ stats: level.stats }, ...(level.additionalStatSets ?? [])];

      for (const [i, j] of pairing) {
        out.count('stat set levels compared');

        if (i === undefined || !pobSets[j]) {
          out.diff(i === undefined ? 'stat set only PoB' : 'stat set only ours', { key, level: level.level, set: i ?? j });
          continue;
        }

        const a = ourLines(ourSets[i].stats.map((line) => line.text));
        const b = pobLines(list(pobSets[j].levels)[level.level - 1]);

        if (!same(a, b)) {
          if (KNOWN.gems[key]) {
            out.known({ key, level: level.level, set: i, why: KNOWN.gems[key] });
          } else {
            out.diff(same([...a].sort(), [...b].sort()) ? 'stat lines order' : 'stat lines', { key, level: level.level, set: i, ours: a, pob: b });
          }
        }
      }

      const pobLevel = list(skill.levels)[level.level - 1];
      const requirement = requirements[key]?.levels?.[level.level];

      if (pobLevel && requirement && requirement.requiredLevel !== Math.max(1, pobLevel.levelRequirement ?? 0)) {
        out.diff('required level', { key, level: level.level, ours: requirement.requiredLevel, pob: pobLevel.levelRequirement });
      }
    }

    const a = ourLines(ourScaling.qualityStats.map((line) => line.text));
    const b = pobLines(list(skill.quality));

    out.count('quality compared');

    if (!same(a, b)) {
      out.diff('quality', { key, ours: a, pob: b });
    }
  }

  const ourKeys = new Set(Object.keys(gems));

  for (const [key, entry] of pobByBase) {
    if (!ourKeys.has(key)) {
      out.diff('gem only PoB', { key, name: entry.name });
    }
  }
}

// --- run ------------------------------------------------------------------------

const runners = { tree: compareTree, runes: compareRunes, gems: compareGems };

for (const area of AREAS.length ? AREAS : Object.keys(runners)) {
  if (!runners[area]) {
    console.error(`Unknown area "${area}" (tree, runes, gems).`);
    process.exit(1);
  }

  runners[area]();
}

mkdirSync(OUT, { recursive: true });

for (const [area, entry] of Object.entries(report)) {
  writeFileSync(join(OUT, `${area}.json`), `${JSON.stringify(entry, null, 2)}\n`);

  const total = Object.values(entry.diffs).reduce((sum, rows) => sum + rows.length, 0);

  console.log(`\n## ${area}: ${total} difference(s)`, entry.counts, entry.known.length ? `${entry.known.length} known PoB quirk(s)` : '');

  for (const [category, rows] of Object.entries(entry.diffs)) {
    console.log(`  ${category}: ${rows.length}`);

    for (const row of rows.slice(0, VERBOSE ? rows.length : 3)) {
      console.log(`    ${JSON.stringify(row).slice(0, VERBOSE ? 2000 : 300)}`);
    }
  }
}

console.log(`\nFull report: ${OUT}`);
