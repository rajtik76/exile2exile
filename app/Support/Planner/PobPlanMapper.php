<?php

declare(strict_types=1);

namespace App\Support\Planner;

use App\Pob\Data\BuildSnapshot;
use App\Pob\Data\EquippedItem;
use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Turns a decoded {@see BuildSnapshot} (from a PoB export or pobb.in link) into the
 * build planner's stored JSON shape - a fresh single-mode plan carrying the build's
 * class/ascendancy, its passive-tree allocation, its gem groups and its equipment.
 *
 * The mapping is exact where the snapshot already carries GGPK identifiers (passive
 * node ids, gem ids, base-type and rune names) and best-effort where it carries only
 * PoB's rendered mod text: an item's author modifiers are reverse-matched against the
 * GGPK affix catalogue ({@see ModCatalogue}) and any line that doesn't resolve to a
 * known affix with an in-range roll is dropped, so the produced plan is always valid
 * (it passes the same {@see PlanSchema}/{@see ModCatalogue} rules the editor enforces).
 * Uniques carry their own mods in-game, so their author-mod lines are never mapped.
 *
 * The result is pre-canonical: the caller runs it through {@see PlanSchema::canonicalize}
 * before storing, which drops empty items/slots and normalises everything else.
 */
final class PobPlanMapper
{
    /**
     * PoB's equipment slot names mapped to the planner's slot keys. Weapon-swap slots,
     * the third ring and any flask/charm beyond the planner's paper-doll are dropped
     * (they have no home in the fixed slot set).
     *
     * @var array<string, string>
     */
    private const array SLOT_MAP = [
        'Weapon 1' => 'weapon1',
        'Weapon 2' => 'weapon2',
        'Helmet' => 'helmet',
        'Body Armour' => 'body',
        'Gloves' => 'gloves',
        'Boots' => 'boots',
        'Amulet' => 'amulet',
        'Ring 1' => 'ring1',
        'Ring 2' => 'ring2',
        'Belt' => 'belt',
        'Flask 1' => 'flask1',
        'Flask 2' => 'flask2',
        'Charm 1' => 'charm1',
        'Charm 2' => 'charm2',
        'Charm 3' => 'charm3',
    ];

    /** Most prefixes/most suffixes an imported item keeps, per rarity. */
    private const array MODS_PER_TYPE = ['normal' => 0, 'magic' => 1, 'rare' => 3];

    /**
     * @var array<string, string>|null "class|ascendancy" (both lowercased) => the tree's
     *                                 ascendancy id, built once from the tree data.
     */
    private ?array $ascendancyIndex = null;

    /**
     * Author-mod lines the last {@see map} could not reverse-match to a GGPK affix, kept
     * per planner slot so the caller can tell the author what the import left off (a
     * hybrid it can't split, quality-inflated defences, unknown wording).
     *
     * @var array<string, list<string>>
     */
    private array $droppedMods = [];

    public function __construct(
        private readonly IconResolver $icons,
        private readonly ModCatalogue $mods,
    ) {}

    /**
     * The pre-canonical plan data for an imported build: single mode, one section set
     * holding the tree, gems and equipment.
     *
     * @return array<string, mixed>
     */
    public function map(BuildSnapshot $snapshot): array
    {
        $this->droppedMods = [];

        return [
            'description' => 'Imported from Path of Building.',
            'mode' => 'single',
            'build' => [
                // The class is identified by name (PoB's numeric classId is not stable
                // across versions); the ascendancy is resolved to the live tree id the
                // planner stores.
                'className' => $snapshot->class->value,
                'ascendId' => $this->ascendId($snapshot),
            ],
            'tabs' => PlanSchema::initialTabs(),
            'sections' => [
                PlanSchema::SINGLE_KEY => [
                    'tree' => ['allocation' => $this->allocation($snapshot)],
                    'gems' => ['groups' => $this->gemGroups($snapshot)],
                    'items' => ['slots' => $this->slots($snapshot)],
                ],
            ],
        ];
    }

    /**
     * The author-mod lines the last {@see map} dropped, keyed by planner slot, in the
     * order they appeared on the item. Empty when everything mapped. Read after map().
     *
     * @return array<string, list<string>>
     */
    public function droppedMods(): array
    {
        return $this->droppedMods;
    }

    /**
     * A concise default title from the build's identity: its ascendancy (or class) and
     * level, e.g. "Blood Mage · Level 80".
     */
    public function title(BuildSnapshot $snapshot): string
    {
        $identity = $snapshot->ascendancy !== null
            ? $snapshot->ascendancy->value
            : $snapshot->class->value;

        return Str::limit("{$identity} · Level {$snapshot->level}", 120, '');
    }

    /**
     * The snapshot's passive allocation in the planner's shape: allocated node ids, the
     * per-node attribute choices (inverted from the snapshot's per-attribute lists),
     * weapon-set tags, socketed jewels and the tree version.
     *
     * @return array{allocated: list<int>, attributeChoices: array<int, string>, weaponSets: array<int, int>, jewels: array<int, mixed>, treeVersion: string}
     */
    private function allocation(BuildSnapshot $snapshot): array
    {
        $attributeChoices = [];

        foreach ($snapshot->attributeNodes as $attribute => $nodeIds) {
            foreach ($nodeIds as $nodeId) {
                $attributeChoices[$nodeId] = $attribute;
            }
        }

        return [
            'allocated' => $snapshot->passiveNodes,
            'attributeChoices' => $attributeChoices,
            'weaponSets' => $snapshot->weaponSets,
            'jewels' => $snapshot->jewels,
            'treeVersion' => $snapshot->treeVersion,
        ];
    }

    /**
     * The build's skill groups as the planner's visual gem groups: each group's gems in
     * source order (the active skill first, then its supports), keeping only gems whose
     * id resolves to a known GGPK gem.
     *
     * @return list<array{id: string, gems: list<array{type: string, id: string}>}>
     */
    private function gemGroups(BuildSnapshot $snapshot): array
    {
        $groups = [];

        foreach ($snapshot->skillGroups as $index => $group) {
            $gems = [];

            foreach ($group->gems as $gem) {
                if ($gem->gemId !== null && $this->icons->resolveReference('gem', $gem->gemId) !== null) {
                    $gems[] = ['type' => 'gem', 'id' => $gem->gemId];
                }
            }

            if ($gems !== []) {
                $groups[] = ['id' => 'g-'.($index + 1), 'gems' => $gems];
            }
        }

        return $groups;
    }

    /**
     * The build's equipped items as the planner's slot map: known slots only, each
     * turned into a planner item (base/unique reference, requirements, matched author
     * modifiers and rune sockets).
     *
     * @return array<string, array<string, mixed>>
     */
    private function slots(BuildSnapshot $snapshot): array
    {
        $slots = [];

        foreach ($snapshot->items as $item) {
            $slotKey = self::SLOT_MAP[$item->slot] ?? null;

            if ($slotKey === null) {
                continue;
            }

            $slots[$slotKey] = $this->item($item, $slotKey);
        }

        return $slots;
    }

    /**
     * One equipped item in the planner's shape. A unique carries its own modifiers in
     * game, so its author-mod lines are left off; a base/magic/rare item keeps the
     * reverse-matched affixes that resolve. Level requirement and defensive properties
     * (quality, armour, evasion, energy shield, block) come across for every rarity.
     *
     * @return array{rarity: string, base: array{type: string, id: string}|null, req: array{level: int}, props: array{quality: int, armour: int, evasion: int, energyShield: int, block: int}, stats: list<array{modId: string, values: list<int|float>}>, sockets: list<array{type: string, id: string}>}
     */
    private function item(EquippedItem $item, string $slotKey): array
    {
        $rarity = $this->rarity($item->rarity);
        $isUnique = $rarity === 'unique';
        $base = $this->baseReference($item, $isUnique);

        return [
            'rarity' => $rarity,
            'base' => $base,
            'req' => ['level' => $item->levelRequirement ?? 0],
            // The item's computed defensive properties as the game shows them; block is
            // only present on shields. Carried for every rarity - for a unique these are
            // the only way to record its defences (the planner holds no base defence data).
            'props' => [
                'quality' => $item->quality ?? 0,
                'armour' => $item->armour ?? 0,
                'evasion' => $item->evasion ?? 0,
                'energyShield' => $item->energyShield ?? 0,
                'block' => $item->block ?? 0,
            ],
            'stats' => $isUnique ? [] : $this->matchMods($item, $rarity, $slotKey),
            'sockets' => $this->sockets($item),
        ];
    }

    /**
     * The item's base/unique reference: a unique points at the unique by name, everything
     * else at its base type. Null when neither is a known GGPK item (a defunct or
     * mis-parsed name), which drops the reference but keeps any mods/runes the item has.
     *
     * @return array{type: string, id: string}|null
     */
    private function baseReference(EquippedItem $item, bool $isUnique): ?array
    {
        if ($isUnique && $this->icons->isUnique($item->name) === true) {
            return ['type' => 'unique', 'id' => $item->name];
        }

        if ($this->icons->isBaseType($item->baseType)) {
            return ['type' => 'base', 'id' => $item->baseType];
        }

        return null;
    }

    /**
     * Reverse-match an item's rendered author-mod lines to GGPK affix ids. Lines are read
     * in order and matched against the affixes that can roll on the item's base, picking
     * the tier whose value range(s) contain the rolled value(s). A hybrid affix renders as
     * several consecutive PoB lines, so a multi-stat candidate is matched over that many
     * lines at once (the longest match wins, so a hybrid's first line isn't stolen by a
     * single-stat affix). Per-rarity prefix/suffix caps and mutual-exclusion families are
     * respected, so the result always passes {@see ModCatalogue::modErrors}. Lines that
     * don't resolve (unknown wording, out-of-range rolls, a hybrid whose lines don't all
     * fit) are recorded as dropped for the slot and left off.
     *
     * @return list<array{modId: string, values: list<int|float>}>
     */
    private function matchMods(EquippedItem $item, string $rarity, string $slotKey): array
    {
        $lines = $item->explicitMods();
        $maxPerType = self::MODS_PER_TYPE[$rarity] ?? 0;
        $domain = $this->icons->itemModDomain($item->baseType);
        $tags = $this->icons->itemTags($item->baseType);

        if ($maxPerType === 0 || $domain === null || $tags === []) {
            $this->recordDropped($slotKey, $lines);

            return [];
        }

        $candidates = $this->candidateAffixes($domain, $tags);

        $context = [
            'stats' => [],
            'counts' => ['prefix' => 0, 'suffix' => 0],
            'families' => [],
        ];
        $unmatched = [];

        // Collect each rendered line's viable affix matches. A line can fit both a prefix
        // and a suffix (e.g. "increased Rarity of Items found" exists as either), so every
        // viable type is recorded rather than one being picked arbitrarily.
        $pending = [];
        $index = 0;

        while ($index < count($lines)) {
            $options = $this->matchOptions($lines, $index, $candidates);

            if ($options === null) {
                $unmatched[] = $lines[$index];
                $index++;

                continue;
            }

            $pending[] = $options;
            $index += $options['statCount'];
        }

        // Assign the mods that can only be one type first and the ambiguous ones (a prefix
        // and a suffix both fit) last, so a two-way mod takes whichever slot the definite
        // mods leave open - mirroring how a legal item must split into its 3 + 3.
        usort($pending, static fn (array $a, array $b): int => count($a['options']) <=> count($b['options']));

        foreach ($pending as $entry) {
            $chosen = null;

            foreach ($entry['options'] as $type => $option) {
                if (($context['counts'][$type] ?? 0) < $maxPerType
                    && array_intersect($option['families'], $context['families']) === []) {
                    $chosen = [$type, $option];
                    break;
                }
            }

            if ($chosen === null) {
                $unmatched = [...$unmatched, ...$entry['lines']];

                continue;
            }

            [$type, $option] = $chosen;
            $context['counts'][$type]++;
            $context['families'] = [...$context['families'], ...$option['families']];
            $context['stats'][] = ['modId' => $option['id'], 'values' => $option['values']];
        }

        // A line whose value tops every single tier is a summed (aggregate) line, as the
        // game renders same-stat mods added together. Try to split it back into a pure
        // affix plus a hybrid, sharing the hybrid's other stat with its own summed line.
        $unmatched = $this->decomposeAggregates($unmatched, $lines, $candidates, $maxPerType, $context);

        $this->recordDropped($slotKey, $unmatched);

        return $context['stats'];
    }

    /**
     * Split summed defence lines back into real affixes. A line like "135% increased Armour
     * and Evasion" tops the 110% ceiling of any single affix because the game adds every
     * mod's same-stat roll together; the true item is a pure affix plus a hybrid (e.g.
     * Legend's 94% + Predator's 41% + its +46 life). For each still-unmatched line whose
     * value exceeds the highest pure tier, this looks for a two-stat hybrid whose second
     * stat also appears as its own summed line, then picks rolls so both remainders land in
     * real pure tiers - emitting the pure affix, the hybrid, and the companion's pure affix
     * (replacing whatever single match the companion line first got). Lines it can't split
     * are returned still unmatched. Best-effort: the split's exact tiers aren't recoverable
     * from a sum, but the totals match what the game shows.
     *
     * @param  list<string>  $unmatched
     * @param  list<string>  $lines
     * @param  list<array{id: string, type: string, statCount: int, template: string, statTemplates: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>}>  $candidates
     * @param  array{stats: list<array{modId: string, values: list<int|float>}>, counts: array<string, int>, families: list<string>}  $context
     * @return list<string> the lines still unmatched after decomposition
     */
    private function decomposeAggregates(array $unmatched, array $lines, array $candidates, int $maxPerType, array &$context): array
    {
        $aggregates = $this->aggregateValues($lines);
        $stillUnmatched = [];

        foreach ($unmatched as $line) {
            $template = self::template($line);
            $values = self::numbers($line);

            if (count($values) !== 1 || $values[0] <= $this->pureCeiling($candidates, $template)) {
                $stillUnmatched[] = $line;

                continue;
            }

            $split = $this->splitAggregate($template, $values[0], $aggregates, $candidates, $maxPerType, $context);

            if ($split === null) {
                $stillUnmatched[] = $line;
            }
        }

        return $stillUnmatched;
    }

    /**
     * Parse the item's single-value lines into a template => summed value map (the game's
     * per-stat aggregate lines), so a hybrid's companion stat can be looked up by wording.
     *
     * @param  list<string>  $lines
     * @return array<string, int|float>
     */
    private function aggregateValues(array $lines): array
    {
        $aggregates = [];

        foreach ($lines as $line) {
            $values = self::numbers($line);

            if (count($values) === 1) {
                $aggregates[self::template($line)] = $values[0];
            }
        }

        return $aggregates;
    }

    /**
     * The highest value any single pure (one-stat) affix of a template can roll - the
     * ceiling above which a rendered line must be a sum of several mods.
     *
     * @param  list<array{statCount: int, template: string, rolls: list<array{stat: string, min: int, max: int}>}>  $candidates
     */
    private function pureCeiling(array $candidates, string $template): int
    {
        $ceiling = 0;

        foreach ($candidates as $candidate) {
            if ($candidate['statCount'] === 1 && $candidate['template'] === $template) {
                $ceiling = max($ceiling, $candidate['rolls'][0]['max']);
            }
        }

        return $ceiling;
    }

    /**
     * Try to explain a summed line (template @ total) as pure + one two-stat hybrid whose
     * companion stat is another summed line. On success it mutates {@see $context} -
     * dropping the companion's original single match, adding the pure affix, the hybrid and
     * the companion's pure affix - and returns true; otherwise returns null and changes
     * nothing. Respects the per-type cap and one-mod-per-family rule.
     *
     * @param  array<string, int|float>  $aggregates
     * @param  list<array{id: string, type: string, statCount: int, template: string, statTemplates: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>}>  $candidates
     * @param  array{stats: list<array{modId: string, values: list<int|float>}>, counts: array<string, int>, families: list<string>}  $context
     */
    private function splitAggregate(string $template, int|float $total, array $aggregates, array $candidates, int $maxPerType, array &$context): ?bool
    {
        foreach ($candidates as $hybrid) {
            if ($hybrid['statCount'] !== 2 || ! in_array($template, $hybrid['statTemplates'], true)) {
                continue;
            }

            $primaryIndex = array_search($template, $hybrid['statTemplates'], true);

            if ($primaryIndex === false) {
                continue;
            }

            $companionIndex = 1 - $primaryIndex;
            $companionTemplate = $hybrid['statTemplates'][$companionIndex];

            if (! array_key_exists($companionTemplate, $aggregates)) {
                continue;
            }

            $primaryRoll = $hybrid['rolls'][$primaryIndex];
            $companionRoll = $hybrid['rolls'][$companionIndex];
            $companionTotal = $aggregates[$companionTemplate];

            // Pick the hybrid's own rolls so both summed lines split into real pure tiers.
            for ($primary = $primaryRoll['min']; $primary <= $primaryRoll['max']; $primary++) {
                $purePrimary = $this->pureTier($candidates, $template, $total - $primary);

                if ($purePrimary === null) {
                    continue;
                }

                for ($companion = $companionRoll['min']; $companion <= $companionRoll['max']; $companion++) {
                    $pureCompanion = $this->pureTier($candidates, $companionTemplate, $companionTotal - $companion);

                    if ($pureCompanion === null) {
                        continue;
                    }

                    $additions = [
                        ['modId' => $purePrimary, 'values' => [$total - $primary], 'type' => $hybrid['type'], 'families' => $this->familiesOf($candidates, $purePrimary)],
                        ['modId' => $pureCompanion, 'values' => [$companionTotal - $companion], 'type' => $hybrid['type'], 'families' => $this->familiesOf($candidates, $pureCompanion)],
                        ['modId' => $hybrid['id'], 'values' => $this->orderedValues($hybrid, $primaryIndex, $primary, $companion), 'type' => $hybrid['type'], 'families' => $hybrid['families']],
                    ];

                    if ($this->applySplit($companionTemplate, $additions, $maxPerType, $candidates, $context)) {
                        return true;
                    }
                }
            }
        }

        return null;
    }

    /**
     * A hybrid's rolled values in its own stat order, from the chosen primary/companion.
     *
     * @param  array{statCount: int}  $hybrid
     * @return list<int|float>
     */
    private function orderedValues(array $hybrid, int $primaryIndex, int|float $primary, int|float $companion): array
    {
        return $primaryIndex === 0 ? [$primary, $companion] : [$companion, $primary];
    }

    /**
     * Commit a decomposition: drop the companion template's original single match, add the
     * pure + hybrid + companion-pure mods, and update counts/families - but only if the
     * result still fits the per-type cap and every family stays unique. Returns whether it
     * was applied.
     *
     * @param  list<array{modId: string, values: list<int|float>, type: string, families: list<string>}>  $additions
     * @param  list<array{id: string, type: string, template: string, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>}>  $candidates
     * @param  array{stats: list<array{modId: string, values: list<int|float>}>, counts: array<string, int>, families: list<string>}  $context
     */
    private function applySplit(string $companionTemplate, array $additions, int $maxPerType, array $candidates, array &$context): bool
    {
        // The companion line first matched as a single pure mod; that mod is now the
        // hybrid + a smaller pure, so drop it before re-counting.
        $keptStats = [];
        $counts = $context['counts'];
        $families = [];

        foreach ($context['stats'] as $stat) {
            if ($this->modTemplate($candidates, $stat['modId']) === $companionTemplate) {
                $counts[$this->modType($candidates, $stat['modId'])]--;

                continue;
            }

            $keptStats[] = $stat;
            $families = [...$families, ...$this->familiesOf($candidates, $stat['modId'])];
        }

        foreach ($additions as $addition) {
            $counts[$addition['type']] = ($counts[$addition['type']] ?? 0) + 1;
            $families = [...$families, ...$addition['families']];
        }

        if ($counts['prefix'] > $maxPerType || $counts['suffix'] > $maxPerType) {
            return false;
        }

        if (count($families) !== count(array_unique($families))) {
            return false;
        }

        foreach ($additions as $addition) {
            $keptStats[] = ['modId' => $addition['modId'], 'values' => $addition['values']];
        }

        $context['stats'] = $keptStats;
        $context['counts'] = $counts;
        $context['families'] = $families;

        return true;
    }

    /**
     * The id of a pure (one-stat) affix of a template whose tier range contains a value, or
     * null when no tier fits (or the value is non-positive).
     *
     * @param  list<array{id: string, statCount: int, template: string, rolls: list<array{stat: string, min: int, max: int}>}>  $candidates
     */
    private function pureTier(array $candidates, string $template, int|float $value): ?string
    {
        if ($value <= 0) {
            return null;
        }

        foreach ($candidates as $candidate) {
            if ($candidate['statCount'] === 1
                && $candidate['template'] === $template
                && $value >= $candidate['rolls'][0]['min']
                && $value <= $candidate['rolls'][0]['max']) {
                return $candidate['id'];
            }
        }

        return null;
    }

    /**
     * @param  list<array{id: string, families: list<string>}>  $candidates
     * @return list<string>
     */
    private function familiesOf(array $candidates, string $modId): array
    {
        foreach ($candidates as $candidate) {
            if ($candidate['id'] === $modId) {
                return $candidate['families'];
            }
        }

        return [];
    }

    /**
     * @param  list<array{id: string, template: string}>  $candidates
     */
    private function modTemplate(array $candidates, string $modId): ?string
    {
        foreach ($candidates as $candidate) {
            if ($candidate['id'] === $modId) {
                return $candidate['template'];
            }
        }

        return null;
    }

    /**
     * @param  list<array{id: string, type: string}>  $candidates
     */
    private function modType(array $candidates, string $modId): string
    {
        foreach ($candidates as $candidate) {
            if ($candidate['id'] === $modId) {
                return $candidate['type'];
            }
        }

        return 'prefix';
    }

    /**
     * The affixes that can roll on a base (its domain + tags), each flattened to a matchable
     * candidate: its stat count, the number-free template of its stat line(s) joined in text
     * order, its tier roll ranges, its generation type and its mutual-exclusion families. A
     * multi-stat (hybrid) affix keeps all its lines so it can be matched over the same number
     * of consecutive PoB lines.
     *
     * @param  list<string>  $tags
     * @return list<array{id: string, type: string, statCount: int, template: string, statTemplates: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>}>
     */
    private function candidateAffixes(string $domain, array $tags): array
    {
        $candidates = [];

        foreach ($this->mods->search($domain, $tags, '') as $group) {
            foreach ($group['tiers'] as $tier) {
                $statTemplates = array_map(self::template(...), $tier['stats']);

                $candidates[] = [
                    'id' => $tier['id'],
                    'type' => $group['type'],
                    'statCount' => count($tier['stats']),
                    'template' => implode("\n", $statTemplates),
                    // The per-stat-line templates, so a hybrid can be reasoned about one
                    // stat at a time (which of its stats a summed line belongs to).
                    'statTemplates' => $statTemplates,
                    'rolls' => $tier['rolls'],
                    'families' => $tier['families'],
                ];
            }
        }

        return $candidates;
    }

    /**
     * The affix matches for the run of lines starting at $index: a candidate of N stats
     * matches when the next N lines share its number-free template and their rolled values
     * all sit in the tier's ranges. The longest match wins (a hybrid isn't pre-empted by a
     * single-stat affix matching only its first line), and every viable generation type is
     * returned - one per type - so an ambiguous line (both a prefix and a suffix fit) can be
     * assigned its type later. Null when nothing fits.
     *
     * @param  list<string>  $lines
     * @param  list<array{id: string, type: string, statCount: int, template: string, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>}>  $candidates
     * @return array{statCount: int, lines: list<string>, options: array<string, array{id: string, values: list<int|float>, families: list<string>}>}|null
     */
    private function matchOptions(array $lines, int $index, array $candidates): ?array
    {
        $viable = [];

        foreach ($candidates as $candidate) {
            $statCount = $candidate['statCount'];

            if ($index + $statCount > count($lines)) {
                continue;
            }

            $window = array_slice($lines, $index, $statCount);
            $template = implode("\n", array_map(self::template(...), $window));

            if ($candidate['template'] !== $template) {
                continue;
            }

            $values = self::numbers(implode("\n", $window));

            if (self::valuesInRange($candidate['rolls'], $values)) {
                $viable[] = [
                    'statCount' => $statCount,
                    'type' => $candidate['type'],
                    'id' => $candidate['id'],
                    'values' => $values,
                    'families' => $candidate['families'],
                ];
            }
        }

        if ($viable === []) {
            return null;
        }

        // Keep only the longest match, then one option per generation type (first wins).
        $statCount = max(array_map(static fn (array $match): int => $match['statCount'], $viable));
        $options = [];

        foreach ($viable as $match) {
            if ($match['statCount'] === $statCount && ! isset($options[$match['type']])) {
                $options[$match['type']] = [
                    'id' => $match['id'],
                    'values' => $match['values'],
                    'families' => $match['families'],
                ];
            }
        }

        return [
            'statCount' => $statCount,
            'lines' => array_slice($lines, $index, $statCount),
            'options' => $options,
        ];
    }

    /**
     * Record author-mod lines the reverse-match left off, appended to the slot's running
     * list so {@see droppedMods} can report them after the map.
     *
     * @param  list<string>  $lines
     */
    private function recordDropped(string $slotKey, array $lines): void
    {
        if ($lines === []) {
            return;
        }

        $this->droppedMods[$slotKey] = [...($this->droppedMods[$slotKey] ?? []), ...$lines];
    }

    /**
     * The item's socketed runes as planner rune references, keeping only runes that
     * resolve to a known GGPK rune. Trailing empties are trimmed by canonicalisation.
     *
     * @return list<array{type: string, id: string}>
     */
    private function sockets(EquippedItem $item): array
    {
        $sockets = [];

        foreach ($item->runes as $rune) {
            $name = $rune['name'];

            if ($this->icons->resolveReference('rune', $name) !== null) {
                $sockets[] = ['type' => 'rune', 'id' => $name];
            }
        }

        return $sockets;
    }

    /**
     * Resolve the ascendancy the planner stores (the live tree's ascendancy id, e.g.
     * "Witch2"), matching the snapshot's ascendancy display name within its class. Null
     * when the build has not ascended or the name is unknown to the tree.
     */
    private function ascendId(BuildSnapshot $snapshot): ?string
    {
        if ($snapshot->ascendancy === null) {
            return null;
        }

        return $this->ascendancyIndex()[$this->key($snapshot->class->value, $snapshot->ascendancy->value)] ?? null;
    }

    /**
     * Class name + ascendancy name (both lowercased) => the tree's ascendancy id, built
     * once from the passive-tree class list the renderer draws from.
     *
     * @return array<string, string>
     */
    private function ascendancyIndex(): array
    {
        if ($this->ascendancyIndex !== null) {
            return $this->ascendancyIndex;
        }

        $index = [];
        $disk = Storage::disk('game-data');

        if ($disk->exists('public/tree/current/data.json')) {
            $data = json_decode((string) $disk->get('public/tree/current/data.json'), true);

            foreach ((is_array($data) ? $data['classes'] ?? [] : []) as $class) {
                $className = (string) ($class['name'] ?? '');

                foreach (is_array($class['ascendancies'] ?? null) ? $class['ascendancies'] : [] as $ascendancy) {
                    $id = $ascendancy['id'] ?? null;
                    $name = $ascendancy['name'] ?? null;

                    if (is_string($id) && is_string($name) && $name !== '') {
                        $index[$this->key($className, $name)] = $id;
                    }
                }
            }
        }

        return $this->ascendancyIndex = $index;
    }

    private function key(string $className, string $ascendancyName): string
    {
        return mb_strtolower($className).'|'.mb_strtolower($ascendancyName);
    }

    /**
     * Map PoB's uppercase rarity to the planner's, defaulting to rare for anything
     * unexpected (relics and the like keep author mods).
     */
    private function rarity(string $rarity): string
    {
        return match (mb_strtolower($rarity)) {
            'normal' => 'normal',
            'magic' => 'magic',
            'unique' => 'unique',
            default => 'rare',
        };
    }

    /**
     * Collapse a stat line to a stable, number-free template: ranged rolls "(46-50)"
     * first, then any remaining bare number, both to "#". Mirrors
     * {@see ModCatalogue::previewLine} so a rendered line and an affix template compare
     * equal.
     */
    private static function template(string $stat): string
    {
        $line = (string) preg_replace('/\(-?\d+(?:\.\d+)?--?\d+(?:\.\d+)?\)/', '#', $stat);

        return (string) preg_replace('/-?\d+(?:\.\d+)?/', '#', $line);
    }

    /**
     * The numbers in a rendered mod line, in order, as ints where whole.
     *
     * @return list<int|float>
     */
    private static function numbers(string $line): array
    {
        preg_match_all('/-?\d+(?:\.\d+)?/', $line, $matches);

        return array_map(
            static fn (string $number): int|float => str_contains($number, '.') ? (float) $number : (int) $number,
            $matches[0],
        );
    }

    /**
     * Whether the parsed values fit the tier's rolls: one value per roll, each within
     * its [min, max].
     *
     * @param  list<array{stat: string, min: int, max: int}>  $rolls
     * @param  list<int|float>  $values
     */
    private static function valuesInRange(array $rolls, array $values): bool
    {
        if (count($values) !== count($rolls) || $values === []) {
            return false;
        }

        return array_all($rolls, fn ($roll, $index) => ! ($values[$index] < $roll['min'] || $values[$index] > $roll['max']));
    }
}
