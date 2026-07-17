<?php

declare(strict_types=1);

namespace App\Support\Planner\Matching;

use App\Pob\ModCatalogue;

/**
 * Text helpers for rendered mod lines: collapsing a line to its number-free template
 * and pulling the rolled numbers back out, shared by the affix matcher and the
 * aggregate splitter.
 */
final class ModLineText
{
    /**
     * Collapse a stat line to a stable, number-free template: ranged rolls "(46-50)"
     * first, then any remaining bare number, both to "#". Mirrors
     * {@see ModCatalogue::previewLine} so a rendered line and an affix template compare
     * equal.
     */
    public static function template(string $stat): string
    {
        $line = (string) preg_replace('/\(-?\d+(?:\.\d+)?--?\d+(?:\.\d+)?\)/', '#', $stat);

        return (string) preg_replace('/-?\d+(?:\.\d+)?/', '#', $line);
    }

    /**
     * The numbers in a rendered mod line, in order, as ints where whole.
     *
     * @return list<int|float>
     */
    public static function numbers(string $line): array
    {
        preg_match_all('/-?\d+(?:\.\d+)?/', $line, $matches);

        return array_map(
            static fn (string $number): int|float => str_contains($number, '.') ? (float) $number : (int) $number,
            $matches[0],
        );
    }

    /** A float that is a whole number as int (15.0 becomes 15), anything else unchanged. */
    public static function asWhole(int|float $value): int|float
    {
        return is_float($value) && floor($value) === $value ? (int) $value : $value;
    }
}
