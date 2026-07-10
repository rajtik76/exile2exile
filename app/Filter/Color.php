<?php

declare(strict_types=1);

namespace App\Filter;

use InvalidArgumentException;

/**
 * An RGBA colour for a `Set*Color` action. Each channel is 0-255; alpha defaults to fully
 * opaque. Rendered as the space-separated quad the game expects (`255 0 0 255`).
 */
final readonly class Color
{
    public function __construct(
        public int $red,
        public int $green,
        public int $blue,
        public int $alpha = 255,
    ) {
        foreach (['red' => $red, 'green' => $green, 'blue' => $blue, 'alpha' => $alpha] as $channel => $value) {
            if ($value < 0 || $value > 255) {
                throw new InvalidArgumentException("Colour channel {$channel} must be 0-255, got {$value}.");
            }
        }
    }

    public function render(): string
    {
        return "{$this->red} {$this->green} {$this->blue} {$this->alpha}";
    }
}
