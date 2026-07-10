<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * A bare on/off action with no arguments, e.g. `DisableDropSound` / `EnableDropSound`.
 */
final readonly class ToggleAction implements Action
{
    public function __construct(private string $keyword) {}

    public function render(): string
    {
        return $this->keyword;
    }
}
