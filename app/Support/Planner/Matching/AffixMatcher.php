<?php

declare(strict_types=1);

namespace App\Support\Planner\Matching;

use App\Pob\ModCatalogue;

/**
 * Reverse-matches an item's rendered author-mod lines to GGPK affix ids. Lines are read
 * in order and matched against the affixes that can roll on the item's base, picking
 * the tier whose value range(s) contain the rolled value(s). A hybrid affix renders as
 * several consecutive PoB lines, so a multi-stat candidate is matched over that many
 * lines at once (the longest match wins, so a hybrid's first line isn't stolen by a
 * single-stat affix). Per-rarity prefix/suffix caps and mutual-exclusion families are
 * respected, so the result always passes {@see ModCatalogue::modErrors}. Every matched
 * line is frozen into a full snapshot ({@see ModCatalogue::modSnapshot}) rather than a
 * bare id, so a future GGPK patch renaming or dropping the id can never invalidate an
 * already-produced result. Lines that don't resolve (unknown wording, out-of-range
 * rolls, a hybrid whose lines don't all fit) are reported back as dropped.
 *
 * @phpstan-type AffixCandidate array{id: string, type: string, statCount: int, template: string, statTemplates: list<string>, rolls: list<array{stat: string, min: int, max: int}>, families: list<string>, crafted: bool, ladder: bool}
 */
final readonly class AffixMatcher
{
    /**
     * The most catalyst quality is assumed to inflate a jewellery roll. Ordinary
     * catalysts reach +20%, but "+X% to Maximum Quality" modifiers and implicits stack
     * well past that (a corrupted Refined Breach Ring shows +73%). Kept a bound at all
     * so an arbitrary wrong value can't claim a tier; used as a last resort only,
     * after aggregate decomposition.
     */
    private const float MAX_CATALYST_QUALITY = 2.0;

    public function __construct(
        private ModCatalogue $mods,
        private AggregateSplitter $splitter = new AggregateSplitter,
    ) {}

    /**
     * Match an item's rendered lines against the affixes its base can carry. $catalyst
     * marks a catalyst-taking slot (jewellery), where a still-unexplained value may be
     * a real roll inflated by quality. Returns the matched stats and the lines that
     * could not be explained.
     *
     * @param  list<string>  $lines
     * @param  list<string>  $tags
     * @return array{stats: list<array{modId: ?string, text: string, name: ?string, type: ?string, family: ?string, tier: ?int, rolls: ?list<array{stat: string, min: int|float, max: int|float}>, values: list<int|float>}>, dropped: list<string>}
     */
    public function match(array $lines, ?string $domain, array $tags, ?string $itemClass, int $maxPerType, bool $catalyst): array
    {
        if ($maxPerType === 0 || $domain === null || $tags === []) {
            return ['stats' => [], 'dropped' => $lines];
        }

        $candidates = $this->candidates($domain, $tags, $itemClass);

        // Desecrated, essence and genesis-tree affixes reach a base only through
        // crafting, so they must not compete with naturally rolling affixes: the
        // desecrated life+mana hybrid would otherwise steal two adjacent natural lines
        // (the longest match wins). They join as a second pass, only for lines no
        // natural affix explains.
        $natural = array_values(array_filter(
            $candidates,
            static fn (array $candidate): bool => ! $candidate['crafted'],
        ));

        $context = new MatchContext;
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
        $unmatched = $this->splitter->decompose($unmatched, $lines, $candidates, $maxPerType, $context);

        // Last resort on catalyst slots: a still-unexplained value may be a real roll
        // inflated by quality (PoB folds it into the render and exports no quality line
        // for jewellery), so match it against its tier clamped. After decomposition on
        // purpose - a summed line splits value-exactly, clamping loses the excess.
        if ($catalyst) {
            $unmatched = array_values(array_filter(
                $unmatched,
                fn (string $line): bool => ! $this->assignQualityInflated($line, $candidates, $maxPerType, $context),
            ));
        }

        // Freeze every matched line into a full snapshot now, while the catalogue lookup
        // is still cheap and certain - nothing downstream ever resolves a modId again.
        $stats = array_map(
            fn (array $stat): array => $this->mods->modSnapshot($stat['modId'], $stat['values'], $stat['text']),
            $context->stats,
        );

        return ['stats' => $stats, 'dropped' => $unmatched];
    }

    /**
     * Assign one line's viable options into the running item context: the first
     * generation type with a free slot and no family clash wins. Returns whether the
     * line was placed.
     *
     * @param  array<string, array{id: string, values: list<int|float>, families: list<string>, text: string}>  $options
     */
    private function assignOptions(array $options, int $maxPerType, MatchContext $context): bool
    {
        foreach ($options as $type => $option) {
            if (($context->counts[$type] ?? 0) < $maxPerType
                && array_intersect($option['families'], $context->families) === []) {
                $context->counts[$type]++;
                $context->families = [...$context->families, ...$option['families']];
                $context->stats[] = ['modId' => $option['id'], 'values' => $option['values'], 'text' => $option['text']];

                return true;
            }
        }

        return false;
    }

    /**
     * Match a single leftover line allowing quality inflation (value over the tier's
     * ceiling, stored clamped) and assign it into the context. Returns whether it landed.
     *
     * @param  list<AffixCandidate>  $candidates
     */
    private function assignQualityInflated(string $line, array $candidates, int $maxPerType, MatchContext $context): bool
    {
        $options = $this->matchOptions([$line], 0, $candidates, quality: true);

        return $options !== null && $this->assignOptions($options['options'], $maxPerType, $context);
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
     * @return list<AffixCandidate>
     */
    private function candidates(string $domain, array $tags, ?string $itemClass): array
    {
        $candidates = [];

        // No group limit: the reverse-match must see every affix the base can carry,
        // not the first page the editor's search UI shows.
        foreach ($this->mods->search($domain, $tags, '', PHP_INT_MAX, $itemClass) as $group) {
            foreach ($group['tiers'] as $tier) {
                $statTemplates = array_map(ModLineText::template(...), $tier['stats']);

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
     * @param  list<AffixCandidate>  $candidates
     * @return array{statCount: int, lines: list<string>, options: array<string, array{id: string, values: list<int|float>, families: list<string>, text: string}>}|null
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

            $values = self::canonicalValues($candidate['rolls'], ModLineText::numbers(implode("\n", $ordered)), $quality);

            if ($values !== null) {
                $viable[] = [
                    'statCount' => $statCount,
                    'type' => $candidate['type'],
                    'id' => $candidate['id'],
                    'values' => $values,
                    'families' => $candidate['families'],
                    'ceiling' => max([0, ...array_column($candidate['rolls'], 'max')]),
                    // The window's own on-screen order, not the candidate's stat order -
                    // the frozen snapshot keeps exactly what the author saw rendered.
                    'text' => implode("\n", $window),
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
                    'text' => $match['text'],
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
            $found = array_find_key($window, fn ($line, $i) => ! isset($used[$i]) && ModLineText::template($line) === $statTemplate);
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
                    $renderings[] = ModLineText::asWhole(round($value * 60, 4));
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
}
