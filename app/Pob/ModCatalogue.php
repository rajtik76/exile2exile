<?php

declare(strict_types=1);

namespace App\Pob;

use Closure;
use Illuminate\Contracts\Cache\Repository as Cache;

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
     * @var list<array{id: string, name: string, domain: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, spawnWeights: list<array{tag: string, weight: int}>}>|null
     */
    private ?array $mods = null;

    /**
     * @var array<string, array{id: string, name: string, domain: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, spawnWeights: list<array{tag: string, weight: int}>}>|null
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
     * Search the affixes that can roll on a base (its {@see IconResolver::itemTags}),
     * grouped into tier ladders. Each group is one affix (a GGG ModType) with its tiers
     * ascending; the search matches the affix wording (numbers ignored), ranked prefix
     * matches first. When the query is empty every compatible group is returned.
     *
     * @param  ?string  $modDomain  the base's mod domain; null = match none
     * @param  list<string>  $baseTags  the base's mod-matching tags; empty = match none
     * @return list<array{group: string, type: string, label: string, tiers: list<array{id: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>}>}>
     */
    public function search(?string $modDomain, array $baseTags, string $query, int $limit = 60): array
    {
        if ($modDomain === null || $baseTags === []) {
            return [];
        }

        $terms = TextSearch::terms($query);
        $groups = [];

        foreach ($this->all() as $mod) {
            if (! $this->canRollOn($mod, $modDomain, $baseTags)) {
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
                'tier' => $mod['tier'],
                'level' => $mod['level'],
                'stats' => $mod['stats'],
                'rolls' => $mod['rolls'],
                'families' => $mod['families'],
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
     * @param  list<mixed>  $stats  the item's raw author modifiers (untrusted shape)
     * @param  ?string  $modDomain  the base's mod domain, or null when no base is chosen
     * @param  list<string>  $baseTags  the base's tags, or empty when no base is chosen
     * @return list<string>
     */
    public function modErrors(string $rarity, array $stats, ?string $modDomain = null, array $baseTags = []): array
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

            if ($baseTags !== [] && ! $this->canRollOn($mod, $modDomain, $baseTags)) {
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
     * Whether a mod can roll on an item: its GGPK domain must match the base's (a base
     * only takes mods of its own `modDomain`), and then the first of its spawn weights
     * whose tag the item has (or the catch-all `default`) must be positive. The domain
     * gate is first and non-optional - mods of foreign domains (Monster, Heist, …) carry
     * a positive default weight and would otherwise leak through the tag gate alone.
     *
     * @param  array{domain: string, spawnWeights: list<array{tag: string, weight: int}>}  $mod
     * @param  list<string>  $baseTags
     */
    private function canRollOn(array $mod, ?string $modDomain, array $baseTags): bool
    {
        if ($mod['domain'] !== $modDomain) {
            return false;
        }

        foreach ($mod['spawnWeights'] as $weight) {
            if ($weight['tag'] === 'default' || in_array($weight['tag'], $baseTags, true)) {
                return $weight['weight'] > 0;
            }
        }

        return false;
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
     * @param  array{id: string, name: string, domain: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, spawnWeights: list<array{tag: string, weight: int}>}  $mod
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
     * @return array<string, array{id: string, name: string, domain: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, spawnWeights: list<array{tag: string, weight: int}>}>
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
     * @return list<array{id: string, name: string, domain: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, spawnWeights: list<array{tag: string, weight: int}>}>
     */
    private function all(): array
    {
        return $this->mods ??= $this->remembered('mods', function (): array {
            $path = dirname(__DIR__, 2).'/resources/poe2/ggpk/mods.json';

            if (! is_file($path)) {
                return [];
            }

            $decoded = json_decode((string) file_get_contents($path), true);

            if (! is_array($decoded)) {
                return [];
            }

            /** @var list<array{id: string, name: string, domain: string, group: ?string, type: string, tier: ?int, level: int, stats: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, spawnWeights: list<array{tag: string, weight: int}>}> $decoded */
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
