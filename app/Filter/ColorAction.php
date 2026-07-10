<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * A `SetTextColor` / `SetBorderColor` / `SetBackgroundColor` action carrying an RGBA
 * {@see Color}.
 */
final readonly class ColorAction implements Action
{
    public function __construct(
        private string $keyword,
        private Color $color,
    ) {}

    public function render(): string
    {
        return "{$this->keyword} {$this->color->render()}";
    }
}
