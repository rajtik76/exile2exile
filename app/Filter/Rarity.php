<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * The four item rarities a filter's `Rarity` condition matches, spelled exactly as the
 * game expects them.
 */
enum Rarity: string
{
    case Normal = 'Normal';
    case Magic = 'Magic';
    case Rare = 'Rare';
    case Unique = 'Unique';
}
