<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * One condition line inside a filter block (e.g. `Class == "Boots"`,
 * `ItemLevel >= 82`). All conditions in a block are ANDed by the game. Build instances
 * through {@see Conditions} rather than directly, so the keyword and operator are always
 * a valid pairing.
 */
interface Condition
{
    /** The single filter line this condition renders to, without indentation. */
    public function render(): string;
}
