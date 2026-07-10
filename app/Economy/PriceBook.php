<?php

declare(strict_types=1);

namespace App\Economy;

use App\Models\EconomyPrice;

/**
 * A league's cached prices, loaded once and queried in memory by the loot-filter
 * generator. This is a pure read view over the {@see EconomyPrice} snapshot - it never
 * calls poe2scout - exposing per-name lookups, a per-base-type ceiling (the dearest item
 * sharing a base, which is how a unique is priced for the filter), and filtered item
 * lists a tiering policy buckets. Prices are in Exalted Orbs.
 */
final class PriceBook
{
    /** @var array<string, float> item name => price */
    private array $priceByName = [];

    /** @var array<string, float> base type => dearest price of any item on that base */
    private array $ceilingByBaseType = [];

    /**
     * @param  list<PricedItem>  $items
     */
    public function __construct(
        private readonly string $league,
        private readonly array $items,
    ) {
        foreach ($items as $item) {
            $this->priceByName[$item->name] = max($this->priceByName[$item->name] ?? 0.0, $item->price);
            $this->ceilingByBaseType[$item->baseType] = max($this->ceilingByBaseType[$item->baseType] ?? 0.0, $item->price);
        }
    }

    /**
     * Load a league's snapshot from the database. A currency's base type is its own name;
     * a unique keeps the base it drops on (falling back to its name if that is missing).
     */
    public static function forLeague(string $league): self
    {
        $items = EconomyPrice::query()
            ->where('league', $league)
            ->get()
            ->map(static fn (EconomyPrice $row): PricedItem => new PricedItem(
                name: (string) $row->name,
                baseType: is_string($row->base_type) && $row->base_type !== '' ? $row->base_type : (string) $row->name,
                kind: (string) $row->kind,
                category: (string) $row->category,
                price: (float) $row->price,
                quantity: $row->quantity,
                maxStackSize: $row->max_stack_size,
            ))
            ->all();

        return new self($league, array_values($items));
    }

    public function league(): string
    {
        return $this->league;
    }

    public function isEmpty(): bool
    {
        return $this->items === [];
    }

    public function count(): int
    {
        return count($this->items);
    }

    /**
     * The priced items, optionally narrowed to a kind ('currency' | 'unique') and/or a
     * poe2scout category. Used by a tiering policy to bucket a category by price.
     *
     * @return list<PricedItem>
     */
    public function items(?string $kind = null, ?string $category = null): array
    {
        return array_values(array_filter(
            $this->items,
            static fn (PricedItem $item): bool => ($kind === null || $item->kind === $kind)
                && ($category === null || $item->category === $category),
        ));
    }

    /** The price of a single named item (e.g. a currency), or null when it is not priced. */
    public function priceOf(string $name): ?float
    {
        return $this->priceByName[$name] ?? null;
    }

    /**
     * The dearest price of any item sharing this base type, or null when none is priced.
     * This is how a unique is valued for the filter: the game can only match it by its
     * base, and several uniques may drop on one base, so the base is worth its best unique.
     */
    public function baseTypeCeiling(string $baseType): ?float
    {
        return $this->ceilingByBaseType[$baseType] ?? null;
    }
}
