<?php

declare(strict_types=1);

namespace App\Filter;

use InvalidArgumentException;

/**
 * A `Rarity` condition, e.g. `Rarity Rare` or `Rarity Normal Magic Rare`. Rendered in the
 * bare form the game reads as "is one of".
 */
final readonly class RarityCondition implements Condition
{
    /** @var list<Rarity> */
    private array $rarities;

    public function __construct(Rarity ...$rarities)
    {
        if ($rarities === []) {
            throw new InvalidArgumentException('Rarity needs at least one value.');
        }

        $this->rarities = array_values($rarities);
    }

    public function render(): string
    {
        $values = implode(' ', array_map(static fn (Rarity $rarity): string => $rarity->value, $this->rarities));

        return "Rarity {$values}";
    }
}
