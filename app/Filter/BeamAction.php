<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * A `PlayEffect` action: the light beam over a dropped item. Marked temporary shows the
 * beam only briefly on drop; otherwise it stays until the item is picked up.
 */
final readonly class BeamAction implements Action
{
    public function __construct(
        private FilterColor $color,
        private bool $temporary = false,
    ) {}

    public function render(): string
    {
        return $this->temporary
            ? "PlayEffect {$this->color->value} Temp"
            : "PlayEffect {$this->color->value}";
    }
}
