<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * The named colours the game accepts for `MinimapIcon` and `PlayEffect` (these take a
 * colour name, not an RGB triple, unlike the `Set*Color` actions).
 */
enum FilterColor: string
{
    case Red = 'Red';
    case Green = 'Green';
    case Blue = 'Blue';
    case Yellow = 'Yellow';
    case Cyan = 'Cyan';
    case White = 'White';
    case Pink = 'Pink';
    case Purple = 'Purple';
    case Orange = 'Orange';
    case Brown = 'Brown';
    case Grey = 'Grey';

    /**
     * A representative hex for rendering this named colour in an on-page preview (the game
     * resolves the name itself; this is only for the web mock's minimap-style glyph).
     */
    public function hex(): string
    {
        return match ($this) {
            self::Red => '#e5342b',
            self::Green => '#57c46a',
            self::Blue => '#4a7bd6',
            self::Yellow => '#f2c94c',
            self::Cyan => '#37c7d4',
            self::White => '#eef0f4',
            self::Pink => '#ef62c8',
            self::Purple => '#a45ee8',
            self::Orange => '#e8862f',
            self::Brown => '#a86a3e',
            self::Grey => '#9aa0ab',
        };
    }
}
