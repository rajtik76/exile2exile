<?php

declare(strict_types=1);

namespace App\Support\Planner\Matching;

use App\Pob\ModCatalogue;

/**
 * The running state of one item's reverse-match: the affixes assigned so far, the
 * per-generation-type counts and the mutual-exclusion families already claimed.
 * Mutated in place as the matcher and the aggregate splitter place lines.
 */
final class MatchContext
{
    /**
     * The literal rendered line(s) are kept alongside the matched id/values, so the
     * caller can freeze a full snapshot instead of a live reference (see
     * {@see ModCatalogue::modSnapshot}).
     *
     * @var list<array{modId: string, values: list<int|float>, text: string}>
     */
    public array $stats = [];

    /** @var array<string, int> */
    public array $counts = ['prefix' => 0, 'suffix' => 0];

    /** @var list<string> */
    public array $families = [];
}
