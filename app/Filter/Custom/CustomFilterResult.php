<?php

declare(strict_types=1);

namespace App\Filter\Custom;

/**
 * What {@see CustomFilterTransformer::apply()} did to a body: the transformed text, the picks
 * that actually flipped a block (in the caller's order), and the base-type names those muted
 * blocks matched on - so the economy overlay can leave the player's hidden categories hidden
 * instead of re-showing them from live prices.
 *
 * The two name lists mirror the game's own BaseType semantics: `BaseType == "X"` matches the
 * exact name, while a bare `BaseType "X"` matches any name containing X - which is how one
 * muted "Uncut Support Gem" line hides every per-level "Uncut Support Gem (Level n)" drop.
 */
final readonly class CustomFilterResult
{
    /**
     * @param  list<FilterCategory>  $applied
     * @param  list<string>  $hiddenBaseTypes  Exact names, from `BaseType == ...` lines.
     * @param  list<string>  $hiddenBaseTypeSubstrings  Substring names, from bare `BaseType ...` lines.
     */
    public function __construct(
        public string $body,
        public array $applied,
        public array $hiddenBaseTypes,
        public array $hiddenBaseTypeSubstrings,
    ) {}

    /** Whether an economy item's base type falls under any muted block's BaseType condition. */
    public function hidesBaseType(string $baseType): bool
    {
        if (in_array($baseType, $this->hiddenBaseTypes, true)) {
            return true;
        }

        return array_any($this->hiddenBaseTypeSubstrings, static fn (string $needle): bool => str_contains($baseType, $needle));
    }
}
