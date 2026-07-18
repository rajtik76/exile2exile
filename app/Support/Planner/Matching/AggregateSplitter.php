<?php

declare(strict_types=1);

namespace App\Support\Planner\Matching;

/**
 * Splits summed (aggregate) mod lines back into the real affixes behind them. The game
 * renders same-stat rolls added together, so a rendered line can top every single
 * tier's ceiling - the true item carries several mods that only show as one line.
 *
 * @phpstan-import-type AffixCandidate from AffixMatcher
 */
final class AggregateSplitter
{
    /**
     * Split summed lines back into real affixes. Two shapes are recovered: a pure affix
     * plus a two-stat hybrid whose companion stat is another summed line (e.g. Legend's
     * 94% + Predator's 41% and its +46 life), and two pure affixes of the same wording
     * from different families (a natural tier plus a craft-only desecrated/genesis tier,
     * e.g. "147% increased Energy Shield" or a doubled "Adds X to Y Lightning damage").
     * Lines it can't split are returned still unmatched. Best-effort: the split's exact
     * tiers aren't recoverable from a sum, but the totals match what the game shows.
     *
     * @param  list<string>  $unmatched
     * @param  list<string>  $lines
     * @param  list<AffixCandidate>  $candidates
     * @return list<string> the lines still unmatched after decomposition
     */
    public function decompose(array $unmatched, array $lines, array $candidates, int $maxPerType, MatchContext $context): array
    {
        $aggregates = $this->aggregateValues($lines);
        $stillUnmatched = [];

        // A hybrid split can fully explain a *different* unmatched line too (its
        // companion stat, when the companion's whole value came from the hybrid, no
        // separate pure tier needed) - e.g. splitting "111% increased Evasion and
        // Energy Shield" can fully account for a same-pass "+61 to Stun Threshold"
        // line. That companion's template is recorded here so its own turn through
        // this loop doesn't re-report it as still unmatched: its value already lives
        // in $context->stats via the hybrid, so re-adding it would be double-counted.
        $consumedTemplates = [];

        foreach ($unmatched as $line) {
            $template = ModLineText::template($line);
            $values = ModLineText::numbers($line);

            if (in_array($template, $consumedTemplates, true)) {
                continue;
            }

            if ($values === [] || ! $this->exceedsPureCeiling($candidates, $template, $values)) {
                $stillUnmatched[] = $line;

                continue;
            }

            $consumedCompanion = null;
            $split = (count($values) === 1
                ? $this->splitAggregate($template, $values[0], $aggregates, $candidates, $maxPerType, $context, $consumedCompanion)
                : null)
                ?? $this->splitPurePair($template, $values, $candidates, $maxPerType, $context);

            if ($split === null) {
                $stillUnmatched[] = $line;
            } elseif ($consumedCompanion !== null) {
                $consumedTemplates[] = $consumedCompanion;
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
     * @param  list<AffixCandidate>  $candidates
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
     * @param  list<AffixCandidate>  $candidates
     */
    private function splitPurePair(string $template, array $values, array $candidates, int $maxPerType, MatchContext $context): ?bool
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
     * @param  array{id: string, type: string, families: list<string>, statTemplates: list<string>}  $first
     * @param  list<int|float>  $firstValues
     * @param  array{id: string, type: string, families: list<string>, statTemplates: list<string>}  $second
     * @param  list<int|float>  $secondValues
     */
    private function applyPurePair(array $first, array $firstValues, array $second, array $secondValues, int $maxPerType, MatchContext $context): bool
    {
        $counts = $context->counts;
        $counts[$first['type']] = ($counts[$first['type']] ?? 0) + 1;
        $counts[$second['type']] = ($counts[$second['type']] ?? 0) + 1;

        if (($counts['prefix'] ?? 0) > $maxPerType || ($counts['suffix'] ?? 0) > $maxPerType) {
            return false;
        }

        $families = [...$context->families, ...$first['families'], ...$second['families']];

        if (count($families) !== count(array_unique($families))) {
            return false;
        }

        $context->counts = $counts;
        $context->families = $families;
        // No single literal line explains either half of a summed pair on its own, so
        // the text is best-effort rendered from the affix's own template.
        $context->stats[] = ['modId' => $first['id'], 'values' => $firstValues, 'text' => ModLineText::render($first['statTemplates'], $firstValues)];
        $context->stats[] = ['modId' => $second['id'], 'values' => $secondValues, 'text' => ModLineText::render($second['statTemplates'], $secondValues)];

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
            $values = ModLineText::numbers($line);

            if (count($values) === 1) {
                $aggregates[ModLineText::template($line)] = $values[0];
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
     * @param  list<AffixCandidate>  $candidates
     */
    private function splitAggregate(string $template, int|float $total, array $aggregates, array $candidates, int $maxPerType, MatchContext $context, ?string &$consumedCompanion = null): ?bool
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

                    $hybridValues = $this->orderedValues($hybrid, $primaryIndex, $primary, $companion);
                    $additions = [
                        ['modId' => $hybrid['id'], 'values' => $hybridValues, 'type' => $hybrid['type'], 'families' => $hybrid['families'], 'text' => ModLineText::render($hybrid['statTemplates'], $hybridValues)],
                    ];

                    if ($purePrimary !== null) {
                        $primaryValues = [$total - $primary];
                        $additions[] = ['modId' => $purePrimary, 'values' => $primaryValues, 'type' => $hybrid['type'], 'families' => $this->familiesOf($candidates, $purePrimary), 'text' => ModLineText::render($this->statTemplatesOf($candidates, $purePrimary), $primaryValues)];
                    }

                    if ($pureCompanion !== null) {
                        $companionValues = [$companionTotal - $companion];
                        $additions[] = ['modId' => $pureCompanion, 'values' => $companionValues, 'type' => $hybrid['type'], 'families' => $this->familiesOf($candidates, $pureCompanion), 'text' => ModLineText::render($this->statTemplatesOf($candidates, $pureCompanion), $companionValues)];
                    }

                    if ($this->applySplit($companionTemplate, $additions, $maxPerType, $candidates, $context)) {
                        if ($pureCompanion === null) {
                            $consumedCompanion = $companionTemplate;
                        }

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
     * @param  list<array{modId: string, values: list<int|float>, type: string, families: list<string>, text: string}>  $additions
     * @param  list<AffixCandidate>  $candidates
     */
    private function applySplit(string $companionTemplate, array $additions, int $maxPerType, array $candidates, MatchContext $context): bool
    {
        // The companion line first matched as a single pure mod; that mod is now the
        // hybrid + a smaller pure, so drop it before re-counting.
        $keptStats = [];
        $counts = $context->counts;
        $families = [];

        foreach ($context->stats as $stat) {
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
            $keptStats[] = ['modId' => $addition['modId'], 'values' => $addition['values'], 'text' => $addition['text']];
        }

        $context->stats = $keptStats;
        $context->counts = $counts;
        $context->families = $families;

        return true;
    }

    /**
     * The id of a pure (one-stat) affix of a template whose tier range contains a value, or
     * null when no tier fits (or the value is non-positive).
     *
     * @param  list<AffixCandidate>  $candidates
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
     * @param  list<AffixCandidate>  $candidates
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
     * @param  list<AffixCandidate>  $candidates
     * @return list<string>
     */
    private function statTemplatesOf(array $candidates, string $modId): array
    {
        foreach ($candidates as $candidate) {
            if ($candidate['id'] === $modId) {
                return $candidate['statTemplates'];
            }
        }

        return [];
    }

    /**
     * @param  list<AffixCandidate>  $candidates
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
     * @param  list<AffixCandidate>  $candidates
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
}
