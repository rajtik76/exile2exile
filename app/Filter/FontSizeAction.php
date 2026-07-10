<?php

declare(strict_types=1);

namespace App\Filter;

use InvalidArgumentException;

/**
 * A `SetFontSize` action. The game accepts sizes up to 45; larger drops read as more
 * important.
 */
final readonly class FontSizeAction implements Action
{
    private const int MAX_SIZE = 45;

    public function __construct(private int $size)
    {
        if ($size < 1 || $size > self::MAX_SIZE) {
            throw new InvalidArgumentException('Font size must be 1-'.self::MAX_SIZE.", got {$size}.");
        }
    }

    public function render(): string
    {
        return "SetFontSize {$this->size}";
    }
}
