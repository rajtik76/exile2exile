<?php

declare(strict_types=1);

namespace App\Pob\Uniques;

/**
 * A synced PoB unique mod line, e.g. `"+(80-120) to maximum Life"`, split into a stable
 * identity (`key`) and its ranged rolls. The key is the template with every `(min-max)`
 * token blanked to `#` - it survives a rolled value changing, and is the same shape a
 * concrete import line (`"+110 to maximum Life"`) reduces to, so matching the two is just
 * a key comparison. A line with no ranges (flavour text like "Unwavering Stance") has
 * itself as its own key and no rolls - nothing to input, just display text.
 */
final readonly class UniqueModLine
{
    private const string RANGE = '/\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/';

    /**
     * @param  list<array{min: float, max: float}>  $rolls
     */
    private function __construct(
        public string $template,
        public string $key,
        public array $rolls,
    ) {}

    public static function parse(string $template): self
    {
        $rolls = [];

        preg_match_all(self::RANGE, $template, $matches, PREG_SET_ORDER);

        foreach ($matches as $match) {
            $rolls[] = ['min' => (float) $match[1], 'max' => (float) $match[2]];
        }

        $key = preg_replace(self::RANGE, '#', $template) ?? $template;

        return new self($template, $key, $rolls);
    }

    /**
     * The concrete numbers in a matching line, in order, or null when the line's own key
     * (its numbers blanked the same way) doesn't match this template's.
     *
     * @return list<float>|null
     */
    public function matchConcrete(string $line): ?array
    {
        if ($this->rolls === []) {
            return $line === $this->template ? [] : null;
        }

        // A concrete import line has bare numbers, not "(min-max)" ranges; blanking any
        // literal range token first keeps this correct if $line is itself a template.
        $withoutRanges = preg_replace(self::RANGE, '#', $line) ?? $line;
        $key = preg_replace('/-?\d+(?:\.\d+)?/', '#', $withoutRanges) ?? $withoutRanges;

        if ($key !== $this->key) {
            return null;
        }

        preg_match_all('/-?\d+(?:\.\d+)?/', $line, $numberMatches);

        $values = array_map(static fn (string $n): float => (float) $n, $numberMatches[0]);

        return count($values) === count($this->rolls) ? $values : null;
    }
}
