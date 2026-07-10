<?php

declare(strict_types=1);

namespace App\Filter\Neversink;

use App\Filter\Action;
use App\Filter\StyleTheme;

/**
 * A {@see StyleTheme} whose looks are NeverSink's own, pulled from the loaded filter body by
 * {@see NeversinkStyleExtractor}. Each visual tier (1 = most important) maps to a NeverSink
 * block marker (e.g. `$type->currency $tier->s`); the actions returned are NeverSink's exact
 * styling lines, so an override block styled through this looks 1:1 like NeverSink.
 *
 * This is the seam that lets the existing economy / build-aware block builders emit their
 * overrides in NeverSink's visual language without knowing anything about it.
 */
final readonly class NeversinkStyleTheme implements StyleTheme
{
    /**
     * @param  list<list<string>>  $markerLadder  per visual tier (index 0 = tier 1), the list
     *                                            of NeverSink markers to try, most-preferred
     *                                            first, falling back when a strictness level
     *                                            dropped the specific block.
     */
    public function __construct(
        private NeversinkStyleExtractor $extractor,
        private array $markerLadder,
    ) {}

    public function styleFor(int $tier): array
    {
        $index = max(1, min($tier, count($this->markerLadder))) - 1;

        /** @var list<Action> $style */
        $style = $this->extractor->firstStyle($this->markerLadder[$index] ?? []);

        return $style;
    }
}
