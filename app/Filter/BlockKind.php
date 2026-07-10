<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * The opening keyword of a filter block: whether matched items are shown, hidden, or
 * shown minimally (no beam/sound, small label).
 */
enum BlockKind: string
{
    case Show = 'Show';
    case Hide = 'Hide';
    case Minimal = 'Minimal';
}
