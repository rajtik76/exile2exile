<?php

declare(strict_types=1);

namespace App\Pob;

use App\Support\Planner\Matching\ModLineText;
use Closure;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Support\Facades\Storage;

/**
 * The GGPK equipment-mod catalogue: every explicit affix (prefix/suffix) an item can
 * carry, built from GGG's Mods table by {@see tools/poe-data-extract/mod-catalogue.mjs}.
 *
 * The build planner lets an author give a planned item real modifiers: they pick a real
 * affix - filtered to the ones that can roll on the item's base (a mod's spawn tags join
 * to the base's own tags) - choose a tier, and roll a concrete value inside that tier's
 * range. Only the `Mods.Id` and the rolled values are stored on the plan; this class is
 * the seam that turns an id back into its display data and enforces the game's rules
 * (per-rarity prefix/suffix counts, one mod per mutual-exclusion family, values in range,
 * and that the mod can even roll on the base).
 */
final class ModCatalogue
{
    /** Most prefixes and most suffixes an item of each rarity may carry. */
    private const array MODS_PER_TYPE = ['normal' => 0, 'magic' => 1, 'rare' => 3];

    /**
     * Spawn-weight tags carried by desecrated affixes ("Soul Influence" mods and the
     * breach-desecration mods of the desecrated mod domain). They never roll naturally -
     * their default weight is zero - but the Well of Souls puts them on ordinary rares,
     * so a base accepts the tags as if it carried them itself. A mod that zeroes a
     * base's own tag ahead of them stays excluded (the zero matches first).
     */
    private const array DESECRATED_TAGS = ['soul', 'breach_desecration'];

    /**
     * The spawn-weight tag prefix of Kalguuran genesis-tree affixes (`genesis_tree_caster`,
     * `genesis_tree_minion`, …). Same craft-only pattern as {@see DESECRATED_TAGS}: the
     * genesis tree puts them on ordinary rares, so a base accepts the tags as its own,
     * and an earlier zero on one of the base's tags still excludes the mod.
     */
    private const string GENESIS_TAG_PREFIX = 'genesis_tree_';

    /**
     * Spawn-weight tags of boss-influence affix families (BerserkInfluence,
     * MarksmanInfluence, DestructionInfluence, DecayInfluence, TimeInfluence). Same
     * craft-only pattern again: influence puts them on ordinary rares, no base carries
     * the tags itself.
     */
    private const array INFLUENCE_TAGS = ['berserking', 'marksman', 'destruction', 'decay', 'chronomancy'];

    /**
     * @var list<array{id: string, name: string, domain: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, spawnWeights: list<array{tag: string, weight: int}>, desecrated?: bool, essence?: bool, itemClasses?: list<string>}>|null
     */
    private ?array $mods = null;

    /**
     * @var array<string, array{id: string, name: string, domain: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, spawnWeights: list<array{tag: string, weight: int}>, desecrated?: bool, essence?: bool, itemClasses?: list<string>}>|null
     */
    private ?array $byId = null;

    /**
     * The mod list is parsed from a 1.6 MB GGPK file. When a cache is given (the
     * container binding passes one, keyed by the data version) the parsed list is
     * built once and reused across requests, so a mod search / resolve no longer
     * re-parses the source. Container-free callers (unit tests) pass no cache.
     */
    public function __construct(
        private readonly ?Cache $cache = null,
        private readonly string $dataVersion = 'dev',
    ) {}

    /**
     * The client-facing data for one mod id (its tier line, ranges and generation type),
     * or null when the id is unknown. The spawn-weight gate is internal, so it is dropped.
     *
     * @return array{id: string, name: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>}|null
     */
    public function resolve(string $modId): ?array
    {
        $mod = $this->index()[$modId] ?? null;

        return $mod === null ? null : $this->present($mod);
    }

    /**
     * Freeze a matched modifier (id + rolled values) into the plan's stored shape: every
     * field a caller could ever need to display or re-validate it later, copied out of
     * the catalogue at write time rather than kept as a live reference. This is the seam
     * that makes a stored plan immune to a future GGPK patch renaming or dropping the
     * id - nothing here is ever resolved against the catalogue again.
     *
     * $text is the exact line(s) as rendered (kept verbatim, e.g. by the reverse-matcher);
     * when the caller has none to offer (a blank string), one is best-effort rendered from
     * the mod's own template instead. Falls back to a bare, unmatched-looking snapshot
     * when the id is unknown, so a caller can still store the text rather than lose it.
     *
     * @param  list<int|float>  $values
     * @return array{modId: ?string, text: string, name: ?string, type: ?string, family: ?string, tier: ?int, rolls: ?list<array{stat: string, min: int|float, max: int|float}>, values: list<int|float>}
     */
    public function modSnapshot(string $modId, array $values, string $text): array
    {
        $mod = $this->index()[$modId] ?? null;

        if ($mod === null) {
            return [
                'modId' => null,
                'text' => $text,
                'name' => null,
                'type' => null,
                'family' => null,
                'tier' => null,
                'rolls' => null,
                'values' => [],
            ];
        }

        return [
            'modId' => $mod['id'],
            'text' => $text !== '' ? $text : ModLineText::render(array_map(ModLineText::template(...), $mod['stats']), $values),
            'name' => $mod['name'],
            'type' => $mod['type'],
            'family' => $mod['families'][0] ?? null,
            'tier' => $mod['tier'],
            'rolls' => $mod['rolls'],
            'values' => $values,
        ];
    }

    /**
     * Search the affixes that can roll on a base (its {@see IconResolver::itemTags}),
     * grouped into tier ladders. Each group is one affix (a GGG ModType) with its tiers
     * ascending; the search matches the affix wording (numbers ignored), ranked prefix
     * matches first. When the query is empty every compatible group is returned.
     *
     * Tiers that only reach the base through desecration (the Well of Souls) are flagged
     * `desecrated`, tiers only an essence can put there `essence`, tiers only the
     * Kalguuran genesis tree can put there `genesis`, and tiers only boss influence can
     * put there `influence`, so callers can rank or badge them apart from naturally
     * rolling affixes.
     *
     * @param  ?string  $modDomain  the base's mod domain; null = match none
     * @param  list<string>  $baseTags  the base's mod-matching tags; empty = match none
     * @param  ?string  $itemClass  the base's GGPK item class, gating essence-only mods; null = lenient
     * @return list<array{group: string, type: string, label: string, tiers: list<array{id: string, name: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, desecrated: bool, essence: bool, genesis: bool, influence: bool, ladder: bool}>}>
     */
    public function search(?string $modDomain, array $baseTags, string $query, int $limit = 60, ?string $itemClass = null): array
    {
        if ($modDomain === null || $baseTags === []) {
            return [];
        }

        $terms = TextSearch::terms($query);
        $groups = [];

        // Ladders with a naturally rolling tier on this base, precomputed so the
        // desecration-bump fallback (see canRollOn) doesn't rescan the catalogue for
        // every gated-out tier.
        $naturalLadders = [];

        foreach ($this->all() as $mod) {
            if ($mod['domain'] === $modDomain
                && ($mod['group'] ?? null) !== null
                && ($this->matchingWeight($mod, $baseTags)['weight'] ?? 0) > 0) {
                $naturalLadders[$mod['group'].'|'.$mod['type']] = true;
            }
        }

        foreach ($this->all() as $mod) {
            if (! $this->canRollOn($mod, $modDomain, $baseTags, $itemClass, $naturalLadders)) {
                continue;
            }

            $key = ($mod['group'] ?? $mod['id']).'|'.$mod['type'];

            if (! isset($groups[$key])) {
                $groups[$key] = [
                    'group' => $mod['group'] ?? $mod['id'],
                    'type' => $mod['type'],
                    'label' => self::previewLine($mod['stats']),
                    'tiers' => [],
                ];
            }

            $groups[$key]['tiers'][] = [
                'id' => $mod['id'],
                // The real GGG affix name (e.g. "of Decay"), distinct from the group's
                // own number-free `label` - a manually picked tier freezes this straight
                // into its stat snapshot (see ModPicker.tsx's `toItemMod`), the same
                // field {@see modSnapshot} fills in for an import-matched one, so
                // BuildFilterBuilder sees a real affix name either way.
                'name' => $mod['name'],
                'tier' => $mod['tier'],
                'level' => $mod['level'],
                'stats' => $mod['stats'],
                'rolls' => $mod['rolls'],
                'families' => $mod['families'],
                // A weight-gated-out tier reached the base through the ladder fallback,
                // which is desecration's doing (a tier bump past the natural ceiling).
                'desecrated' => $this->isDesecratedOnly($mod, $baseTags)
                    || (($mod['essence'] ?? false) !== true
                        && ($this->matchingWeight($mod, $baseTags)['weight'] ?? 0) <= 0),
                'essence' => ($mod['essence'] ?? false) === true,
                'genesis' => $this->isGenesisOnly($mod, $baseTags),
                'influence' => $this->isInfluenceOnly($mod, $baseTags),
                // Reached only through the ladder fallback: callers preferring a
                // directly gated variant (e.g. the import's reverse-match) rank these last.
                'ladder' => ($mod['essence'] ?? false) !== true
                    && ($this->matchingWeight($mod, $baseTags)['weight'] ?? 0) <= 0,
            ];
        }

        $matches = array_values(array_filter(
            $groups,
            static fn (array $group): bool => $terms === [] || TextSearch::matches($group['label'], $terms),
        ));

        $first = $terms[0] ?? '';
        usort($matches, static function (array $a, array $b) use ($first): int {
            $aStarts = $first !== '' && str_starts_with(mb_strtolower($a['label']), $first) ? 0 : 1;
            $bStarts = $first !== '' && str_starts_with(mb_strtolower($b['label']), $first) ? 0 : 1;

            return [$aStarts, mb_strlen($a['label']), $a['label']]
                <=> [$bStarts, mb_strlen($b['label']), $b['label']];
        });

        // Order every group's tiers weakest-first for a readable ladder.
        foreach ($matches as &$group) {
            usort($group['tiers'], static fn (array $a, array $b): int => ($a['tier'] ?? 0) <=> ($b['tier'] ?? 0));
        }

        return array_slice($matches, 0, max(1, $limit));
    }

    /**
     * Validate an item's author modifiers against the game's rules, returning one message
     * per broken rule (empty when legal). Enforced: per-rarity prefix/suffix counts
     * (normal 0, magic 1+1, rare 3+3), one modifier per mutual-exclusion family, each
     * modifier known and its values inside the tier's range, and - when the base is known
     * - that the modifier can actually roll on it. Uniques are handled by the shape rules
     * (they carry no author mods) and are skipped here.
     *
     * A stat with no `modId` is a plain-text line the author's mod couldn't be matched
     * to a known affix at write time (an unrecognised wording, or one a future GGPK patch
     * has since dropped) - it carries no family/tier/range to check, so it is skipped
     * entirely rather than rejected; only a *non-empty but unknown* id is an error.
     *
     * @param  list<mixed>  $stats  the item's raw author modifiers (untrusted shape)
     * @param  ?string  $modDomain  the base's mod domain, or null when no base is chosen
     * @param  list<string>  $baseTags  the base's tags, or empty when no base is chosen
     * @param  ?string  $itemClass  the base's GGPK item class, gating essence-only mods; null = lenient
     * @return list<string>
     */
    public function modErrors(string $rarity, array $stats, ?string $modDomain = null, array $baseTags = [], ?string $itemClass = null): array
    {
        if ($rarity === 'unique' || $stats === []) {
            return [];
        }

        $errors = [];
        $counts = ['prefix' => 0, 'suffix' => 0];
        $families = [];
        $maxPerType = self::MODS_PER_TYPE[$rarity] ?? 0;

        foreach ($stats as $stat) {
            $modId = is_array($stat) && is_string($stat['modId'] ?? null) ? $stat['modId'] : '';

            if ($modId === '') {
                continue;
            }

            $mod = $this->index()[$modId] ?? null;

            if ($mod === null) {
                $errors[] = 'A modifier is not a known GGPK affix.';

                continue;
            }

            $counts[$mod['type']] = ($counts[$mod['type']] ?? 0) + 1;
            $families = [...$families, ...$mod['families']];

            $values = is_array($stat['values'] ?? null) ? array_values($stat['values']) : [];

            if (! self::valuesInRange($mod['rolls'], $values)) {
                $errors[] = "A modifier's value is outside its tier's range.";
            }

            if ($baseTags !== [] && ! $this->canRollOn($mod, $modDomain, $baseTags, $itemClass)) {
                $errors[] = 'A modifier cannot roll on this base type.';
            }
        }

        if ($rarity === 'normal') {
            $errors[] = 'A normal item cannot carry modifiers.';
        } else {
            foreach (['prefix', 'suffix'] as $type) {
                if ($counts[$type] > $maxPerType) {
                    $errors[] = ucfirst($rarity)." items carry at most {$maxPerType} {$type} modifier".($maxPerType === 1 ? '' : 's').'.';
                }
            }
        }

        if (count($families) !== count(array_unique($families))) {
            $errors[] = 'Two modifiers share a mutual-exclusion group.';
        }

        return array_values(array_unique($errors));
    }

    /**
     * Whether a mod can land on an item: its GGPK domain must match the base's (a base
     * only takes mods of its own `modDomain`), and then the first of its spawn weights
     * whose tag the item has (or `default`, or the desecration tag) must be positive.
     * The domain gate is first and non-optional - mods of foreign domains (Monster,
     * Heist, …) carry a positive default weight and would otherwise leak through the
     * tag gate alone.
     *
     * A mod carrying a non-empty `itemClasses` list must also match the base's GGPK item
     * class, tag weight notwithstanding - most mods carry none (unrestricted), but a
     * cross-slot spawn tag (e.g. "runeforged", shared by every runeforged equipment
     * slot) needs this AND on top of the tag OR to stay slot-scoped. Essence-only mods
     * fail the weight gate by definition (an essence targets item classes directly and
     * the mod's weights are all zero), so they rely on this same check exclusively. A
     * null $itemClass (no base chosen, or a caller without class data) is lenient.
     *
     * Any other weight-gated-out tier falls back to its ladder: desecration bumps a
     * mod past its natural ceiling, either into a tier that zeroes the slot's own tag
     * (gloves take "% increased Energy Shield" to T4 naturally, the Well of Souls to
     * T5+) or into a tier with no positive weight at all (Dexterity T9). Such a tier
     * still lands wherever a sibling tier of the same ladder rolls naturally.
     *
     * @param  array{id: string, domain: string, group: ?string, type: string, spawnWeights: list<array{tag: string, weight: int}>, essence?: bool, itemClasses?: list<string>}  $mod
     * @param  list<string>  $baseTags
     * @param  ?array<string, true>  $naturalLadders  precomputed "group|type" keys with a
     *                                                naturally rolling tier on the base; null = scan per mod
     */
    private function canRollOn(array $mod, ?string $modDomain, array $baseTags, ?string $itemClass = null, ?array $naturalLadders = null): bool
    {
        if ($mod['domain'] !== $modDomain) {
            return false;
        }

        // A positive tag weight is normally sufficient on its own, but a mod whose spawn
        // tag is shared across every equipment slot (e.g. a runeforging-only pool gated
        // on the cross-slot "runeforged" tag, not a slot-specific one) still needs its
        // itemClasses list respected as an AND - not just for essence mods, otherwise a
        // Gloves-only pool leaks onto a runeforged Body Armour too.
        if (($this->matchingWeight($mod, $baseTags)['weight'] ?? 0) > 0) {
            return $this->classAllows($mod, $itemClass);
        }

        if (($mod['essence'] ?? false) === true) {
            return $this->classAllows($mod, $itemClass);
        }

        if (($mod['group'] ?? null) === null) {
            return false;
        }

        // Same AND as the weight/essence branches above: a natural-ladder sibling's
        // weight can come from an always-carried tag (desecration/genesis/influence,
        // see matchingWeight()) that ignores baseTags entirely - without this gate, a
        // mod sharing a group with such a sibling would roll on every item class
        // regardless of its own itemClasses restriction.
        $ladderRolls = $naturalLadders !== null
            ? isset($naturalLadders[$mod['group'].'|'.$mod['type']])
            : $this->ladderRollsOn($mod, $baseTags);

        return $ladderRolls && $this->classAllows($mod, $itemClass);
    }

    /**
     * Whether a mod's itemClasses allowlist (when it carries one) includes the base's
     * GGPK item class - an empty list or an unknown base class means unrestricted.
     *
     * @param  array{itemClasses?: list<string>}  $mod
     */
    private function classAllows(array $mod, ?string $itemClass): bool
    {
        $classes = $mod['itemClasses'] ?? [];

        return $classes === [] || $itemClass === null || in_array($itemClass, $classes, true);
    }

    /**
     * Whether a sibling tier of the mod's own ladder (same group, generation type and
     * domain) rolls naturally on the base - the gate a desecration-bumped tier inherits.
     *
     * @param  array{id: string, domain: string, group: ?string, type: string}  $mod
     * @param  list<string>  $baseTags
     */
    private function ladderRollsOn(array $mod, array $baseTags): bool
    {
        if (($mod['group'] ?? null) === null) {
            return false;
        }

        return array_any($this->all(), fn ($sibling) => $sibling['id'] !== $mod['id']
            && ($sibling['group'] ?? null) === $mod['group']
            && $sibling['type'] === $mod['type']
            && $sibling['domain'] === $mod['domain']
            && ($this->matchingWeight($sibling, $baseTags)['weight'] ?? 0) > 0);
    }

    /**
     * The first spawn weight whose tag the item has - `default` and the craft-only tags
     * (desecration, genesis tree) count as always carried - or null when none matches.
     * First-match order is GGG's own semantics: an earlier zero for one of the base's
     * tags excludes the mod even when a later tag would allow it.
     *
     * @param  array{spawnWeights: list<array{tag: string, weight: int}>}  $mod
     * @param  list<string>  $baseTags
     * @return array{tag: string, weight: int}|null
     */
    private function matchingWeight(array $mod, array $baseTags): ?array
    {
        foreach ($mod['spawnWeights'] as $weight) {
            if ($weight['tag'] === 'default'
                || in_array($weight['tag'], self::DESECRATED_TAGS, true)
                || str_starts_with($weight['tag'], self::GENESIS_TAG_PREFIX)
                || in_array($weight['tag'], self::INFLUENCE_TAGS, true)
                || in_array($weight['tag'], $baseTags, true)) {
                return $weight;
            }
        }

        return null;
    }

    /**
     * Whether the mod reaches this base only through the Kalguuran genesis tree - the
     * weight that lets it in is a genesis tag's, not one of the base's own tags.
     *
     * @param  array{spawnWeights: list<array{tag: string, weight: int}>}  $mod
     * @param  list<string>  $baseTags
     */
    private function isGenesisOnly(array $mod, array $baseTags): bool
    {
        return str_starts_with($this->matchingWeight($mod, $baseTags)['tag'] ?? '', self::GENESIS_TAG_PREFIX);
    }

    /**
     * Whether the mod reaches this base only through desecration - it comes from the
     * desecrated mod domain (the catalogue's `desecrated` flag), or the weight that
     * lets it in is the desecration tag's, not one of the base's own tags.
     *
     * @param  array{spawnWeights: list<array{tag: string, weight: int}>, desecrated?: bool}  $mod
     * @param  list<string>  $baseTags
     */
    private function isDesecratedOnly(array $mod, array $baseTags): bool
    {
        return ($mod['desecrated'] ?? false) === true
            || in_array($this->matchingWeight($mod, $baseTags)['tag'] ?? '', self::DESECRATED_TAGS, true);
    }

    /**
     * Whether the mod reaches this base only through boss influence - the weight that
     * lets it in is an influence tag's, not one of the base's own tags.
     *
     * @param  array{spawnWeights: list<array{tag: string, weight: int}>}  $mod
     * @param  list<string>  $baseTags
     */
    private function isInfluenceOnly(array $mod, array $baseTags): bool
    {
        return in_array($this->matchingWeight($mod, $baseTags)['tag'] ?? '', self::INFLUENCE_TAGS, true);
    }

    /**
     * Whether the author's values fit the tier's rolls: one value per roll, each within
     * its `[min, max]`.
     *
     * @param  list<array{stat: string, min: int, max: int}>  $rolls
     * @param  list<mixed>  $values
     */
    private static function valuesInRange(array $rolls, array $values): bool
    {
        if (count($values) !== count($rolls)) {
            return false;
        }

        foreach ($rolls as $index => $roll) {
            $value = $values[$index];

            if (! is_numeric($value) || $value < $roll['min'] || $value > $roll['max']) {
                return false;
            }
        }

        return true;
    }

    /**
     * Preview one or more stat lines with every number replaced by `#`, so an affix's
     * tiers collapse to one stable, number-free label (`+#% to Cold Resistance`).
     *
     * @param  list<string>  $stats
     */
    private static function previewLine(array $stats): string
    {
        $line = implode(', ', $stats);
        // Collapse ranged rolls "(46-50)" first, then any remaining bare numbers.
        $line = (string) preg_replace('/\(-?\d+(?:\.\d+)?--?\d+(?:\.\d+)?\)/', '#', $line);

        return (string) preg_replace('/-?\d+(?:\.\d+)?/', '#', $line);
    }

    /**
     * The client-facing projection of a stored mod (drops the internal spawn-weight gate).
     *
     * @param  array{id: string, name: string, domain: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, spawnWeights: list<array{tag: string, weight: int}>, desecrated?: bool, essence?: bool, itemClasses?: list<string>}  $mod
     * @return array{id: string, name: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>}
     */
    private function present(array $mod): array
    {
        return [
            'id' => $mod['id'],
            'name' => $mod['name'],
            'group' => $mod['group'],
            'type' => $mod['type'],
            'tier' => $mod['tier'],
            'level' => $mod['level'],
            'stats' => $mod['stats'],
            'rolls' => $mod['rolls'],
            'families' => $mod['families'],
        ];
    }

    /**
     * @return array<string, array{id: string, name: string, domain: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, spawnWeights: list<array{tag: string, weight: int}>, desecrated?: bool, essence?: bool, itemClasses?: list<string>}>
     */
    private function index(): array
    {
        if ($this->byId !== null) {
            return $this->byId;
        }

        $byId = [];

        foreach ($this->all() as $mod) {
            $byId[$mod['id']] = $mod;
        }

        return $this->byId = $byId;
    }

    /**
     * @return list<array{id: string, name: string, domain: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, spawnWeights: list<array{tag: string, weight: int}>, desecrated?: bool, essence?: bool, itemClasses?: list<string>}>
     */
    private function all(): array
    {
        return $this->mods ??= $this->remembered('mods', function (): array {
            $disk = Storage::disk('game-data');

            if (! $disk->exists('resources/poe2/ggpk/mods.json')) {
                return [];
            }

            $decoded = json_decode((string) $disk->get('resources/poe2/ggpk/mods.json'), true);

            if (! is_array($decoded)) {
                return [];
            }

            /** @var list<array{id: string, name: string, domain: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, spawnWeights: list<array{tag: string, weight: int}>, desecrated?: bool, essence?: bool, itemClasses?: list<string>}> $decoded */
            return $decoded;
        });
    }

    /**
     * Build the mod list once, caching it across requests (keyed by the data version)
     * when a cache is available; otherwise build in-process every call.
     *
     * @template TValue
     *
     * @param  Closure(): TValue  $build
     * @return TValue
     */
    private function remembered(string $key, Closure $build): mixed
    {
        if ($this->cache === null) {
            return $build();
        }

        return $this->cache->rememberForever("mods.{$key}:{$this->dataVersion}", $build);
    }
}
