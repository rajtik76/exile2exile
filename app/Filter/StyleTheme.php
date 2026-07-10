<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * Resolves a visual tier (1 = most important) to the concrete filter {@see Action}s that
 * style a block - font size, colours, minimap icon, beam, sound. Keeping this behind an
 * interface is the seam that separates "how important is this" (the generator's job) from
 * "what does important look like" (a swappable theme), mirroring NeverSink's named-style
 * indirection.
 */
interface StyleTheme
{
    /**
     * The styling actions for a tier. Higher tiers (lower numbers) read as more important.
     * A tier beyond the theme's range clamps to its least-prominent styling.
     *
     * @return list<Action>
     */
    public function styleFor(int $tier): array;
}
