<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * A boolean item-state condition, e.g. `Identified True`, `Corrupted False`,
 * `Mirrored False`.
 */
final readonly class FlagCondition implements Condition
{
    public function __construct(
        private string $keyword,
        private bool $value,
    ) {}

    public function render(): string
    {
        return $this->keyword.' '.($this->value ? 'True' : 'False');
    }
}
