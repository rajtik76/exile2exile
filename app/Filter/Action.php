<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * One styling / behaviour line inside a filter block - colour, font size, minimap icon,
 * beam, sound, drop-sound toggle. Build instances through {@see Actions}.
 */
interface Action
{
    /** The single filter line this action renders to, without indentation. */
    public function render(): string;
}
