<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\BuildPlan;
use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use App\Support\Planner\PlanSchema;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

/**
 * Three fully-populated sample build guides - one Warrior, one Witch, one Ranger - at
 * the fixed slugs "build1"/"build2"/"build3" so they are easy to open while developing.
 *
 * Every phase (all six base acts) is filled the same way, with data resolved live from
 * the GGPK-derived catalogues so nothing can drift from the current patch:
 *   - five skill-gem groups, each an active skill plus at least two support gems;
 *   - a full paper-doll: rare gear whose 3-6 modifiers are real affixes rolled inside
 *     their tier ranges (validated against {@see ModCatalogue::modErrors}), plus unique
 *     flasks and charms and soul-core runes in the socketable slots;
 *   - a connected passive-tree allocation of 50+ points walked out from the class start.
 *
 * A pick that can't be resolved is skipped rather than persisted as a dead reference.
 */
class PlanSeeder extends Seeder
{
    /**
     * The three sample builds. `weapons`/`offhands` list the base categories to try for
     * the main-hand and (for one-handers) the off-hand; each `groups` entry is one skill
     * plus the supports to hang on it.
     *
     * @var list<array{
     *     slug: string,
     *     token: string,
     *     classIndex: int,
     *     className: string,
     *     ascendId: string,
     *     title: string,
     *     description: string,
     *     weapons: list<string>,
     *     offhands: list<string>,
     *     groups: list<array{skill: list<string>, supports: list<string>}>,
     *     notes: array{items: string, gems: string, tree: string}
     * }>
     */
    private const array BUILDS = [
        [
            'slug' => 'build1',
            'token' => 'build1-edit-token',
            'classIndex' => 2,
            'className' => 'Warrior',
            'ascendId' => 'Warrior1',
            'title' => 'Titan Slam - Two-Handed Warrior',
            'description' => "A sturdy melee bruiser that leans on big two-handed slams. Cheap to start, forgiving to play, and it carries on armour and life alone before the rares come online.\n\nGoal: steamroll the campaign, then scale into endgame on a well-rolled mace.",
            'weapons' => ['Mace', 'Axe', 'Sword'],
            'offhands' => ['Shield'],
            'groups' => [
                ['skill' => ['Boneshatter', 'Sunder', 'Mace Strike', 'Hammer'], 'supports' => ['Melee', 'Brutality', 'Magnified', 'Fist of War']],
                ['skill' => ['Earthquake', 'Slam', 'Perfect Strike'], 'supports' => ['Area', 'Impact', 'Rage']],
                ['skill' => ['Leap Slam', 'Shield Charge'], 'supports' => ['Impact', 'Area']],
                ['skill' => ['Herald', 'Warcry', 'Seismic'], 'supports' => ['Magnified', 'Area']],
                ['skill' => ['Totem', 'Ancestral', 'Banner'], 'supports' => ['Melee', 'Brutality']],
            ],
            'notes' => [
                'items' => 'Cap resistances first, then stack armour and life. The mace wants flat physical, added elemental and attack speed; keep two rune sockets free for damage cores.',
                'gems' => 'Lead with a single-target slam and an area slam for packs. War cries and a totem keep uptime high on bosses.',
                'tree' => 'Anchor the strength and life wheels near the Warrior start, then reach for slam-area and armour notables.',
            ],
        ],
        [
            'slug' => 'build2',
            'token' => 'build2-edit-token',
            'classIndex' => 0,
            'className' => 'Witch',
            'ascendId' => 'Witch1',
            'title' => 'Infernalist - Minion Summoner',
            'description' => "Let the army do the work. A minion-focused Witch that stays at range while skeletons and a hulking demon soak the hits.\n\nGoal: a hands-off leveling experience that scales into a comfortable, tanky mapper.",
            'weapons' => ['Wand', 'Sceptre'],
            'offhands' => ['Focii'],
            'groups' => [
                ['skill' => ['Skeletal', 'Raise', 'Summon'], 'supports' => ['Minion', 'Feeding Frenzy', 'Added']],
                ['skill' => ['Bone', 'Detonate', 'Contagion'], 'supports' => ['Spell', 'Controlled']],
                ['skill' => ['Flame', 'Fireball', 'Firestorm'], 'supports' => ['Fire', 'Spell']],
                ['skill' => ['Curse', 'Despair', 'Enfeeble'], 'supports' => ['Area', 'Magnified']],
                ['skill' => ['Herald', 'Grim Feast', 'Bone Offering'], 'supports' => ['Minion', 'Spell']],
            ],
            'notes' => [
                'items' => 'Stack spirit, energy shield and resistances; the minions carry the offence. Keep sockets for spirit or minion runes.',
                'gems' => 'Raise the skeletons and a frontline demon, then layer a curse and an offering to keep the army alive and biting.',
                'tree' => 'Rush minion life and count first, then the spirit and minion-damage clusters on the way out of the Witch start.',
            ],
        ],
        [
            'slug' => 'build3',
            'token' => 'build3-edit-token',
            'classIndex' => 1,
            'className' => 'Ranger',
            'ascendId' => 'Ranger1',
            'title' => 'Deadeye - Lightning Archer',
            'description' => "Fast, ranged, and screen-clearing. A bow Ranger built around lightning conversion and relentless movement.\n\nGoal: kite everything, never stand still, and out-range the danger.",
            'weapons' => ['Bow', 'Crossbow'],
            'offhands' => ['Quiver'],
            'groups' => [
                ['skill' => ['Lightning Arrow', 'Lightning', 'Storm'], 'supports' => ['Lightning', 'Pierce', 'Chain']],
                ['skill' => ['Shot', 'Rain', 'Barrage'], 'supports' => ['Added', 'Fork']],
                ['skill' => ['Herald', 'Mark', 'Wind'], 'supports' => ['Area', 'Magnified']],
                ['skill' => ['Escape', 'Dash', 'Roll'], 'supports' => ['Area', 'Pierce']],
                ['skill' => ['Wither', 'Curse', 'Ballista'], 'supports' => ['Chain', 'Fork']],
            ],
            'notes' => [
                'items' => 'Cap resistances, then chase attack speed, added lightning and movement speed. The bow wants flat damage and crit; socket lightning runes.',
                'gems' => 'Lead with a converted lightning attack for clear, a single-target shot for bosses, and a herald to snowball packs.',
                'tree' => 'Beeline projectile speed and attack speed out of the Ranger start, then the lightning and crit wheels.',
            ],
        ],
    ];

    /** The passive-tree snapshot every seeded allocation is stamped against. */
    private const string TREE_VERSION = '0_5';

    /** Passive points every phase spends (>= the 50 the brief asks for). */
    private const int TREE_POINTS = 60;

    /**
     * Equipment slot => base categories it accepts, mirroring the paper-doll's own slot
     * map. The main-hand/off-hand come from the build recipe instead.
     *
     * @var array<string, list<string>>
     */
    private const array RARE_SLOTS = [
        'helmet' => ['Helmet'],
        'amulet' => ['Amulet'],
        'body' => ['Body Armour'],
        'ring1' => ['Ring'],
        'ring2' => ['Ring'],
        'gloves' => ['Gloves'],
        'boots' => ['Boots'],
        'belt' => ['Belt'],
    ];

    /**
     * Flask/charm slots => their category. These cap at magic in-game (no rare tier), so
     * they take uniques instead of rolled rares.
     *
     * @var array<string, list<string>>
     */
    private const array UNIQUE_SLOTS = [
        'flask1' => ['Life Flask'],
        'flask2' => ['Mana Flask'],
        'charm1' => ['Charm'],
        'charm2' => ['Charm'],
        'charm3' => ['Charm'],
    ];

    /** @var array<int, list<int>>|null Undirected passive-tree adjacency, keyed by skill id. */
    private ?array $adjacency = null;

    /** @var array<int, array<string, mixed>>|null Passive-tree nodes keyed by skill id. */
    private ?array $nodes = null;

    public function run(): void
    {
        $icons = app(IconResolver::class);
        $catalogue = app(ModCatalogue::class);

        foreach (self::BUILDS as $build) {
            $tree = $this->allocateFromStart($build['classIndex'], self::TREE_POINTS);
            $gemGroups = $this->resolveGemGroups($icons, $build['groups']);
            $slots = $this->resolveSlots($icons, $catalogue, $build);

            // All six acts carry the full build; only the note wording is stamped
            // with its phase.
            $tabs = PlanSchema::baseTabs();
            $sections = [];

            foreach ($tabs as $tab) {
                $sections[$tab['id']] = $this->section($tab['label'], $build['notes'], $slots, $gemGroups, $tree);
            }

            $data = PlanSchema::canonicalize([
                'description' => $build['description'],
                'mode' => 'phases',
                'build' => ['className' => $build['className'], 'ascendId' => $build['ascendId']],
                'tabs' => $tabs,
                'sections' => $sections,
            ]);

            BuildPlan::updateOrCreate(
                ['slug' => $build['slug']],
                [
                    'edit_token' => $build['token'],
                    'title' => $build['title'],
                    'schema_version' => PlanSchema::CURRENT_VERSION,
                    'data' => $data,
                ],
            );

            $rares = count(array_filter($slots, static fn (array $item): bool => $item['rarity'] === 'rare'));

            $this->command->info(sprintf(
                'Seeded %s (%s): %d gem groups, %d items (%d rare), %d passive points × %d phases. Edit token: %s',
                $build['slug'],
                $build['className'],
                count($gemGroups),
                count($slots),
                $rares,
                count($tree['allocated']),
                count($tabs),
                $build['token'],
            ));
        }
    }

    /**
     * One phase section: notes (stamped with the phase label) plus the full items, gems
     * and tree payloads.
     *
     * @param  array{items: string, gems: string, tree: string}  $notes
     * @param  array<string, mixed>  $slots
     * @param  list<array{id: string, gems: list<array{type: string, id: string}>}>  $gemGroups
     * @param  array{allocated: list<int>, notables: list<int>}  $tree
     * @return array<string, mixed>
     */
    private function section(string $phase, array $notes, array $slots, array $gemGroups, array $tree): array
    {
        return [
            'items' => ['notes' => "{$phase} - {$notes['items']}", 'slots' => $slots],
            'gems' => ['notes' => "{$phase} - {$notes['gems']}", 'groups' => $gemGroups],
            'tree' => [
                'notes' => "{$phase} - {$notes['tree']}",
                'allocation' => [
                    'allocated' => $tree['allocated'],
                    'treeVersion' => self::TREE_VERSION,
                ],
                'notablePriority' => $tree['notables'],
            ],
        ];
    }

    /* ------------------------------------------------------------------- gems */

    /** Support gems per group: an active skill plus this many supports. */
    private const int SUPPORTS_PER_GROUP = 3;

    /**
     * Resolve each recipe group to real gem ids: an active skill plus its supports. The
     * recipe's thematic supports come first; any shortfall is topped up from the live
     * support pool so every group carries {@see SUPPORTS_PER_GROUP}. Groups whose skill
     * can't be resolved are dropped.
     *
     * @param  list<array{skill: list<string>, supports: list<string>}>  $groups
     * @return list<array{id: string, gems: list<array{type: string, id: string}>}>
     */
    private function resolveGemGroups(IconResolver $icons, array $groups): array
    {
        $pool = $this->collectSupports($icons);
        $cursor = 0;
        $result = [];

        foreach ($groups as $index => $group) {
            $skill = $this->pickGem($icons, $group['skill'], 'skill');

            if ($skill === null) {
                continue;
            }

            $gems = [['type' => 'gem', 'id' => $skill]];
            $used = [$skill];

            // Thematic supports first.
            foreach ($group['supports'] as $query) {
                if (count($gems) > self::SUPPORTS_PER_GROUP) {
                    break;
                }

                $support = $this->pickGem($icons, [$query], 'support', $used);

                if ($support !== null) {
                    $used[] = $support;
                    $gems[] = ['type' => 'gem', 'id' => $support];
                }
            }

            // Top up from the pool until the group is full (supports may repeat across
            // groups, never within one).
            for ($seen = 0; count($gems) <= self::SUPPORTS_PER_GROUP && $seen < count($pool); $seen++) {
                $candidate = $pool[$cursor % count($pool)];
                $cursor++;

                if (! in_array($candidate, $used, true)) {
                    $used[] = $candidate;
                    $gems[] = ['type' => 'gem', 'id' => $candidate];
                }
            }

            $result[] = ['id' => 'g-'.($index + 1), 'gems' => $gems];
        }

        return $result;
    }

    /**
     * A pool of distinct support-gem ids, gathered broadly so every group can be filled
     * even when a recipe's thematic supports don't all resolve.
     *
     * @return list<string>
     */
    private function collectSupports(IconResolver $icons): array
    {
        $pool = [];

        foreach (['a', 'e', 'i', 'o', 'r', 's', 't', 'n', 'l', 'm'] as $letter) {
            foreach ($icons->searchReferences($letter, ['gem'], [], 'support', 40) as $match) {
                if (! in_array($match['id'], $pool, true)) {
                    $pool[] = (string) $match['id'];
                }
            }
        }

        return $pool;
    }

    /**
     * The first gem id matching any candidate query (of the given kind) not already used.
     *
     * @param  list<string>  $queries
     * @param  list<string>  $exclude
     */
    private function pickGem(IconResolver $icons, array $queries, string $kind, array $exclude = []): ?string
    {
        foreach ($queries as $query) {
            foreach ($icons->searchReferences($query, ['gem'], [], $kind) as $match) {
                if (! in_array($match['id'], $exclude, true)) {
                    return (string) $match['id'];
                }
            }
        }

        return null;
    }

    /* ------------------------------------------------------------------ items */

    /**
     * Fill the whole paper-doll: rare weapon (plus a rare off-hand when the main-hand is
     * one-handed), rare armour and jewellery, and unique flasks/charms. Soul-core runes
     * drop into the socketable slots. Every item gets a distinct gearing priority.
     *
     * @param  array{weapons: list<string>, offhands: list<string>}  $build
     * @return array<string, array<string, mixed>>
     */
    private function resolveSlots(IconResolver $icons, ModCatalogue $catalogue, array $build): array
    {
        $slots = [];
        $usedBases = [];
        $usedUniques = [];
        $priority = 1;

        $weapon = $this->pickBase($icons, $build['weapons'], $usedBases);

        if ($weapon !== null) {
            $usedBases[] = $weapon;
            $slots['weapon1'] = $this->rareItem($icons, $catalogue, $weapon, $priority++);

            // A one-handed main-hand leaves room for an off-hand; a two-hander claims it.
            if (! $icons->isTwoHanded($weapon)) {
                $offhand = $this->pickBase($icons, $build['offhands'], $usedBases);

                if ($offhand !== null) {
                    $usedBases[] = $offhand;
                    $slots['weapon2'] = $this->rareItem($icons, $catalogue, $offhand, $priority++);
                }
            }
        }

        foreach (self::RARE_SLOTS as $slot => $categories) {
            $base = $this->pickBase($icons, $categories, $usedBases);

            if ($base !== null) {
                $usedBases[] = $base;
                $slots[$slot] = $this->rareItem($icons, $catalogue, $base, $priority++);
            }
        }

        foreach (self::UNIQUE_SLOTS as $slot => $categories) {
            $unique = $this->pickUnique($icons, $categories, $usedUniques);

            if ($unique !== null) {
                $usedUniques[] = $unique;
                $slots[$slot] = [
                    'rarity' => 'unique',
                    'base' => ['type' => 'unique', 'id' => $unique],
                    'priority' => $priority++,
                ];
            }
        }

        return $this->socketRunes($icons, $slots);
    }

    /**
     * Build one rare item on a base: 3-6 real affixes rolled inside their tier ranges,
     * one per mutual-exclusion family, capped at three prefixes and three suffixes.
     *
     * @return array<string, mixed>
     */
    private function rareItem(IconResolver $icons, ModCatalogue $catalogue, string $base, int $priority): array
    {
        return [
            'rarity' => 'rare',
            'base' => ['type' => 'base', 'id' => $base],
            'stats' => $this->rollAffixes($icons, $catalogue, $base),
            'priority' => $priority,
        ];
    }

    /**
     * Roll up to three prefixes and three suffixes for a base: each a distinct affix from
     * a distinct family, valued at the midpoint of a mid tier so it always sits inside the
     * range {@see ModCatalogue::modErrors} enforces.
     *
     * @return list<array{modId: string, values: list<int>}>
     */
    private function rollAffixes(IconResolver $icons, ModCatalogue $catalogue, string $base): array
    {
        $domain = $icons->itemModDomain($base);
        $tags = $icons->itemTags($base);
        $groups = $catalogue->search($domain, $tags, '', 300);

        $byType = ['prefix' => [], 'suffix' => []];

        foreach ($groups as $group) {
            if (isset($byType[$group['type']])) {
                $byType[$group['type']][] = $group;
            }
        }

        $stats = [];
        $usedFamilies = [];

        foreach (['prefix', 'suffix'] as $type) {
            $count = 0;

            foreach ($byType[$type] as $group) {
                if ($count >= 3) {
                    break;
                }

                $tiers = $group['tiers'];

                if ($tiers === []) {
                    continue;
                }

                $tier = $tiers[intdiv(count($tiers), 2)];

                if (array_intersect($tier['families'], $usedFamilies) !== []) {
                    continue;
                }

                $values = array_map(
                    static fn (array $roll): int => intdiv($roll['min'] + $roll['max'], 2),
                    $tier['rolls'],
                );

                $stats[] = ['modId' => $tier['id'], 'values' => $values];
                $usedFamilies = [...$usedFamilies, ...$tier['families']];
                $count++;
            }
        }

        return $stats;
    }

    /**
     * The first normal base across the given categories not already used, or null.
     *
     * @param  list<string>  $categories
     * @param  list<string>  $used
     */
    private function pickBase(IconResolver $icons, array $categories, array $used): ?string
    {
        foreach ($categories as $category) {
            foreach (['a', 'e', 'i', 'o', 'u', 'r', 's', 't'] as $letter) {
                foreach ($icons->searchReferences($letter, ['base'], [$category], null, 40) as $match) {
                    if (! in_array($match['id'], $used, true)) {
                        return (string) $match['id'];
                    }
                }
            }
        }

        return null;
    }

    /**
     * The first unique across the given categories not already used, or null.
     *
     * @param  list<string>  $categories
     * @param  list<string>  $used
     */
    private function pickUnique(IconResolver $icons, array $categories, array $used): ?string
    {
        foreach ($categories as $category) {
            foreach (['a', 'e', 'i', 'o', 'b', 'c', 'd', 'h', 's', 't'] as $letter) {
                foreach ($icons->searchReferences($letter, ['unique'], [$category], null, 40) as $match) {
                    if (! in_array($match['id'], $used, true)) {
                        return (string) $match['id'];
                    }
                }
            }
        }

        return null;
    }

    /**
     * Drop distinct soul cores into the socketable slots: two in the body, one in the
     * main-hand - matching the paper-doll's per-slot socket ceilings.
     *
     * @param  array<string, array<string, mixed>>  $slots
     * @return array<string, array<string, mixed>>
     */
    private function socketRunes(IconResolver $icons, array $slots): array
    {
        $runes = $this->pickRunes($icons, 3);

        if ($runes === []) {
            return $slots;
        }

        if (isset($slots['body'])) {
            $slots['body']['sockets'] = array_map(
                static fn (string $id): array => ['type' => 'rune', 'id' => $id],
                array_slice($runes, 0, 2),
            );
        }

        if (isset($slots['weapon1'])) {
            $slots['weapon1']['sockets'] = [['type' => 'rune', 'id' => $runes[0]]];
        }

        return $slots;
    }

    /**
     * Up to `$count` distinct rune (soul core) ids.
     *
     * @return list<string>
     */
    private function pickRunes(IconResolver $icons, int $count): array
    {
        $runes = [];

        foreach (['of', 'the', 'idol', 'ire', 'core', 'rune'] as $query) {
            foreach ($icons->searchReferences($query, ['rune'], [], null, 40) as $match) {
                if (! in_array($match['id'], $runes, true)) {
                    $runes[] = (string) $match['id'];

                    if (count($runes) >= $count) {
                        return $runes;
                    }
                }
            }
        }

        return $runes;
    }

    /* ------------------------------------------------------------------- tree */

    /**
     * Walk a connected allocation out from a class's start node: a breadth-first sweep
     * over the basic tree (skipping ascendancy, class-start, mastery and jewel-socket
     * nodes) collecting up to `$count` nodes. The notables reached, in order, become the
     * notable priority.
     *
     * @return array{allocated: list<int>, notables: list<int>}
     */
    private function allocateFromStart(int $classIndex, int $count): array
    {
        $this->loadTree();
        $start = $this->classStartNode($classIndex);

        $allocated = [];
        $notables = [];
        $seen = [$start => true];
        $queue = $this->adjacency[$start] ?? [];

        while ($queue !== [] && count($allocated) < $count) {
            $skill = (int) array_shift($queue);

            if (isset($seen[$skill])) {
                continue;
            }

            $seen[$skill] = true;
            $node = $this->nodes[$skill] ?? null;

            if ($node === null || ! $this->isAllocatable($node)) {
                continue;
            }

            $allocated[] = $skill;

            if (! empty($node['isNotable']) || ! empty($node['isKeystone'])) {
                $notables[] = $skill;
            }

            foreach ($this->adjacency[$skill] ?? [] as $next) {
                if (! isset($seen[(int) $next])) {
                    $queue[] = (int) $next;
                }
            }
        }

        return ['allocated' => $allocated, 'notables' => $notables];
    }

    /**
     * Whether a node is a normal allocatable passive (not an ascendancy, class start,
     * mastery or jewel socket).
     *
     * @param  array<string, mixed>  $node
     */
    private function isAllocatable(array $node): bool
    {
        return ! isset($node['ascendancyId'])
            && ! isset($node['classStartIndex'])
            && empty($node['isMastery'])
            && empty($node['isJewelSocket']);
    }

    /**
     * The start-node skill id for a class index (one node can seed several classes).
     */
    private function classStartNode(int $classIndex): int
    {
        foreach ($this->nodes as $skill => $node) {
            $starts = $node['classStartIndex'] ?? null;

            if (is_array($starts) && in_array($classIndex, $starts, true)) {
                return (int) $skill;
            }
        }

        throw new \RuntimeException("No start node for class index {$classIndex}.");
    }

    /**
     * Load the GGPK-derived passive tree once: nodes keyed by skill id plus an undirected
     * adjacency from each node's in/out edges.
     */
    private function loadTree(): void
    {
        if ($this->nodes !== null) {
            return;
        }

        /** @var array{nodes: array<int|string, array<string, mixed>>} $data */
        $data = json_decode(File::get(public_path('tree/current/data.json')), true);

        $nodes = [];
        $adjacency = [];

        foreach ($data['nodes'] as $skill => $node) {
            $id = (int) $skill;
            $nodes[$id] = $node;
            $out = is_array($node['out'] ?? null) ? $node['out'] : [];
            $in = is_array($node['in'] ?? null) ? $node['in'] : [];
            $adjacency[$id] = array_values(array_unique(array_map(intval(...), [...$out, ...$in])));
        }

        $this->nodes = $nodes;
        $this->adjacency = $adjacency;
    }
}
