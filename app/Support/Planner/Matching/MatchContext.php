<?php

declare(strict_types=1);

namespace App\Support\Planner\Matching;

/**
 * The running state of one item's reverse-match: the affixes assigned so far, the
 * per-generation-type counts and the mutual-exclusion families already claimed.
 * Mutated in place as the matcher and the aggregate splitter place lines.
 */
final class MatchContext
{
    /** @var list<array{modId: string, values: list<int|float>}> */
    public array $stats = [];

    /** @var array<string, int> */
    public array $counts = ['prefix' => 0, 'suffix' => 0];

    /** @var list<string> */
    public array $families = [];
}
