<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * The icon shapes a `MinimapIcon` action can draw. The shape typically encodes an item
 * category; the colour and size encode its tier.
 */
enum MinimapShape: string
{
    case Circle = 'Circle';
    case Diamond = 'Diamond';
    case Hexagon = 'Hexagon';
    case Square = 'Square';
    case Star = 'Star';
    case Triangle = 'Triangle';
    case Cross = 'Cross';
    case Moon = 'Moon';
    case Raindrop = 'Raindrop';
    case Kite = 'Kite';
    case Pentagon = 'Pentagon';
    case UpsideDownHouse = 'UpsideDownHouse';
}
