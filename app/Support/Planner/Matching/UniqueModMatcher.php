<?php

declare(strict_types=1);

namespace App\Support\Planner\Matching;

use App\Pob\IconResolver;

/**
 * Reverse-matches a unique's rendered mod lines to its synced catalogue lines,
 * capturing the exact rolled value(s) PoB's export already carries (not a range -
 * "+110 to maximum Life", not "+(80-120)"). Unlike {@see AffixMatcher}, this reads
 * the item's raw, unsplit mod lines rather than the explicit slice: PoB's own
 * `Implicits: N` count for a unique's export does not agree with the catalogue's real
 * implicit count (verified against a live import - PoB counts leaked rune-bonus lines
 * as "implicit"), so it is not trusted here at all. Which catalogue line a raw line
 * matches - implicit or explicit - is what decides that split, not PoB's count.
 */
final readonly class UniqueModMatcher
{
    public function __construct(private IconResolver $icons) {}

    /**
     * Match a unique's raw mod lines against its synced catalogue lines.
     *
     * A socketed rune can add its own "Bonded: ..." lines ahead of the unique's real
     * mods (a PoE2 same-rune-pair bonus) - those are the rune's, not the unique's, and
     * are dropped before matching ever runs. Anything left over that still doesn't
     * match a known catalogue line (an unsynced/renamed mod) is returned unmatched,
     * same as an unresolved rare/magic affix.
     *
     * @param  list<string>  $rawLines
     * @return array{matched: list<array{key: string, values: list<float>}>, unmatched: list<string>}
     */
    public function match(string $uniqueName, array $rawLines): array
    {
        $lines = array_values(array_filter(
            $rawLines,
            static fn (string $line): bool => ! str_starts_with($line, 'Bonded:'),
        ));

        $catalogue = $this->icons->uniqueModLines($uniqueName);
        $candidates = [...$catalogue['implicits'], ...$catalogue['mods']];

        // No synced data for this unique at all (sync hasn't run yet, or it isn't in PoB's
        // catalogue) is a different situation from a genuinely unrecognised wording - there
        // is nothing to check against, so nothing is "dropped" (that would just be noise).
        if ($candidates === []) {
            return ['matched' => [], 'unmatched' => []];
        }

        $matched = [];
        $unmatched = [];

        foreach ($lines as $line) {
            $values = null;

            foreach ($candidates as $candidate) {
                $values = $candidate->matchConcrete($line);

                if ($values !== null) {
                    $matched[] = ['key' => $candidate->key, 'values' => $values];
                    break;
                }
            }

            if ($values === null) {
                $unmatched[] = $line;
            }
        }

        return ['matched' => $matched, 'unmatched' => $unmatched];
    }
}
