<?php

declare(strict_types=1);

namespace App\Filter\Custom;

/**
 * What {@see CustomFilterTransformer::apply()} did to a body: the transformed text, the picks
 * that actually flipped a block (in the caller's order), and the base types those muted blocks
 * matched on - so the economy overlay can leave the player's hidden categories hidden instead
 * of re-showing them from live prices.
 */
final readonly class CustomFilterResult
{
    /**
     * @param  list<FilterCategory>  $applied
     * @param  list<string>  $hiddenBaseTypes
     */
    public function __construct(
        public string $body,
        public array $applied,
        public array $hiddenBaseTypes,
    ) {}
}
