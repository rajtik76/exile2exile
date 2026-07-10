<?php

declare(strict_types=1);

namespace App\Filter;

use InvalidArgumentException;

/**
 * A `MinimapIcon` action: `MinimapIcon <size> <color> <shape>`. Size is 0-2, where 0 is
 * the largest - smaller numbers read as more important.
 */
final readonly class MinimapIconAction implements Action
{
    public function __construct(
        private int $size,
        private FilterColor $color,
        private MinimapShape $shape,
    ) {
        if ($size < 0 || $size > 2) {
            throw new InvalidArgumentException("Minimap icon size must be 0-2, got {$size}.");
        }
    }

    public function render(): string
    {
        return "MinimapIcon {$this->size} {$this->color->value} {$this->shape->value}";
    }
}
