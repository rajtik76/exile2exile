<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * A condition comparing a numeric item property against a threshold, e.g.
 * `ItemLevel >= 82`, `UnidentifiedItemTier >= 4`, `StackSize >= 10`.
 */
final readonly class NumericCondition implements Condition
{
    public function __construct(
        private string $keyword,
        private Operator $operator,
        private int $value,
    ) {}

    public function render(): string
    {
        return "{$this->keyword} {$this->operator->separator()}{$this->value}";
    }
}
