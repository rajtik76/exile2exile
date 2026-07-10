<?php

declare(strict_types=1);

namespace App\Filter\Economy;

use InvalidArgumentException;

/**
 * Maps an item's price (in Exalted Orbs) to a visual tier via an ascending ladder of
 * breakpoints. Tier 1 is the top (dearest); a price below the lowest breakpoint returns
 * null - "not valuable enough to surface". This is the algorithmic stand-in for
 * NeverSink's hand-maintained economy tierlists: the breakpoints are the whole policy, so
 * they can be tuned or swapped (a future percentile mode) without touching the generator.
 */
final readonly class PriceTierPolicy
{
    /**
     * @param  list<float>  $breakpoints  ascending Exalted thresholds; index 0 is the floor
     */
    public function __construct(private array $breakpoints)
    {
        if ($breakpoints === []) {
            throw new InvalidArgumentException('A price tier policy needs at least one breakpoint.');
        }

        $sorted = $breakpoints;
        sort($sorted);

        if ($sorted !== $breakpoints) {
            throw new InvalidArgumentException('Price tier breakpoints must be in ascending order.');
        }
    }

    /**
     * A sensible default ladder: floor at 1ex, then 5 / 20 / 100 / 500ex - five tiers of
     * increasing value.
     */
    public static function default(): self
    {
        return new self([1.0, 5.0, 20.0, 100.0, 500.0]);
    }

    public function tierCount(): int
    {
        return count($this->breakpoints);
    }

    /**
     * The price at which an item reaches a given tier (1 = dearest). Used to work out how
     * large a stack of a cheaper currency must be for its total value to reach that tier.
     */
    public function floorFor(int $tier): float
    {
        $count = count($this->breakpoints);
        $index = $count - max(1, min($tier, $count));

        return $this->breakpoints[$index];
    }

    /**
     * The tier a price falls into: 1 (dearest) down to {@see tierCount()}, or null when it
     * sits below the floor. The highest breakpoint the price meets wins.
     */
    public function tierOf(float $price): ?int
    {
        $count = count($this->breakpoints);

        for ($index = $count - 1; $index >= 0; $index--) {
            if ($price >= $this->breakpoints[$index]) {
                return $count - $index;
            }
        }

        return null;
    }
}
