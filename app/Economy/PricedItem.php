<?php

declare(strict_types=1);

namespace App\Economy;

use App\Models\EconomyPrice;

/**
 * One priced item as the filter generator consumes it: decoupled from the Eloquent
 * {@see EconomyPrice} row so the generator reasons over plain values. Price is
 * in Exalted Orbs. {@see $baseType} is what a loot filter keys on via `BaseType` - for a
 * currency it is its own name, for a unique the base it drops on.
 */
final readonly class PricedItem
{
    public function __construct(
        public string $name,
        public string $baseType,
        public string $kind,
        public string $category,
        public float $price,
        public ?int $quantity = null,
        /** Most units this item stacks to; null when it does not stack past one. */
        public ?int $maxStackSize = null,
    ) {}
}
