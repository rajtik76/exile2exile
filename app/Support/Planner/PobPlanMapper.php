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
     * Planner slots whose items take catalysts. Catalyst quality inflates a rendered
     * roll (up to {@see MAX_CATALYST_QUALITY}) and PoB exports no quality line for
     * jewellery, so on these slots an out-of-range value may be the quality-inflated
     * render of a real top-tier roll.
     */
    private const array CATALYST_SLOTS = ['ring1', 'ring2', 'amulet', 'belt'];

    /**
     * The most catalyst quality is assumed to inflate a jewellery roll. Ordinary
     * catalysts reach +20%, but "+X% to Maximum Quality" modifiers and implicits stack
     * well past that (a corrupted Refined Breach Ring shows +73%). Kept a bound at all
     * so an arbitrary wrong value can't claim a tier; used as a last resort only,
     * after aggregate decomposition.
     */
    private const float MAX_CATALYST_QUALITY = 2.0;

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

        $candidates = $this->candidateAffixes($domain, $tags, $this->icons->itemClass($item->baseType));

        // Desecrated, essence and genesis-tree affixes reach a base only through
        // crafting, so they must not compete with naturally rolling affixes: the
        // desecrated life+mana hybrid would otherwise steal two adjacent natural lines
        // (the longest match wins). They join as a second pass, only for lines no
        // natural affix explains.
        $natural = array_values(array_filter(
            $candidates,
            static fn (array $candidate): bool => ! $candidate['crafted'],
        ));

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
            $options = $this->matchOptions($lines, $index, $natural)
                ?? $this->matchOptions($lines, $index, $candidates);

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
            if (! $this->assignOptions($entry['options'], $maxPerType, $context)) {
                $unmatched = [...$unmatched, ...$entry['lines']];
            }
        }

        // A line whose value tops every single tier is a summed (aggregate) line, as the
        // game renders same-stat mods added together. Try to split it back into real
        // affixes (pure + hybrid, or two same-wording pures of different families).
        $unmatched = $this->decomposeAggregates($unmatched, $lines, $candidates, $maxPerType, $context);

        // Last resort on catalyst slots: a still-unexplained value may be a real roll
        // inflated by quality (PoB folds it into the render and exports no quality line
        // for jewellery), so match it against its tier clamped. After decomposition on
        // purpose - a summed line splits value-exactly, clamping loses the excess.
        if (in_array($slotKey, self::CATALYST_SLOTS, true)) {
            $unmatched = array_values(array_filter(
                $unmatched,
                fn (string $line): bool => ! $this->assignQualityInflated($line, $candidates, $maxPerType, $context),
            ));
        }

        $this->recordDropped($slotKey, $unmatched);

        return $context['stats'];
    }

    /**
     * Assign one line's viable options into the running item context: the first
     * generation type with a free slot and no family clash wins. Returns whether the
     * line was placed.
     *
     * @param  array<string, array{id: string, values: list<int|float>, families: list<string>}>  $options
     * @param  array{stats: list<array{modId: string, values: list<int|float>}>, counts: array<string, int>, families: list<string>}  $context
     */
    private function assignOptions(array $options, int $maxPerType, array &$context): bool
    {
        foreach ($options as $type => $option) {
            if (($context['counts'][$type] ?? 0) < $maxPerType
                && array_intersect($option['families'], $context['families']) === []) {
                $context['counts'][$type]++;
                $context['families'] = [...$context['families'], ...$option['families']];
                $context['stats'][] = ['modId' => $option['id'], 'values' => $option['values']];

                return true;
            }
        }

        return false;
    }

    /**
     * Match a single leftover line allowing quality inflation (value over the tier's
     * ceiling, stored clamped) and assign it into the context. Returns whether it landed.
     *
     * @param  list<array{id: string, type: string, statCount: int, template: string, statTemplates: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>}>  $candidates
     * @param  array{stats: list<array{modId: string, values: list<int|float>}>, counts: array<string, int>, families: list<string>}  $context
     */
    private function assignQualityInflated(string $line, array $candidates, int $maxPerType, array &$context): bool
    {
        $options = $this->matchOptions([$line], 0, $candidates, quality: true);

        return $options !== null && $this->assignOptions($options['options'], $maxPerType, $context);
    }

    /**
     * Split summed lines back into real affixes. The game renders same-stat rolls added
     * together, so a line can top every single tier's ceiling - the true item carries
     * several mods. Two shapes are recovered: a pure affix plus a two-stat hybrid whose
     * companion stat is another summed line (e.g. Legend's 94% + Predator's 41% and its
     * +46 life), and two pure affixes of the same wording from different families (a
     * natural tier plus a craft-only desecrated/genesis tier, e.g. "147% increased
     * Energy Shield" or a doubled "Adds X to Y Lightning damage"). Lines it can't split
     * are returned still unmatched. Best-effort: the split's exact tiers aren't
     * recoverable from a sum, but the totals match what the game shows.
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

            if ($values === [] || ! $this->exceedsPureCeiling($candidates, $template, $values)) {
                $stillUnmatched[] = $line;

                continue;
            }

            $split = (count($values) === 1
                ? $this->splitAggregate($template, $values[0], $aggregates, $candidates, $maxPerType, $context)
                : null)
                ?? $this->splitPurePair($template, $values, $candidates, $maxPerType, $context);

            if ($split === null) {
                $stillUnmatched[] = $line;
            }
        }

        return $stillUnmatched;
    }

    /**
     * Whether any of a line's values tops the corresponding roll of every pure affix of
     * its template - the mark of a summed (aggregate) render. A template with no pure
     * candidate at all also qualifies: its wording exists only inside hybrids (e.g.
     * "increased Light Radius"), so an unmatched line of it can only be a hybrid's part.
     *
     * @param  list<array{statCount: int, template: string, rolls: list<array{stat: string, min: int, max: int}>}>  $candidates
     * @param  list<int|float>  $values
     */
    private function exceedsPureCeiling(array $candidates, string $template, array $values): bool
    {
        $ceilings = [];

        foreach ($candidates as $candidate) {
            if ($candidate['statCount'] !== 1 || $candidate['template'] !== $template || count($candidate['rolls']) !== count($values)) {
                continue;
            }

            foreach ($candidate['rolls'] as $index => $roll) {
                $ceilings[$index] = max($ceilings[$index] ?? 0, $roll['max']);
            }
        }

        if ($ceilings === []) {
            return true;
        }

        return array_any($values, static fn (int|float $value, int $index): bool => $value > ($ceilings[$index] ?? 0));
    }

    /**
     * Try to explain a summed line as TWO pure affixes of the same wording from
     * different mutual-exclusion families - the render the game shows when a natural
     * tier and a craft-only (desecrated/genesis) tier of one stat share an item. Each
     * of the line's values must split as `first + second` with both parts inside the
     * pair's respective rolls; the split takes the first pair whose per-roll intervals
     * intersect, favouring the highest first-tier part. On success it mutates
     * {@see $context} (both mods added, counts and families updated) and returns true;
     * otherwise returns null and changes nothing.
     *
     * @param  list<int|float>  $values
     * @param  list<array{id: string, type: string, statCount: int, template: string, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>}>  $candidates
     * @param  array{stats: list<array{modId: string, values: list<int|float>}>, counts: array<string, int>, families: list<string>}  $context
     */
    private function splitPurePair(string $template, array $values, array $candidates, int $maxPerType, array &$context): ?bool
    {
        $pures = array_values(array_filter(
            $candidates,
            static fn (array $candidate): bool => $candidate['statCount'] === 1
                && $candidate['template'] === $template
                && count($candidate['rolls']) === count($values),
        ));

        foreach ($pures as $first) {
            foreach ($pures as $second) {
                if ($first['id'] === $second['id']
                    || array_intersect($first['families'], $second['families']) !== []) {
                    continue;
                }

                $firstValues = [];
                $secondValues = [];

                foreach ($values as $index => $total) {
                    // The window of first-tier parts that leave the remainder inside
                    // the second tier's roll; empty when the pair can't sum to the line.
                    $low = max($first['rolls'][$index]['min'], $total - $second['rolls'][$index]['max']);
                    $high = min($first['rolls'][$index]['max'], $total - $second['rolls'][$index]['min']);

                    if ($low > $high) {
                        continue 2;
                    }

                    $firstValues[] = $high;
                    $secondValues[] = $total - $high;
                }

                if ($this->applyPurePair($first, $firstValues, $second, $secondValues, $maxPerType, $context)) {
                    return true;
                }
            }
        }

        return null;
    }

    /**
     * Commit a pure-pair decomposition when the per-type caps and one-mod-per-family
     * rule still hold with both mods added. Returns whether it was applied.
     *
     * @param  array{id: string, type: string, families: list<string>}  $first
     * @param  list<int|float>  $firstValues
     * @param  array{id: string, type: string, families: list<string>}  $second
     * @param  list<int|float>  $secondValues
     * @param  array{stats: list<array{modId: string, values: list<int|float>}>, counts: array<string, int>, families: list<string>}  $context
     */
    private function applyPurePair(array $first, array $firstValues, array $second, array $secondValues, int $maxPerType, array &$context): bool
    {
        $counts = $context['counts'];
        $counts[$first['type']] = ($counts[$first['type']] ?? 0) + 1;
        $counts[$second['type']] = ($counts[$second['type']] ?? 0) + 1;

        if (($counts['prefix'] ?? 0) > $maxPerType || ($counts['suffix'] ?? 0) > $maxPerType) {
            return false;
        }

        $families = [...$context['families'], ...$first['families'], ...$second['families']];

        if (count($families) !== count(array_unique($families))) {
            return false;
        }

        $context['counts'] = $counts;
        $context['families'] = $families;
        $context['stats'][] = ['modId' => $first['id'], 'values' => $firstValues];
        $context['stats'][] = ['modId' => $second['id'], 'values' => $secondValues];

        return true;
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

            // Pick the hybrid's own rolls so both summed lines split into real pure
            // tiers. Either side of the line may also be the hybrid's part alone: a
            // hybrid-only wording (light radius) has no pure primary to add.
            for ($primary = $primaryRoll['min']; $primary <= $primaryRoll['max']; $primary++) {
                $purePrimary = $primary === $total ? null : $this->pureTier($candidates, $template, $total - $primary);

                if ($primary !== $total && $purePrimary === null) {
                    continue;
                }

                for ($companion = $companionRoll['min']; $companion <= $companionRoll['max']; $companion++) {
                    // The companion line may be the hybrid's part alone (no pure
                    // companion mod at all) or the hybrid's part plus its own pure.
                    $pureCompanion = $companion === $companionTotal
                        ? null
                        : $this->pureTier($candidates, $companionTemplate, $companionTotal - $companion);

                    if ($companion !== $companionTotal && $pureCompanion === null) {
                        continue;
                    }

                    $additions = [
                        ['modId' => $hybrid['id'], 'values' => $this->orderedValues($hybrid, $primaryIndex, $primary, $companion), 'type' => $hybrid['type'], 'families' => $hybrid['families']],
                    ];

                    if ($purePrimary !== null) {
                        $additions[] = ['modId' => $purePrimary, 'values' => [$total - $primary], 'type' => $hybrid['type'], 'families' => $this->familiesOf($candidates, $purePrimary)];
                    }

                    if ($pureCompanion !== null) {
                        $additions[] = ['modId' => $pureCompanion, 'values' => [$companionTotal - $companion], 'type' => $hybrid['type'], 'families' => $this->familiesOf($candidates, $pureCompanion)];
                    }

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
     * Candidates only a craft can put on the base (desecrated, essence, genesis tree)
     * carry `crafted: true`, so the matcher can hold them back behind natural affixes.
     *
     * @param  list<string>  $tags
     * @return list<array{id: string, type: string, statCount: int, template: string, statTemplates: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, crafted: bool, ladder: bool}>
     */
    private function candidateAffixes(string $domain, array $tags, ?string $itemClass): array
    {
        $candidates = [];

        // No group limit: the reverse-match must see every affix the base can carry,
        // not the first page the editor's search UI shows.
        foreach ($this->mods->search($domain, $tags, '', PHP_INT_MAX, $itemClass) as $group) {
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
                    'crafted' => $tier['desecrated'] || $tier['essence'] || $tier['genesis'] || $tier['influence'],
                    'ladder' => $tier['ladder'],
                ];
            }
        }

        // Ladder-fallback tiers rank last: when a line fits both a directly gated
        // variant and a foreign slot's variant reached through the fallback (the bone
        // mods come per slot), the direct one must win the first-viable pick.
        usort($candidates, static fn (array $a, array $b): int => $a['ladder'] <=> $b['ladder']);

        return $candidates;
    }

    /**
     * The affix matches for the run of lines starting at $index: a candidate of N stats
     * matches when the next N lines cover its stat templates (in any order - PoB renders
     * a hybrid's lines in on-screen order, not GGPK stat order) and their rolled values
     * map onto the tier's ranges (see {@see canonicalValues}). The longest match wins (a
     * hybrid isn't pre-empted by a single-stat affix matching only its first line), and
     * every viable generation type is returned - one per type - so an ambiguous line
     * (both a prefix and a suffix fit) can be assigned its type later. Null when nothing
     * fits. With $quality (catalyst slots) an over-ceiling value may match clamped; the
     * highest tier wins there, as the smallest inflation is the likeliest render.
     *
     * @param  list<string>  $lines
     * @param  list<array{id: string, type: string, statCount: int, template: string, statTemplates: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>}>  $candidates
     * @return array{statCount: int, lines: list<string>, options: array<string, array{id: string, values: list<int|float>, families: list<string>}>}|null
     */
    private function matchOptions(array $lines, int $index, array $candidates, bool $quality = false): ?array
    {
        $viable = [];

        foreach ($candidates as $candidate) {
            $statCount = $candidate['statCount'];

            if ($index + $statCount > count($lines)) {
                continue;
            }

            $window = array_slice($lines, $index, $statCount);
            $ordered = self::alignWindow($window, $candidate['statTemplates']);

            if ($ordered === null) {
                continue;
            }

            $values = self::canonicalValues($candidate['rolls'], self::numbers(implode("\n", $ordered)), $quality);

            if ($values !== null) {
                $viable[] = [
                    'statCount' => $statCount,
                    'type' => $candidate['type'],
                    'id' => $candidate['id'],
                    'values' => $values,
                    'families' => $candidate['families'],
                    'ceiling' => max([0, ...array_column($candidate['rolls'], 'max')]),
                ];
            }
        }

        if ($viable === []) {
            return null;
        }

        // Keep only the longest match, then one option per generation type: the first
        // viable tier normally, the highest tier when quality-clamping (an inflated
        // render most likely hides the roll closest to it).
        $statCount = max(array_map(static fn (array $match): int => $match['statCount'], $viable));
        $options = [];

        foreach ($viable as $match) {
            if ($match['statCount'] !== $statCount) {
                continue;
            }

            $kept = $options[$match['type']] ?? null;

            if ($kept === null || ($quality && $match['ceiling'] > $kept['ceiling'])) {
                $options[$match['type']] = $match;
            }
        }

        return [
            'statCount' => $statCount,
            'lines' => array_slice($lines, $index, $statCount),
            'options' => array_map(
                static fn (array $match): array => [
                    'id' => $match['id'],
                    'values' => $match['values'],
                    'families' => $match['families'],
                ],
                $options,
            ),
        ];
    }

    /**
     * Reorder a window of rendered lines into the candidate's own stat order, matching
     * by number-free template, or null when the window doesn't cover the candidate's
     * stats exactly. A one-stat candidate reduces to a plain template comparison.
     *
     * @param  list<string>  $window
     * @param  list<string>  $statTemplates
     * @return list<string>|null
     */
    private static function alignWindow(array $window, array $statTemplates): ?array
    {
        $ordered = [];
        $used = [];

        foreach ($statTemplates as $statTemplate) {
            $found = array_find_key($window, fn ($line, $i) => ! isset($used[$i]) && self::template($line) === $statTemplate);
            if ($found === null) {
                return null;
            }

            $used[$found] = true;
            $ordered[] = $window[$found];
        }

        return $ordered;
    }

    /**
     * Map a window's parsed numbers onto the tier's rolls, returning the values exactly
     * as the catalogue stores them, or null when they cannot be explained. Beyond the
     * plain one-in-range-value-per-roll case this accepts three renderings PoB uses:
     * a negative roll shown positive under inverted wording ("50% reduced ..." for a
     * -50 roll), a per-minute roll shown per second (flask charge gain), and a constant
     * hidden roll that renders no number at all (the boolean of "Instant Recovery").
     * With $quality a value may also exceed its roll's ceiling by up to what catalysts
     * add on jewellery ({@see MAX_CATALYST_QUALITY}); it is stored clamped to the
     * ceiling, since the un-inflated roll is not recoverable from the render.
     *
     * @param  list<array{stat: string, min: int, max: int}>  $rolls
     * @param  list<int|float>  $values
     * @return list<int|float>|null
     */
    private static function canonicalValues(array $rolls, array $values, bool $quality): ?array
    {
        if (count($values) > count($rolls)) {
            return null;
        }

        // How many rolls may self-fill because their number never renders.
        $hidden = count($rolls) - count($values);
        $canonical = [];
        $next = 0;

        foreach ($rolls as $roll) {
            $value = $values[$next] ?? null;

            if ($value !== null) {
                $renderings = [$value, -$value];

                if (str_contains($roll['stat'], 'every_minute')) {
                    $renderings[] = self::asWhole(round($value * 60, 4));
                }

                foreach ($renderings as $rendering) {
                    if ($rendering >= $roll['min'] && $rendering <= $roll['max']) {
                        $canonical[] = $rendering;
                        $next++;

                        continue 2;
                    }
                }

                if ($quality && $value > $roll['max'] && $value <= floor($roll['max'] * self::MAX_CATALYST_QUALITY)) {
                    $canonical[] = $roll['max'];
                    $next++;

                    continue;
                }
            }

            if ($hidden > 0 && $roll['min'] === $roll['max']) {
                $canonical[] = $roll['min'];
                $hidden--;

                continue;
            }

            return null;
        }

        return $next === count($values) ? $canonical : null;
    }

    /** A float that is a whole number as int (15.0 becomes 15), anything else unchanged. */
    private static function asWhole(int|float $value): int|float
    {
        return is_float($value) && floor($value) === $value ? (int) $value : $value;
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
}
