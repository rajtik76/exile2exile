<?php

declare(strict_types=1);

namespace App\Pob\GameData;

use App\Pob\GemRequirements;
use App\Pob\PobImport;
use App\Support\Planner\PlanReferences;

/**
 * The gem catalogue built from the GGPK-derived mapping: icon, socket colour, kind,
 * description, tags, hover art, per-level tooltip scaling and requirement ranges.
 */
final class GemCatalog
{
    /**
     * Tags already surfaced elsewhere and redundant as gameplay descriptors:
     * "Support" duplicates the "Support Gem" category line.
     *
     * @var list<string>
     */
    private const array HIDDEN_GEM_TAGS = ['Support'];

    /**
     * The game's own character level cap. Not itself a GGPK table value - a gem level
     * whose required character level exceeds this is unreachable through normal play,
     * so the in-game tooltip's "Requires:" line never shows it (confirmed against a
     * live reference tooltip: Arc's requirement range tops out at gem level 19/char
     * level 90, not gem level 20/char level 97 - {@see requires}).
     */
    private const int GEM_MAX_CHARACTER_LEVEL = 90;

    /**
     * @var array<string, array{name: string, icon: ?string, color: string, type: string, description: ?string, tags: list<string>, hoverImage: ?string}>|null
     */
    private ?array $gemIndex = null;

    /**
     * Per-level tooltip scaling from resources/poe2/ggpk/gem_scaling.json (see
     * tools/poe-data-extract and the gem-extractor package's README for the shape).
     *
     * @var array<string, array{name: string, levels: list<array{level: int, cost: ?int, castTime: ?float, cooldown: ?float, reservation: ?float, spellCritChance: ?float, attackCritChance: ?float, stats: list<array{text: string, min: float, max: float}>}>, qualityStats: list<array{text: string, min: float, max: float}>}>|null
     */
    private ?array $gemScalingIndex = null;

    /**
     * @var array<string, array{name: string, levels: array<int, array{requiredLevel: int, str: int, dex: int, int: int}>}>|null
     */
    private ?array $gemRequirementsIndex = null;

    public function __construct(
        private readonly GameDataStore $store,
        private readonly GemRequirements $gemRequirements = new GemRequirements,
    ) {}

    /**
     * Every gem entry keyed by gem id, for callers that scan the whole catalogue
     * (the reference-picker search).
     *
     * @return array<string, array{name: string, icon: ?string, color: string, type: string, description: ?string, tags: list<string>, hoverImage: ?string}>
     */
    public function all(): array
    {
        return $this->gems();
    }

    /**
     * Web path to a gem's icon, or null when the gem is unknown or its art is missing.
     */
    public function icon(?string $gemId): ?string
    {
        if ($gemId === null || $gemId === '') {
            return null;
        }

        $entry = $this->gems()[$gemId] ?? null;

        return $entry === null ? null : $this->store->webPathIfPresent($entry['icon']);
    }

    /**
     * Gem socket colour as a single letter: b (int), g (dex), r (str), w (white).
     */
    public function color(?string $gemId): ?string
    {
        if ($gemId === null || $gemId === '') {
            return null;
        }

        return $this->gems()[$gemId]['color'] ?? null;
    }

    /**
     * Human label for a gem's kind: "Skill Gem", "Support Gem" or "Spirit Gem".
     */
    public function category(?string $gemId): ?string
    {
        if ($gemId === null || $gemId === '') {
            return null;
        }

        return match ($this->gems()[$gemId]['type'] ?? null) {
            'support' => 'Support Gem',
            'spirit' => 'Spirit Gem',
            'active' => 'Skill Gem',
            default => null,
        };
    }

    /**
     * Readable gem description. The GGPK mapping carries text for every gem kind
     * (active/spirit from the skill description, support from its support text).
     */
    public function description(?string $gemId): ?string
    {
        if ($gemId === null || $gemId === '') {
            return null;
        }

        $text = $this->gems()[$gemId]['description'] ?? null;

        return is_string($text) && $text !== '' ? $this->stripBbcode($text) : null;
    }

    /**
     * Gem tags (e.g. attack, projectile, melee), in reference-data order.
     *
     * @return list<string>
     */
    public function tags(?string $gemId): array
    {
        if ($gemId === null || $gemId === '') {
            return [];
        }

        return $this->gems()[$gemId]['tags'] ?? [];
    }

    /**
     * Web path to a gem's hover-art background (the SmartHover/GemHoverImage art the
     * game paints behind the tooltip, top-right). Falls back to the client's own
     * generic placeholder (crystals on a dark background) when the gem has no
     * specific art - the same fallback the game itself paints, decoded from GGPK
     * (`SmartHover/GemHoverImage/GemHoverImageEmpty.dds`) rather than approximated.
     *
     * Specific-art coverage is genuinely sparse in the game's own data: no support
     * gem has hover art, and only a fraction of active/spirit gems do on the current
     * patch (see the gem-extractor package's README) - falling back to the
     * placeholder is the expected steady state for most gems, not a missing-asset bug.
     */
    public function hoverImage(?string $gemId): ?string
    {
        if ($gemId === null || $gemId === '') {
            return null;
        }

        $entry = $this->gems()[$gemId] ?? null;

        if ($entry === null) {
            return null;
        }

        return $this->store->webPathIfPresent($entry['hoverImage'])
            ?? $this->store->webPathIfPresent('ui/gem-hover-placeholder.png');
    }

    /**
     * Per-level tooltip scaling for a gem - cost, cast time, crit chance and the
     * scaling stat lines a level-scaling slider needs, plus the quality bonus lines.
     * Null when the gem has no resolved stat set (see gem_scaling.json's own caveats).
     *
     * @return array{name: string, levels: list<array{level: int, cost: ?int, castTime: ?float, cooldown: ?float, reservation: ?float, spellCritChance: ?float, attackCritChance: ?float, stats: list<array{text: string, min: float, max: float}>}>, qualityStats: list<array{text: string, min: float, max: float}>}|null
     */
    public function scaling(?string $gemId): ?array
    {
        if ($gemId === null || $gemId === '') {
            return null;
        }

        return $this->gemScalingIndex()[$gemId] ?? null;
    }

    /**
     * A gem's level/attribute requirement range, as the game's own tooltip shows it:
     * gem level 1's requirement through the highest gem level still reachable at
     * {@see GEM_MAX_CHARACTER_LEVEL} - a level needing more than that is unreachable
     * through normal play, so the in-game tooltip never shows it. An attribute the
     * gem never needs (weight 0 throughout) is omitted entirely, matching the
     * in-game "Requires:" line, which never lists an attribute the gem doesn't need.
     *
     * Known gap: the underlying curve rounds any requirement under 8 down to 0
     * (ported from Path of Building's own formula - see {@see GemRequirements}),
     * so a gem whose true level-1 requirement is a small nonzero value (the reference
     * tooltip shows Arc needing 4 Int at level 1) shows 0 here instead. This is a
     * known precision gap in the source data, not a bug in this method.
     *
     * @return array{level: array{int, int}, str: array{int, int}|null, dex: array{int, int}|null, int: array{int, int}|null}|null
     */
    public function requires(?string $gemId): ?array
    {
        if ($gemId === null || $gemId === '') {
            return null;
        }

        $curve = $this->gemRequirementsIndex()[$gemId]['levels'] ?? null;

        if ($curve === null || $curve === []) {
            return null;
        }

        // Levels are keyed by gem level as a string ("1", "2", ...) in insertion
        // order matching the curve, so the lowest level is simply the first entry -
        // avoids assuming key "1" exists (it always does in practice, but nothing
        // guarantees it statically).
        $first = reset($curve);
        $reachable = array_filter(
            $curve,
            static fn (array $row): bool => $row['requiredLevel'] <= self::GEM_MAX_CHARACTER_LEVEL,
        );
        $last = $reachable !== [] ? end($reachable) : $first;

        $range = static fn (int $a, int $b): array => [$a, $b];

        return [
            'level' => $range($first['requiredLevel'], $last['requiredLevel']),
            'str' => $last['str'] > 0 ? $range($first['str'], $last['str']) : null,
            'dex' => $last['dex'] > 0 ? $range($first['dex'], $last['dex']) : null,
            'int' => $last['int'] > 0 ? $range($first['int'], $last['int']) : null,
        ];
    }

    /**
     * Whether a gem of the given GGPK kind ('active', 'support', 'spirit') belongs in
     * the requested picker slot: a group's first slot is a skill (active or spirit),
     * every later slot is a support - so the two never mix.
     */
    public function matchesKind(string $type, string $gemKind): bool
    {
        return $gemKind === 'support'
            ? $type === 'support'
            : $type !== 'support';
    }

    /**
     * Strip PoE bbcode markup from descriptive text: "[Curse]" -> "Curse",
     * "[Charges|Power Charges]" -> "Power Charges" (the display half after the pipe).
     */
    private function stripBbcode(string $text): string
    {
        return (string) preg_replace_callback(
            '/\[([^\]]+)\]/',
            static function (array $m): string {
                $inner = $m[1];
                $pipe = strrpos($inner, '|');

                return $pipe === false ? $inner : substr($inner, $pipe + 1);
            },
            $text,
        );
    }

    /**
     * Build the gem index from the GGPK-derived mapping (already keyed by the
     * gem id's last path segment, matching {@see PobImport::normalizeGemId}).
     *
     * @return array<string, array{name: string, icon: ?string, color: string, type: string, description: ?string, tags: list<string>, hoverImage: ?string}>
     */
    private function gems(): array
    {
        return $this->gemIndex ??= $this->store->remembered('gems', function (): array {
            $index = [];

            foreach ($this->store->load('ggpk/gems.json') as $segment => $value) {
                $index[(string) $segment] = [
                    'name' => (string) ($value['name'] ?? ''),
                    'icon' => $this->store->ddsToPng($value['icon'] ?? null),
                    'color' => (string) ($value['color'] ?? 'w'),
                    'type' => (string) ($value['kind'] ?? 'active'),
                    'description' => $value['description'] ?? null,
                    'tags' => array_values(array_filter(
                        (array) ($value['tags'] ?? []),
                        fn (mixed $tag): bool => is_string($tag) && ! in_array($tag, self::HIDDEN_GEM_TAGS, true),
                    )),
                    'hoverImage' => $this->store->ddsToPng($value['hoverImage'] ?? null),
                ];
            }

            return $index;
        });
    }

    /**
     * Load the per-level tooltip scaling index (resources/poe2/ggpk/gem_scaling.json),
     * already keyed by gem id and shaped exactly as {@see scaling} returns it.
     *
     * @return array<string, array{name: string, levels: list<array{level: int, cost: ?int, castTime: ?float, cooldown: ?float, reservation: ?float, spellCritChance: ?float, attackCritChance: ?float, stats: list<array{text: string, min: float, max: float}>}>, qualityStats: list<array{text: string, min: float, max: float}>}>
     */
    private function gemScalingIndex(): array
    {
        return $this->gemScalingIndex ??= $this->store->remembered('gem_scaling', function (): array {
            /** @var array<string, array{name: string, levels: list<array{level: int, cost: ?int, castTime: ?float, cooldown: ?float, reservation: ?float, spellCritChance: ?float, attackCritChance: ?float, stats: list<array{text: string, min: float, max: float}>}>, qualityStats: list<array{text: string, min: float, max: float}>}> $decoded */
            $decoded = $this->store->load('ggpk/gem_scaling.json');

            return $decoded;
        });
    }

    /**
     * The per-level level/attribute requirement curve, keyed by gem id - reuses
     * {@see GemRequirements}, the same class {@see PlanReferences}
     * relies on for build-gating, so the file is parsed once per shape rather than
     * independently in both places. Wrapped in {@see GameDataStore::remembered()} for
     * the across-request caching that class doesn't provide on its own.
     *
     * @return array<string, array{name: string, levels: array<int, array{requiredLevel: int, str: int, dex: int, int: int}>}>
     */
    private function gemRequirementsIndex(): array
    {
        return $this->gemRequirementsIndex ??= $this->store->remembered(
            'gem_requirements',
            fn (): array => $this->gemRequirements->all(),
        );
    }
}
